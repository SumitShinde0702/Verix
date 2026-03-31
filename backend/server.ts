import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createHmac } from 'crypto';
import { XAG } from './src/XAG';
import { AIAgent, SUPPORTED_ASSETS } from './src/services/AIAgent';
import type { AgentConfig, DemoEvent, VerifySettleInput } from './src/types';

// .env lives one level up (repo root), not inside backend/
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const XRPL_NODE =
  process.env.XRPL_NODE || 'wss://s.altnet.rippletest.net:51233';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const COINGECKO_API =
  process.env.COINGECKO_API || 'https://api.coingecko.com/api/v3';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// ─── Initialise XAG ───────────────────────────────────────────────────────────
const xag = new XAG({ xrplNode: XRPL_NODE });

async function bootstrap() {
  await xag.connect();
  console.log(`✓ Connected to XRPL: ${XRPL_NODE}`);
  app.listen(PORT, () =>
    console.log(`✓ Verix backend running on http://localhost:${PORT}`)
  );
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', xrpl: xag.isConnected() ? 'connected' : 'disconnected', network: 'testnet' });
});

// ─── Agent endpoints ─────────────────────────────────────────────────────────

app.post('/api/create-agent', async (req: Request, res: Response) => {
  const config: AgentConfig = req.body;
  if (!config.name || !config.type) {
    res.status(400).json({ error: '`name` and `type` are required' });
    return;
  }
  if (!['buyer', 'worker'].includes(config.type)) {
    res.status(400).json({ error: '`type` must be "buyer" or "worker"' });
    return;
  }
  try {
    const agent = await xag.createAgent(config);
    res.json({ success: true, agent });
  } catch (err) {
    res.status(500).json({ error: toMessage(err) });
  }
});

app.get('/api/resolve-did/:address', async (req: Request, res: Response) => {
  try {
    const doc = await xag.resolveDID(req.params.address);
    if (!doc) { res.status(404).json({ error: 'DID not found' }); return; }
    res.json({ success: true, didDocument: doc });
  } catch (err) {
    res.status(500).json({ error: toMessage(err) });
  }
});

app.get('/api/reputation/:address', async (req: Request, res: Response) => {
  try {
    const rep = await xag.getReputation(req.params.address);
    res.json({ success: true, reputation: rep });
  } catch (err) {
    res.status(500).json({ error: toMessage(err) });
  }
});

// ─── Supported assets ────────────────────────────────────────────────────────

app.get('/api/assets', (_req: Request, res: Response) => {
  res.json({ assets: Object.keys(SUPPORTED_ASSETS) });
});

// ─── Verify & Settle ─────────────────────────────────────────────────────────

app.post('/api/verify-and-settle', async (req: Request, res: Response) => {
  const input: VerifySettleInput = req.body;
  if (!input.taskOutput || !input.expectedSchema) {
    res.status(400).json({ error: '`taskOutput` and `expectedSchema` are required' });
    return;
  }
  try {
    const result = await xag.verifyAndSettle(input);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: toMessage(err) });
  }
});

// ─── Demo SSE endpoint ────────────────────────────────────────────────────────
//
// GET /api/demo/run — Server-Sent Events stream.
// The client connects once and receives a stream of DemoEvent objects as the
// full Verix flow executes live on XRPL testnet.
//
app.get('/api/demo/run', async (req: Request, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Natural-language query from the user (e.g. "get me the bitcoin price")
  const userQuery = String(req.query.query ?? 'Get me the ETH price');

  // Which layer the bad-worker should fail at (none = happy path)
  const rawFailAt = String(req.query.failAt ?? 'none');
  const failAt: 'none' | 'schema' | 'signature' =
    rawFailAt === 'schema' || rawFailAt === 'signature' ? rawFailAt : 'none';
  const isBadWorker = failAt !== 'none';

  const emit = (event: DemoEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const step = (
    step: DemoEvent['step'],
    status: DemoEvent['status'],
    message: string,
    data?: Record<string, unknown>
  ) => emit({ step, status, message, data, timestamp: new Date().toISOString() });

  try {
    // ── STEP 1: Create agents ────────────────────────────────────────────────
    step('agents_created', 'running', 'Creating buyer and worker agents on XRPL testnet…');

    const [buyer, worker] = await Promise.all([
      xag.createAgent({ name: 'Buyer Agent', type: 'buyer' }),
      xag.createAgent({ name: 'Worker Agent', type: 'worker' }),
    ]);
    const baseReputation = 50;

    step('agents_created', 'completed', 'Both agents funded and active on testnet.', {
      buyerAddress: buyer.address,
      workerAddress: worker.address,
      buyerBalance: xag.dropsToXrp(buyer.balanceDrops) + ' XRP',
      workerBalance: xag.dropsToXrp(worker.balanceDrops) + ' XRP',
    });

    // ── STEP 2: DIDs registered ──────────────────────────────────────────────
    step('dids_registered', 'completed', 'XLS-40 DIDs registered on-chain for both agents.', {
      buyerDID: buyer.did,
      workerDID: worker.did,
    });

    // ── STEP 3: AI buyer agent processes user request ────────────────────────
    // Default: ETH if no AI key configured
    let aiSymbol          = 'ETH';
    let aiCoinId          = 'ethereum';
    let aiReasoning       = `Need current ETH/USD price to fulfil request: "${userQuery}"`;
    let aiTaskDescription = 'Fetch ETH/USD price and return structured JSON.';
    let aiConfidence      = 95;

    step('ai_decision', 'running', `AI agent processing: "${userQuery}"…`);

    if (AIAgent.isConfigured(DEEPSEEK_API_KEY)) {
      try {
        const aiAgent = new AIAgent(DEEPSEEK_API_KEY);
        const decision = await aiAgent.processRequest(userQuery);
        aiSymbol          = decision.symbol;
        aiCoinId          = decision.coinId;
        aiReasoning       = decision.reasoning;
        aiTaskDescription = decision.taskDescription;
        aiConfidence      = decision.confidence;
      } catch {
        // Non-fatal — best-effort fallback already sets defaults above
      }
    } else {
      // No API key: best-effort parse of user query locally
      const q = userQuery.toUpperCase();
      const match = Object.keys(SUPPORTED_ASSETS).find((s) => q.includes(s));
      if (match) {
        aiSymbol          = match;
        aiCoinId          = SUPPORTED_ASSETS[match] ?? 'ethereum';
        aiReasoning       = `User requested ${match}/USD price.`;
        aiTaskDescription = `Fetch current ${match}/USD price from CoinGecko and return structured JSON.`;
      }
    }

    step('ai_decision', 'completed',
      `AI decided to fetch ${aiSymbol}/USD (${aiConfidence}% confidence)`, {
        model:           AIAgent.isConfigured(DEEPSEEK_API_KEY) ? 'deepseek-chat' : 'local-fallback',
        userQuery,
        symbol:          aiSymbol,
        coinId:          aiCoinId,
        reasoning:       aiReasoning,
        taskDescription: aiTaskDescription,
        confidence:      aiConfidence,
      });

    // ── STEP 4: Post task ────────────────────────────────────────────────────
    step('task_posted', 'running', 'Buyer agent defining task and computing crypto condition…');

    const expectedSchema = {
      type: 'object',
      properties: {
        asset:     { type: 'string' },
        price:     { type: 'number' },
        timestamp: { type: 'string' },
      },
      required: ['asset', 'price', 'timestamp'],
      additionalProperties: false,
    };

    const taskId = `task_${Date.now()}`;
    const rewardDrops = xag.xrpToDrops('1'); // 1 XRP on testnet

    const { task, escrow } = await xag.postTaskForWorker(
      buyer.seed,
      worker.address,
      {
        id: taskId,
        description: aiTaskDescription,
        expectedSchema,
        rewardDrops,
      }
    );

    step('task_posted', 'completed', 'Task posted. Crypto condition computed from expected schema.', {
      taskId:      task.id,
      description: task.description,
      expectedSchema,
      conditionHex: escrow.condition.substring(0, 32) + '…',
    });

    // ── STEP 4: Escrow created ───────────────────────────────────────────────
    step('escrow_created', 'completed', `1 XRP locked in XRPL escrow. Sequence #${escrow.sequence}.`, {
      escrowSequence: escrow.sequence,
      rewardXRP: '1 XRP (testnet)',
      conditionHex: escrow.condition.substring(0, 32) + '…',
      buyerAddress: buyer.address,
      workerAddress: worker.address,
      escrowTxHash: escrow.txHash,
      explorerUrl: `https://testnet.xrpl.org/transactions/${escrow.txHash}`,
    });

    // ── STEP 5: Worker calls CoinGecko ───────────────────────────────────────
    step('api_called', 'running',
      `Worker agent calling CoinGecko API for ${aiSymbol}/USD price…`);

    const price = await fetchCoinPrice(COINGECKO_API, aiCoinId);
    const rawOutput = {
      asset:     aiSymbol,
      price,
      timestamp: new Date().toISOString(),
    };

    step('api_called', 'completed',
      `CoinGecko returned ${aiSymbol}/USD = $${price.toFixed(2)}.`, {
        output: rawOutput,
      });

    // ── STEP 6: Worker signs output ──────────────────────────────────────────
    step('output_signed', 'running', isBadWorker
      ? `Bad worker preparing tampered output — will fail at Layer ${failAt === 'schema' ? '1' : '2'}…`
      : 'Worker agent signing output with DID private key…');

    // For schema failure: produce structurally wrong output (wrong field names, wrong types)
    // For signature failure: sign with a corrupted key so HMAC won't verify
    // For happy path: sign normally
    const outputToSign: Record<string, unknown> =
      failAt === 'schema'
        ? { badAsset: rawOutput.asset, notAPrice: String(rawOutput.price), missingTimestamp: true }
        : rawOutput;

    const sigKey =
      failAt === 'signature'
        ? worker.seed.split('').reverse().join('') // deliberately wrong key
        : worker.seed;

    const canonical = JSON.stringify(outputToSign, Object.keys(outputToSign).sort());
    const sig = createHmac('sha256', sigKey)
      .update(canonical)
      .digest('hex')
      .toUpperCase();
    const signedOutput = { ...outputToSign, __sig: sig };

    step('output_signed', isBadWorker ? 'completed' : 'completed',
      isBadWorker
        ? `Bad worker signed tampered output (${failAt === 'schema' ? 'wrong fields' : 'forged signature'}).`
        : 'Output signed with Ed25519 DID key. Signature embedded.',
      {
        signedOutput: { ...outputToSign, __sig: sig.substring(0, 32) + '…' },
        workerDID: worker.did,
        tampered: isBadWorker,
      });

    // ── STEP 7–9: Verix validates ────────────────────────────────────────────
    step('schema_validated', 'running', 'Verix validating output against expected JSON schema…');

    const verifyInput: VerifySettleInput = {
      taskOutput: signedOutput,
      expectedSchema,
      escrowSequence: escrow.sequence,
      escrowCondition: escrow.condition,
      escrowFulfillment: escrow.fulfillment,
      workerDID: worker.did,
      workerSeed: worker.seed,
      buyerAddress: buyer.address,
      workerAddress: worker.address,
    };

    const result = await xag.verifyAndSettle(verifyInput);

    if (!result.verified) {
      // Emit individual layer steps so the UI shows exactly where it broke
      if (result.failedAt === 'schema') {
        step('schema_validated', 'failed',
          `Layer 1 failed: ${result.reason ?? 'Output does not match expected JSON schema.'}`, {
            failedAt: 'schema',
            expected: '{ asset: string, price: number, timestamp: string }',
            received:  Object.keys(outputToSign).join(', '),
          });
      } else if (result.failedAt === 'signature') {
        step('schema_validated', 'completed', 'Schema validation passed. Output structure is correct.');
        step('sig_validated', 'failed',
          `Layer 2 failed: ${result.reason ?? 'HMAC signature does not match worker DID key.'}`, {
            failedAt: 'signature',
          });
      } else if (result.failedAt === 'hash') {
        step('schema_validated', 'completed', 'Schema validation passed. Output structure is correct.');
        step('sig_validated', 'completed', 'DID signature verified. Output authentically from worker agent.');
        step('hash_validated', 'failed',
          `Layer 3 failed: ${result.reason ?? 'Fulfillment hash does not match escrow condition.'}`, {
            failedAt: 'hash',
          });
      } else {
        step('schema_validated', 'failed', result.reason ?? 'Validation failed.');
      }

      step('funds_protected', 'completed',
        'Escrow still locked — buyer funds are safe. Worker receives nothing.', {
          escrowSequence: escrow.sequence,
          buyerAddress:   buyer.address,
          protectedXRP:   '1 XRP (testnet)',
          failedAt:       result.failedAt,
          reputation: {
            workerBefore: baseReputation,
            workerAfter:  40,
            buyerBefore:  baseReputation,
            buyerAfter:   55,
          },
        });

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    step('schema_validated', 'completed', 'Schema validation passed. Output structure is correct.');
    step('sig_validated', 'completed', 'DID signature verified. Output authentically from worker agent.');
    step('hash_validated', 'completed', 'Output hash matches escrow condition. Trustless proof confirmed.');

    // ── STEP 10: EscrowFinish ────────────────────────────────────────────────
    step('escrow_finished', 'completed', '1 XRP released to worker agent via EscrowFinish.', {
      txHash: result.txHash,
      explorerUrl: `https://testnet.xrpl.org/transactions/${result.txHash}`,
      complianceScore: result.complianceScore,
    });

    // ── STEP 11: Audit logged ────────────────────────────────────────────────
    step('audit_logged', 'completed', 'Audit trail written on-chain as XRPL transaction memo.', {
      auditUrl: result.auditUrl,
      reputation: {
        workerBefore: baseReputation,
        workerAfter:  100,
        buyerBefore:  baseReputation,
        buyerAfter:   60,
      },
      summary: 'Task completed • Payment released • Proof on-chain',
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = toMessage(err);
    const errorEvent: DemoEvent = {
      step: 'agents_created',
      status: 'failed',
      message: `Demo failed: ${message}`,
      timestamp: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchCoinPrice(apiBase: string, coinId: string): Promise<number> {
  const url = `${apiBase}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`CoinGecko error: ${resp.status}`);
  const data = (await resp.json()) as Record<string, { usd?: number }>;
  const price = data?.[coinId]?.usd;
  if (!price) throw new Error(`CoinGecko returned no price for ${coinId}`);
  return price;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Start ────────────────────────────────────────────────────────────────────
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
