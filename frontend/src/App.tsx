import { useState, useRef, useCallback } from 'react';
import AgentCard  from './components/AgentCard';
import StoryFeed  from './components/StoryFeed';
import type { DemoEvent } from './types';

const TOTAL_STEPS = 11;

export default function App() {
  const [events, setEvents]       = useState<DemoEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const completedCount = new Set(
    events.filter((e) => e.status === 'completed').map((e) => e.step)
  ).size;

  const success = isDone && events.some(
    (e) => e.step === 'audit_logged' && e.status === 'completed'
  );
  const failed = isDone && !success;

  const runDemo = useCallback(() => {
    if (isRunning) return;
    setEvents([]);
    setIsDone(false);
    setError(null);
    setIsRunning(true);

    const es = new EventSource('/api/demo/run');
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
  }, [isRunning]);

  const reset = () => {
    esRef.current?.close();
    setEvents([]);
    setIsDone(false);
    setIsRunning(false);
    setError(null);
  };

  const progressPct = Math.round((completedCount / TOTAL_STEPS) * 100);

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
          <div className="flex items-center gap-3">
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

        {/* ── Run Demo button ──────────────────────────────────────────────── */}
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

        {failed && (
          <div className="rounded-2xl border border-rose-DEFAULT/30 bg-rose-DEFAULT/5 p-6 text-center animate-fade-in">
            <p className="text-xl font-bold text-rose-DEFAULT mb-2">
              ✗ Validation Failed · Funds Remain Locked
            </p>
            <p className="text-sm text-slate-400">
              The escrow protects the buyer — no bad output can release payment.
            </p>
          </div>
        )}

        {/* ── Explainer (shown before first run) ───────────────────────────── */}
        {events.length === 0 && !isRunning && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            {[
              { icon: '🤖', color: 'cyan',    title: 'Buyer Agent',      body: 'Posts task. Defines expected output schema. Locks 1 XRP in XRPL escrow tied to a crypto condition.' },
              { icon: '⬡',  color: 'violet',  title: 'Verix Middleware', body: 'Validates output in 3 layers: JSON schema · DID signature · hash condition. No human arbitrator.' },
              { icon: '🤖', color: 'emerald', title: 'Worker Agent',     body: 'Fetches live ETH/USD from CoinGecko. Returns signed JSON. Receives 1 XRP via automatic EscrowFinish.' },
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
            <span>RLUSD Settlement</span>
            <span>·</span>
            <span>AJV Validation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
