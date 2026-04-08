import { useState } from 'react';
import { API_BASE_URL, apiUrl } from '../apiBase';

const INSTALL_CMD = 'npm install @sumitshinde/verix-sdk';

const EXAMPLE_API_ORIGIN = API_BASE_URL || 'http://localhost:3001';

const QUICKSTART = `import { VerixClient } from '@sumitshinde/verix-sdk';

const verix = new VerixClient('${EXAMPLE_API_ORIGIN}');

const stream = verix.streamDemo({
  query: 'Fetch Chainlink price data',
  failAt: 'none',
  onEvent: (ev) => {
    console.log(ev.step, ev.status, ev.message);
    if (ev.step === 'dids_registered') {
      console.log('Worker DID:', ev.data?.workerDID);
    }
  },
  onDone: async () => {
    const did = 'did:xrpl:1:...';
    const rep = await verix.getReputationHistoryByDid(did);
    console.log('Current score:', rep.currentScore);
  },
});

// stream.close() when needed`;

const CURL_RUN = `curl -N "${EXAMPLE_API_ORIGIN}/api/demo/run?query=Fetch%20Chainlink%20price%20data&failAt=none"`;
const CURL_REP = `curl "${EXAMPLE_API_ORIGIN}/api/reputation-history?did=did:xrpl:1:YOUR_WORKER_DID"`;
const VERIFY_SETTLE_TYPES = `export interface VerifySettleInput {
  taskOutput: Record<string, unknown>;
  expectedSchema: Record<string, unknown>;
  escrowSequence: number;
  escrowCondition: string;
  escrowFulfillment: string;
  workerDID: string;
  workerSeed: string;
  buyerAddress: string;
  workerAddress: string;
}

export type VerifyFailStage = 'schema' | 'signature' | 'hash' | 'settlement';

export interface VerifySettleResult {
  verified: boolean;
  txHash?: string;
  reason?: string;
  failedAt?: VerifyFailStage;
  complianceScore?: number;
  auditUrl?: string;
}`;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={onCopy}
      className="text-xs font-mono px-2.5 py-1 rounded-md border border-border text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-300">{title}</h3>
        <CopyButton value={code} />
      </div>
      <pre className="text-xs font-mono text-slate-300 bg-surface border border-border rounded-lg p-3 overflow-x-auto">
{code}
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [didInput, setDidInput] = useState('did:xrpl:1:');
  const [playgroundResult, setPlaygroundResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchReputation = async () => {
    if (!didInput.startsWith('did:xrpl:1:')) {
      setPlaygroundResult('Invalid DID format. Expected did:xrpl:1:<address>');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(apiUrl(`/api/reputation-history?did=${encodeURIComponent(didInput)}`));
      const body = await resp.json();
      setPlaygroundResult(JSON.stringify(body, null, 2));
    } catch (err) {
      setPlaygroundResult(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void grid-overlay text-slate-200">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-semibold text-white">Verix</a>
          <nav className="flex items-center gap-4 text-sm font-mono">
            <a href="/" className="text-slate-400 hover:text-white">Home</a>
            <a href="/demo" className="text-cyan-DEFAULT hover:text-white">Demo</a>
            <a href="/docs" className="text-violet-DEFAULT hover:text-white">Docs</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[220px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">On this page</p>
            <nav className="space-y-2 text-sm font-mono">
              <a href="#quickstart" className="block text-cyan-DEFAULT hover:text-white">Quickstart</a>
              <a href="#identity" className="block text-slate-400 hover:text-white">DID Identity</a>
              <a href="#escrow" className="block text-slate-400 hover:text-white">Escrow Flow</a>
              <a href="#verification" className="block text-slate-400 hover:text-white">Verification Layers</a>
              <a href="#reputation" className="block text-slate-400 hover:text-white">Reputation Anchors</a>
              <a href="#sdk-api" className="block text-slate-400 hover:text-white">SDK API</a>
              <a href="#playground" className="block text-slate-400 hover:text-white">API Playground</a>
              <a href="#type-reference" className="block text-slate-400 hover:text-white">Type Reference</a>
              <a href="#http-api" className="block text-slate-400 hover:text-white">HTTP API</a>
            </nav>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-violet-DEFAULT">Developer Docs</p>
            <h1 className="text-3xl font-bold text-white">Integrate Verix in 5 minutes</h1>
            <p className="text-slate-400 max-w-3xl">
              Run trustless agent settlement with XRPL escrow, DID-linked identity, and reputation anchors.
            </p>
          </div>

          <section id="quickstart" className="space-y-4">
            <CodeBlock title="Install SDK" code={INSTALL_CMD} />
            <CodeBlock title="Quickstart (TypeScript)" code={QUICKSTART} />
          </section>

          <section id="identity" className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">DID Identity</h2>
            <p className="text-sm text-slate-400">
              Every agent is represented by <span className="font-mono text-slate-200">did:xrpl:1:&lt;address&gt;</span>.
              Verix uses this DID as the identity root for signatures, escrow participants, and reputation subject tracking.
            </p>
          </section>

          <section id="escrow" className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">Escrow Flow</h2>
            <p className="text-sm text-slate-400">
              Buyer defines expected schema, Verix computes condition/fulfillment, then locks funds with XRPL
              <span className="font-mono text-slate-200"> EscrowCreate</span>.
              Funds release only when verification passes and Verix submits <span className="font-mono text-slate-200">EscrowFinish</span>.
            </p>
          </section>

          <section id="verification" className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">Verification Layers</h2>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>1) AJV schema validation</li>
              <li>2) DID/HMAC signature validation</li>
              <li>3) Escrow condition hash validation</li>
            </ul>
          </section>

          <section id="reputation" className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">Reputation Anchors</h2>
            <p className="text-sm text-slate-400">
              After each run, Verix writes a <span className="font-mono text-slate-200">REPUTATION_ANCHOR</span> memo containing
              subject DID, new score, previous anchor hash reference, and credential hash. Latest score is resolved from
              latest valid DID-matching anchor.
            </p>
          </section>

          <section id="sdk-api" className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">SDK API</h2>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300 font-mono">new VerixClient(baseUrl)</p>
              <p className="text-slate-500">Create SDK client for your Verix backend.</p>
              <p className="text-slate-300 font-mono">streamDemo({`{ query, failAt, onEvent, onDone, onError }`})</p>
              <p className="text-slate-500">Run full live flow through SSE events.</p>
              <p className="text-slate-300 font-mono">getReputationHistoryByDid(did)</p>
              <p className="text-slate-500">Fetch DID-linked score + history entries.</p>
            </div>
          </section>

          <section id="playground" className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">API Playground</h2>
            <p className="text-sm text-slate-400">
              This calls your backend endpoint, which resolves current score from the latest XRPL
              <span className="font-mono text-slate-200"> REPUTATION_ANCHOR</span> memo for that DID.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={didInput}
                onChange={(e) => setDidInput(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-slate-200"
                placeholder="did:xrpl:1:r..."
              />
              <button
                onClick={fetchReputation}
                className="px-4 py-2 rounded-lg bg-cyan-DEFAULT text-white font-semibold text-sm hover:brightness-110 transition"
              >
                {loading ? 'Fetching...' : 'Fetch Reputation'}
              </button>
            </div>
            {playgroundResult && (
              <pre className="text-xs font-mono text-slate-300 bg-surface border border-border rounded-lg p-3 overflow-x-auto">
{playgroundResult}
              </pre>
            )}
          </section>

          <section id="type-reference" className="space-y-4">
            <CodeBlock title="Type Reference — Verify & Settle" code={VERIFY_SETTLE_TYPES} />
          </section>

          <section id="http-api" className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <CodeBlock title="SSE Demo (cURL)" code={CURL_RUN} />
              <CodeBlock title="Reputation API (cURL)" code={CURL_REP} />
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-300 mb-3">Core endpoints</h2>
              <div className="space-y-2 text-sm font-mono text-slate-400">
                <p><span className="text-cyan-DEFAULT">GET</span> /api/demo/run?query=&amp;failAt=none|schema|signature</p>
                <p><span className="text-cyan-DEFAULT">GET</span> /api/reputation-history?did=&lt;did:xrpl:...&gt;</p>
                <p><span className="text-cyan-DEFAULT">POST</span> /api/verify-and-settle</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

