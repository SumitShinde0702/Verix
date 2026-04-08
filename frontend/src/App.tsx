import { useState, useRef, useCallback, useEffect } from 'react';
import AgentCard   from './components/AgentCard';
import StoryFeed   from './components/StoryFeed';
import QueryInput  from './components/QueryInput';
import type { DemoEvent, FailAt } from './types';

const TOTAL_STEPS = 12;

export default function App() {
  const [events, setEvents]       = useState<DemoEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [query, setQuery]         = useState('Get me the Ethereum price');
  const [failAt, setFailAt]       = useState<FailAt>('none');
  const [repHistory, setRepHistory] = useState<{
    did: string;
    currentScore: number;
    runs: number;
    history: Array<{
      timestamp: string;
      outcome: 'pass' | 'fail';
      before: number;
      after: number;
      delta: number;
      credentialHash?: string;
      credentialTxHash?: string;
      credentialUrl?: string;
      auditUrl?: string;
      escrowCreateTx?: string;
      escrowFinishTx?: string;
      failedAt?: string;
      failedReason?: string;
    }>;
  } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const modeLabel =
    failAt === 'none' ? 'Honest worker' :
    failAt === 'schema' ? 'Bad schema (Layer 1 fail)' :
    'Forged signature (Layer 2 fail)';

  const completedCount = new Set(
    events
      .filter((e) => e.status === 'completed' || e.status === 'failed')
      .map((e) => e.step)
  ).size;

  const success = isDone && events.some(
    (e) => e.step === 'audit_logged' && e.status === 'completed'
  );
  const fundsProtected = isDone && events.some(
    (e) => e.step === 'funds_protected' && e.status === 'completed'
  );
  const failed = isDone && !success && !fundsProtected;

  const runDemo = useCallback(() => {
    if (isRunning) return;
    setEvents([]);
    setIsDone(false);
    setError(null);
    setIsRunning(true);

    const url = `/api/demo/run?query=${encodeURIComponent(query || 'Get me the ETH price')}&failAt=${failAt}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (msg: MessageEvent<string>) => {
      if (msg.data === '[DONE]') {
        setIsRunning(false);
        setIsDone(true);
        es.close();
        return;
      }
      try {
        const event = JSON.parse(msg.data) as DemoEvent;
        setEvents((prev) => [...prev, event]);
      } catch { /* skip malformed */ }
    };

    es.onerror = () => {
      setError('Lost connection to backend. Is the backend running on port 3001?');
      setIsRunning(false);
      es.close();
    };
  }, [isRunning, query, failAt]);

  const reset = () => {
    esRef.current?.close();
    setEvents([]);
    setIsDone(false);
    setIsRunning(false);
    setError(null);
    setQuery('Get me the Ethereum price');
    setFailAt('none');
    setRepHistory(null);
  };

  const progressPct = Math.round((completedCount / TOTAL_STEPS) * 100);
  const didEvent = events.find((e) => e.step === 'dids_registered' && e.status === 'completed');
  const escrowCreateEvent = events.find((e) => e.step === 'escrow_created' && e.status === 'completed');
  const escrowFinishEvent = events.find((e) => e.step === 'escrow_finished' && e.status === 'completed');
  const auditEvent = events.find((e) => e.step === 'audit_logged' && e.status === 'completed');
  const protectedEvent = events.find((e) => e.step === 'funds_protected' && e.status === 'completed');

  const repSource = (auditEvent?.data?.reputation ?? protectedEvent?.data?.reputation) as
    | {
      workerBefore?: number;
      workerAfter?: number;
      buyerBefore?: number;
      buyerAfter?: number;
      credentialUrl?: string;
    }
    | undefined;
  const buyerDid = didEvent?.data?.buyerDID ? String(didEvent.data.buyerDID) : '';
  const workerDid = didEvent?.data?.workerDID ? String(didEvent.data.workerDID) : '';
  const buyerDidUrl = buyerDid
    ? `https://testnet.xrpl.org/accounts/${buyerDid.split(':').pop()}`
    : '';
  const workerDidUrl = workerDid
    ? `https://testnet.xrpl.org/accounts/${workerDid.split(':').pop()}`
    : '';
  const escrowCreateTx = escrowCreateEvent?.data?.escrowTxHash
    ? String(escrowCreateEvent.data.escrowTxHash)
    : '';
  const escrowCreateUrl = escrowCreateTx
    ? `https://testnet.xrpl.org/transactions/${escrowCreateTx}`
    : '';
  const escrowFinishTx = escrowFinishEvent?.data?.txHash
    ? String(escrowFinishEvent.data.txHash)
    : '';
  const escrowFinishUrl = escrowFinishTx
    ? `https://testnet.xrpl.org/transactions/${escrowFinishTx}`
    : '';
  const auditUrl = auditEvent?.data?.auditUrl ? String(auditEvent.data.auditUrl) : '';
  const reputationHistoryUrl = auditEvent?.data?.reputationHistoryUrl
    ? String(auditEvent.data.reputationHistoryUrl)
    : workerDid
      ? `/api/reputation-history?did=${encodeURIComponent(workerDid)}`
      : '';
  const failedLayer = protectedEvent?.data?.failedAt ? String(protectedEvent.data.failedAt) : '';

  useEffect(() => {
    if (!isDone || !workerDid) return;
    const controller = new AbortController();
    fetch(`/api/reputation-history?did=${encodeURIComponent(workerDid)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.success) return;
        setRepHistory({
          did: String(data.did),
          currentScore: Number(data.currentScore ?? 50),
          runs: Number(data.runs ?? 0),
          history: Array.isArray(data.history) ? data.history : [],
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isDone, workerDid]);

  return (
    <div className="min-h-screen bg-void grid-overlay flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-DEFAULT to-violet-DEFAULT flex items-center justify-center text-xs font-bold text-white shadow-glow-cyan">
              V
            </div>
            <span className="font-semibold text-white tracking-wide">Verix</span>
            <span className="hidden sm:block text-xs text-slate-600 font-mono border-l border-border pl-3">
              trustless task settlement · AI agent commerce
            </span>
          </div>
          <div className="flex items-center gap-5">
            <nav className="hidden sm:flex items-center gap-3 text-xs font-mono">
              <a href="/" className="text-slate-500 hover:text-white transition-colors">
                Home
              </a>
              <a href="/demo" className="text-cyan-DEFAULT hover:text-white transition-colors">
                Demo
              </a>
              <a href="/docs" className="text-violet-DEFAULT hover:text-white transition-colors">
                Docs
              </a>
            </nav>
            {isRunning && (
              <div className="flex items-center gap-2 text-xs font-mono text-violet-DEFAULT">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-DEFAULT animate-pulse" />
                Live on testnet
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-DEFAULT shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse-slow" />
              <span className="text-xs font-mono text-slate-500">XRPL TESTNET</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full px-6 flex-1 py-8 space-y-6">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Trustless Task Settlement for{' '}
            <span className="text-cyan-DEFAULT text-glow-cyan">AI Agents</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
            Payment locks in XRPL escrow. Releases only when output is
            cryptographically verified.{' '}
            <span className="text-slate-300">No middleman. No scripts. Just math.</span>
          </p>
        </div>

        {/* ── Query input ──────────────────────────────────────────────────── */}
        {!isRunning && events.length === 0 && (
          <QueryInput
            value={query}
            onChange={setQuery}
            failAt={failAt}
            onFailAtChange={setFailAt}
            disabled={isRunning}
          />
        )}

        {/* ── Run Demo button ──────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2">
          {!isRunning && (
            <p className="text-xs font-mono text-slate-500">
              Mode sent to backend: <span className="text-slate-300">{modeLabel}</span>
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
          <button
            onClick={runDemo}
            disabled={isRunning}
            className={`px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300
              ${isRunning
                ? 'bg-surface border border-border text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-DEFAULT to-violet-DEFAULT text-white hover:shadow-glow-cyan hover:scale-[1.02] active:scale-[0.99]'
              }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-violet-DEFAULT animate-spin" />
                Running live on XRPL testnet…
              </span>
            ) : isDone ? 'Run Demo Again' : '▶  Run Demo'}
          </button>
          {(isDone || events.length > 0) && !isRunning && (
            <button onClick={reset}
              className="px-4 py-3.5 rounded-xl text-sm text-slate-400 border border-border hover:border-slate-500 hover:text-slate-200 transition-all">
              Reset
            </button>
          )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-DEFAULT/30 bg-rose-DEFAULT/5 px-4 py-3 text-sm text-rose-DEFAULT font-mono text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        {(isRunning || completedCount > 0) && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>{completedCount}/{TOTAL_STEPS} steps complete</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-DEFAULT via-violet-DEFAULT to-emerald-DEFAULT rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Three agent status cards ──────────────────────────────────────── */}
        {(isRunning || completedCount > 0) && (
          <div className="grid grid-cols-3 gap-3 animate-fade-in">
            <AgentCard role="buyer"  events={events} />
            <AgentCard role="verix" events={events} />
            <AgentCard role="worker" events={events} />
          </div>
        )}

        {/* ── Story feed ───────────────────────────────────────────────────── */}
        {events.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
              <div className="w-2 h-2 rounded-full bg-violet-DEFAULT animate-glow-pulse" />
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
                Settlement Flow
              </h2>
              <span className="text-xs font-mono text-slate-600 ml-auto">
                {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
              </span>
            </div>
            <StoryFeed events={events} />
          </div>
        )}

        {/* ── Final result banner ───────────────────────────────────────────── */}
        {success && (
          <div className="rounded-2xl border border-emerald-DEFAULT/30 bg-emerald-DEFAULT/5 p-6 text-center animate-fade-in space-y-2">
            <p className="text-xl font-bold text-emerald-DEFAULT">
              ✓ Task Completed · Payment Released · Proof On-Chain
            </p>
            <p className="text-sm text-slate-400">
              End-to-end trustless settlement on XRPL testnet — no middleman, no scripts, just math.
            </p>
            {repSource && (
              <p className="text-xs font-mono text-slate-300">
                Reputation: Worker {repSource.workerBefore ?? '-'} → {repSource.workerAfter ?? '-'} · Buyer {repSource.buyerBefore ?? '-'} → {repSource.buyerAfter ?? '-'}
              </p>
            )}
            <div className="flex justify-center gap-4 pt-2 flex-wrap">
              {(() => {
                const ev = events.find(e => e.step === 'escrow_finished' && e.status === 'completed');
                const txHash = ev?.data?.txHash as string | undefined;
                return txHash ? (
                  <a href={`https://testnet.xrpl.org/transactions/${txHash}`}
                    target="_blank" rel="noreferrer"
                    className="text-sm font-mono text-cyan-DEFAULT hover:text-white transition-colors border border-cyan-DEFAULT/30 rounded-lg px-4 py-2 hover:bg-cyan-glow">
                    View EscrowFinish on XRPL ↗
                  </a>
                ) : null;
              })()}
              {(() => {
                const ev = events.find(e => e.step === 'audit_logged' && e.status === 'completed');
                const url = ev?.data?.auditUrl as string | undefined;
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer"
                    className="text-sm font-mono text-violet-DEFAULT hover:text-white transition-colors border border-violet-DEFAULT/30 rounded-lg px-4 py-2 hover:bg-violet-glow">
                    View Audit Memo on XRPL ↗
                  </a>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {fundsProtected && (
          <div className="rounded-2xl border border-rose-DEFAULT/30 bg-rose-DEFAULT/5 p-6 text-center animate-fade-in space-y-3">
            <p className="text-xl font-bold text-rose-DEFAULT">
              ✗ Validation Failed · Escrow Still Locked
            </p>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              The bad worker submitted invalid output.{' '}
              <span className="text-slate-200">Verix caught it, blocked the EscrowFinish,
              and the buyer's 1 XRP stays locked on-chain.</span>{' '}
              No human arbitration needed — the math did it.
            </p>
            <div className="flex justify-center gap-3 pt-1 flex-wrap">
              <div className="text-xs font-mono border border-rose-DEFAULT/30 rounded-lg px-4 py-2 text-rose-DEFAULT">
                Worker paid: 0 XRP
              </div>
              <div className="text-xs font-mono border border-emerald-DEFAULT/30 rounded-lg px-4 py-2 text-emerald-DEFAULT">
                Buyer funds: protected
              </div>
            </div>
            {repSource && (
              <p className="text-xs font-mono text-slate-300">
                Reputation: Worker {repSource.workerBefore ?? '-'} → {repSource.workerAfter ?? '-'} · Buyer {repSource.buyerBefore ?? '-'} → {repSource.buyerAfter ?? '-'}
              </p>
            )}
          </div>
        )}

        {(isDone && events.length > 0) && (
          <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
              Proof Bundle
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Boolean(buyerDidUrl) && (
                <a
                  href={buyerDidUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-cyan-DEFAULT hover:text-white hover:border-cyan-DEFAULT/40 transition-colors"
                >
                  Buyer DID ↗
                </a>
              )}
              {Boolean(workerDidUrl) && (
                <a
                  href={workerDidUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-cyan-DEFAULT hover:text-white hover:border-cyan-DEFAULT/40 transition-colors"
                >
                  Worker DID ↗
                </a>
              )}
              {Boolean(escrowCreateUrl) && (
                <a
                  href={escrowCreateUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-violet-DEFAULT hover:text-white hover:border-violet-DEFAULT/40 transition-colors"
                >
                  EscrowCreate Tx ↗
                </a>
              )}
              {Boolean(escrowFinishUrl) && (
                <a
                  href={escrowFinishUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-emerald-DEFAULT hover:text-white hover:border-emerald-DEFAULT/40 transition-colors"
                >
                  EscrowFinish Tx ↗
                </a>
              )}
              {Boolean(auditUrl) && (
                <a
                  href={auditUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-amber-DEFAULT hover:text-white hover:border-amber-DEFAULT/40 transition-colors"
                >
                  Audit Memo Tx ↗
                </a>
              )}
              {Boolean(reputationHistoryUrl) && (
                <a
                  href={reputationHistoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
                >
                  Reputation JSON ↗
                </a>
              )}
              {Boolean(repSource?.credentialUrl) && (
                <a
                  href={String(repSource?.credentialUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono border border-border rounded-lg px-3 py-2 text-cyan-DEFAULT hover:text-white hover:border-cyan-DEFAULT/40 transition-colors"
                >
                  Reputation Anchor Tx ↗
                </a>
              )}
              {Boolean(failedLayer) && (
                <div className="font-mono border border-rose-DEFAULT/40 rounded-lg px-3 py-2 text-rose-DEFAULT">
                  Failed at: Layer {failedLayer}
                </div>
              )}
            </div>
          </div>
        )}

        {repHistory && (
          <div className="rounded-2xl border border-border bg-card p-6 animate-fade-in space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
              DID Reputation History
            </h3>
            <p className="text-xs font-mono text-slate-500">
              {repHistory.did} · score {repHistory.currentScore}/100 · runs {repHistory.runs}
            </p>
            <div className="space-y-2">
              {repHistory.history.slice(-5).reverse().map((entry, idx) => (
                <div key={`${entry.timestamp}-${idx}`} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className={entry.outcome === 'pass' ? 'text-emerald-DEFAULT' : 'text-rose-DEFAULT'}>
                      {entry.outcome.toUpperCase()} · {entry.before} → {entry.after} ({entry.delta > 0 ? '+' : ''}{entry.delta})
                    </span>
                    <span className="text-slate-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-mono">
                    {!!entry.escrowCreateTx && (
                      <a href={`https://testnet.xrpl.org/transactions/${entry.escrowCreateTx}`} target="_blank" rel="noreferrer" className="text-violet-DEFAULT hover:text-white">
                        EscrowCreate ↗
                      </a>
                    )}
                    {!!entry.escrowFinishTx && (
                      <a href={`https://testnet.xrpl.org/transactions/${entry.escrowFinishTx}`} target="_blank" rel="noreferrer" className="text-emerald-DEFAULT hover:text-white">
                        EscrowFinish ↗
                      </a>
                    )}
                    {!!entry.auditUrl && (
                      <a href={entry.auditUrl} target="_blank" rel="noreferrer" className="text-amber-DEFAULT hover:text-white">
                        Audit Memo ↗
                      </a>
                    )}
                    {!!entry.credentialUrl && (
                      <a href={entry.credentialUrl} target="_blank" rel="noreferrer" className="text-cyan-DEFAULT hover:text-white">
                        Reputation Anchor ↗
                      </a>
                    )}
                    {!!entry.failedAt && (
                      <span className="text-rose-DEFAULT">failed at {entry.failedAt}</span>
                    )}
                    {!!entry.failedReason && (
                      <span className="text-rose-DEFAULT/80">reason: {entry.failedReason}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {failed && (
          <div className="rounded-2xl border border-rose-DEFAULT/30 bg-rose-DEFAULT/5 p-6 text-center animate-fade-in">
            <p className="text-xl font-bold text-rose-DEFAULT mb-2">
              ✗ Demo Error
            </p>
            <p className="text-sm text-slate-400">
              Something went wrong with the demo connection.
            </p>
          </div>
        )}

        {/* ── Explainer (shown before first run) ───────────────────────────── */}
        {events.length === 0 && !isRunning && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            {[
              { icon: '🤖', color: 'cyan',    title: 'Buyer Agent',      body: 'Posts task. Defines expected output schema. Locks 1 XRP in XRPL escrow tied to a crypto condition.' },
              { icon: '⬡',  color: 'violet',  title: 'Verix Middleware', body: 'Validates output in 3 layers: JSON schema · DID signature · hash condition. No human arbitrator.' },
              { icon: '🤖', color: 'emerald', title: 'Worker Agent',     body: 'Fetches live price for the AI-chosen asset from CoinGecko. Returns signed JSON. Receives 1 XRP via automatic EscrowFinish.' },
            ].map(({ icon, color, title, body }) => (
              <div key={title} className={`rounded-xl border border-border bg-card p-4 hover:border-${color}-DEFAULT/30 transition-colors`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{icon}</span>
                  <h3 className={`text-sm font-semibold text-${color}-DEFAULT`}>{title}</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-4">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono text-slate-600">Verix · Ripple Student Builder Residency 2026</span>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-700">
            <span>XLS-40 DIDs</span>
            <span>·</span>
            <span>PREIMAGE-SHA-256 Escrows</span>
            <span>·</span>
            <span>XRP (testnet)</span>
            <span>·</span>
            <span>AJV Validation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
