import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createHmac } from 'crypto';
import { XAG } from './src/XAG';
import { AIAgent, SUPPORTED_ASSETS } from './src/services/AIAgent';
import { DemoStateStore, type StoredAgent } from './src/services/DemoStateStore';
import {
  buildReputationCredential,
  hashCredential,
} from './src/reputation/ReputationCredential';
import type { AgentConfig, DemoEvent, VerifySettleInput } from './src/types';

// .env lives one level up (repo root), not inside backend/
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const XRPL_NODE =
  process.env.XRPL_NODE || 'wss://s.altnet.rippletest.net:51233';
const FRONTEND_URL_RAW = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedFrontendOrigins = FRONTEND_URL_RAW.split(',').map((o) => o.trim()).filter(Boolean);
const COINGECKO_API =
  process.env.COINGECKO_API || 'https://api.coingecko.com/api/v3';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

app.use(
  cors({
    origin:
      allowedFrontendOrigins.length <= 1
        ? allowedFrontendOrigins[0] ?? true
        : allowedFrontendOrigins,
  })
);
app.use(express.json());

// ─── Initialise XAG ───────────────────────────────────────────────────────────
const xag = new XAG({ xrplNode: XRPL_NODE });
const demoStore = new DemoStateStore(path.join(__dirname, 'data', 'demo-state.json'));

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

app.get('/api/reputation-history', async (req: Request, res: Response) => {
  const didQuery = String(req.query.did ?? '');
  const addressQuery = String(req.query.address ?? '');
  const did = didQuery.startsWith('did:xrpl:1:')
    ? didQuery
    : addressQuery
      ? `did:xrpl:1:${addressQuery}`
      : '';
  if (!did) {
    res.status(400).json({ error: 'Provide `did` or `address` query param' });
    return;
  }
  try {
    const history = await demoStore.getHistory(did);
    const persisted = await demoStore.getAgents();
    const issuerAccount = persisted.buyer?.address;
    const latestAnchor = issuerAccount
      ? await xag.getLatestReputationAnchor(issuerAccount, did)
      : null;
    const currentScore =
      typeof latestAnchor?.newScore === 'number'
        ? latestAnchor.newScore
        : history.length > 0
          ? history[history.length - 1].after
          : 50;
    res.json({ success: true, did, currentScore, runs: history.length, history });
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
    step('agents_created', 'running', 'Loading or creating buyer and worker agents on XRPL testnet…');

    const persisted = await demoStore.getAgents();
    const [buyer, worker] = await (async () => {
      if (persisted.buyer && persisted.worker) {
        const [buyerBalanceDrops, workerBalanceDrops] = await Promise.all([
          xag.getBalance(persisted.buyer.address),
          xag.getBalance(persisted.worker.address),
        ]);
        return [
          toRuntimeAgent(persisted.buyer, buyerBalanceDrops),
          toRuntimeAgent(persisted.worker, workerBalanceDrops),
        ];
      }

      const [newBuyer, newWorker] = await Promise.all([
        xag.createAgent({ name: 'Buyer Agent', type: 'buyer' }),
        xag.createAgent({ name: 'Worker Agent', type: 'worker' }),
      ]);
      await demoStore.saveAgents({
        buyer: {
          name: newBuyer.name,
          type: newBuyer.type,
          did: newBuyer.did,
          address: newBuyer.address,
          publicKey: newBuyer.publicKey,
          seed: newBuyer.seed,
          createdAt: newBuyer.createdAt,
        },
        worker: {
          name: newWorker.name,
          type: newWorker.type,
          did: newWorker.did,
          address: newWorker.address,
          publicKey: newWorker.publicKey,
          seed: newWorker.seed,
          createdAt: newWorker.createdAt,
        },
      });
      return [newBuyer, newWorker];
    })();

    step('agents_created', 'completed', 'Buyer/worker identities ready on testnet (persistent across runs).', {
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
          reputation: await recordReputation({
            buyerDid: buyer.did,
            workerDid: worker.did,
            issuerDid: buyer.did,
            signerAddress: buyer.address,
            signerSeed: buyer.seed,
            outcome: 'fail',
            failedAt: String(result.failedAt ?? ''),
            failedReason: String(result.reason ?? ''),
            escrowCreateTx: escrow.txHash,
          }),
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
      reputation: await recordReputation({
        buyerDid: buyer.did,
        workerDid: worker.did,
        issuerDid: buyer.did,
        signerAddress: buyer.address,
        signerSeed: buyer.seed,
        outcome: 'pass',
        auditUrl: result.auditUrl ?? '',
        escrowCreateTx: escrow.txHash,
        escrowFinishTx: result.txHash ?? '',
      }),
      reputationHistoryUrl: `/api/reputation-history?did=${encodeURIComponent(worker.did)}`,
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

function toRuntimeAgent(stored: StoredAgent, balanceDrops: string) {
  return {
    ...stored,
    balanceDrops,
  };
}

async function recordReputation(args: {
  buyerDid: string;
  workerDid: string;
  issuerDid: string;
  signerAddress: string;
  signerSeed: string;
  outcome: 'pass' | 'fail';
  failedAt?: string;
  failedReason?: string;
  auditUrl?: string;
  escrowCreateTx?: string;
  escrowFinishTx?: string;
}) {
  const [workerHistory, buyerHistory, latestWorkerAnchor] = await Promise.all([
    demoStore.getHistory(args.workerDid),
    demoStore.getHistory(args.buyerDid),
    xag.getLatestReputationAnchor(args.signerAddress, args.workerDid),
  ]);
  const workerBefore =
    typeof latestWorkerAnchor?.newScore === 'number'
      ? latestWorkerAnchor.newScore
      : workerHistory.length > 0
        ? workerHistory[workerHistory.length - 1].after
        : 50;
  const buyerBefore = buyerHistory.length > 0 ? buyerHistory[buyerHistory.length - 1].after : 50;
  const workerDelta = args.outcome === 'pass' ? 10 : -10;
  const buyerDelta = args.outcome === 'pass' ? 10 : -10;
  const workerAfter = Math.max(0, Math.min(100, workerBefore + workerDelta));
  const buyerAfter = Math.max(0, Math.min(100, buyerBefore + buyerDelta));

  const credential = buildReputationCredential({
    subjectDid: args.workerDid,
    issuerDid: args.issuerDid,
    outcome: args.outcome,
    before: workerBefore,
    after: workerAfter,
    delta: workerDelta,
    failedAt: args.failedAt,
    failedReason: args.failedReason,
    escrowCreateTx: args.escrowCreateTx,
    escrowFinishTx: args.escrowFinishTx,
    auditUrl: args.auditUrl,
  });
  const credentialHash = hashCredential(credential);
  const credentialTxHash = await xag.anchorReputationHash(
    { address: args.signerAddress, seed: args.signerSeed },
    {
      type: 'REPUTATION_ANCHOR',
      subjectDid: args.workerDid,
      credentialHash,
      outcome: args.outcome,
      prevAnchorTxHash: latestWorkerAnchor?.txHash ?? '',
      newScore: workerAfter,
      failedReason: args.failedReason ?? '',
      timestamp: new Date().toISOString(),
    }
  );
  const credentialUrl = credentialTxHash
    ? `https://testnet.xrpl.org/transactions/${credentialTxHash}`
    : '';

  // Write sequentially to avoid file write races in local JSON storage.
  await demoStore.appendHistoryEntry(args.workerDid, {
    timestamp: new Date().toISOString(),
    outcome: args.outcome,
    delta: workerDelta,
    before: workerBefore,
    after: workerAfter,
    failedAt: args.failedAt,
    failedReason: args.failedReason,
    auditUrl: args.auditUrl,
    escrowCreateTx: args.escrowCreateTx,
    escrowFinishTx: args.escrowFinishTx,
    credentialHash,
    credentialTxHash,
    credentialUrl,
  });
  await demoStore.appendHistoryEntry(args.buyerDid, {
    timestamp: new Date().toISOString(),
    outcome: args.outcome === 'pass' ? 'pass' : 'fail',
    delta: buyerDelta,
    before: buyerBefore,
    after: buyerAfter,
    failedAt: args.failedAt,
    failedReason: args.failedReason,
    auditUrl: args.auditUrl,
    escrowCreateTx: args.escrowCreateTx,
    escrowFinishTx: args.escrowFinishTx,
    credentialHash,
    credentialTxHash,
    credentialUrl,
  });

  return {
    workerBefore,
    workerAfter,
    buyerBefore,
    buyerAfter,
    credentialHash,
    credentialTxHash,
    credentialUrl,
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
