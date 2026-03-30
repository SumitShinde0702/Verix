import type { DemoEvent } from '../types';

interface Props {
  events: DemoEvent[];
  isRunning: boolean;
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <span className="text-xs uppercase tracking-widest text-slate-500">{label}</span>
      <p className={`text-sm text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function StepRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
          ${done ? 'bg-cyan-DEFAULT text-void shadow-[0_0_8px_rgba(0,212,255,0.6)]' : 'border border-border text-slate-600'}`}
      >
        {done ? '✓' : '·'}
      </span>
      <span className={`transition-colors duration-300 ${done ? 'text-slate-200' : 'text-slate-600'}`}>{label}</span>
    </div>
  );
}

export default function BuyerPanel({ events, isRunning }: Props) {
  const has = (step: string, status?: string) =>
    events.some((e) => e.step === step && (!status || e.status === status));

  const getDataField = (step: string, field: string): string => {
    const ev = events.find((e) => e.step === step && e.status === 'completed');
    return (ev?.data?.[field] as string) ?? '—';
  };

  const agentsDone    = has('agents_created', 'completed');
  const didsDone      = has('dids_registered', 'completed');
  const taskDone      = has('task_posted', 'completed');
  const escrowDone    = has('escrow_created', 'completed');
  const finishedDone  = has('escrow_finished', 'completed');

  const buyerDID      = getDataField('dids_registered', 'buyerDID');
  const buyerAddress  = getDataField('agents_created', 'buyerAddress');
  const buyerBalance  = getDataField('agents_created', 'buyerBalance');
  const escrowTxHash  = getDataField('escrow_created', 'escrowTxHash');
  const escrowSeq     = getDataField('escrow_created', 'escrowSequence');
  const explorerUrl   = getDataField('escrow_created', 'explorerUrl');

  const isActive = isRunning || agentsDone;

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border transition-all duration-700
        ${isActive ? 'border-cyan-DEFAULT/40 bg-card shadow-glow-cyan' : 'border-border bg-card'}
      `}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base
              ${isActive ? 'bg-cyan-glow border border-cyan-DEFAULT/50' : 'bg-surface border border-border'}`}
          >
            🤖
          </div>
          <div>
            <h2 className={`font-semibold text-sm ${isActive ? 'text-cyan-DEFAULT text-glow-cyan' : 'text-slate-400'}`}>
              BUYER AGENT
            </h2>
            <p className="text-xs text-slate-600">Posts task · Locks escrow</p>
          </div>
          {isRunning && !escrowDone && (
            <div className="ml-auto flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-DEFAULT animate-pulse-slow"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          )}
          {escrowDone && (
            <div className="ml-auto text-xs font-mono text-cyan-DEFAULT bg-cyan-glow border border-cyan-DEFAULT/30 rounded px-2 py-0.5">
              LOCKED
            </div>
          )}
          {finishedDone && (
            <div className="ml-auto text-xs font-mono text-slate-400 bg-surface border border-border rounded px-2 py-0.5">
              SETTLED
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 py-4 border-b border-border space-y-2.5">
        <StepRow label="Create wallet + fund from faucet" done={agentsDone} />
        <StepRow label="Register XLS-40 DID on-chain"     done={didsDone} />
        <StepRow label="Define task + expected schema"     done={taskDone} />
        <StepRow label="Lock 1 XRP in XRPL escrow"        done={escrowDone} />
      </div>

      {/* Data */}
      <div className="px-5 py-4 flex-1 space-y-4 overflow-auto">
        {agentsDone && (
          <div className="animate-slide-up space-y-3">
            <Field label="Address"    value={buyerAddress} />
            <Field label="Balance"    value={buyerBalance} />
          </div>
        )}
        {didsDone && (
          <div className="animate-slide-up space-y-1">
            <Field label="DID (XLS-40)" value={buyerDID} />
            <a
              href={`https://testnet.xrpl.org/accounts/${buyerAddress}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-DEFAULT hover:text-white font-mono transition-colors"
            >
              View DID on XRPL ↗
            </a>
          </div>
        )}
        {taskDone && (
          <div className="animate-slide-up">
            <Field label="Task" value="Fetch ETH/USD price · return JSON" mono={false} />
            <div className="mt-2 bg-surface border border-border rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1.5">Expected Schema</p>
              <pre className="text-xs font-mono text-emerald-DEFAULT leading-relaxed">
{`{
  asset:     string,
  price:     number,
  timestamp: string
}`}
              </pre>
            </div>
          </div>
        )}
        {escrowDone && (
          <div className="animate-slide-up space-y-3">
            <Field label="Escrow Sequence" value={String(escrowSeq)} />
            <Field label="Escrow Tx"       value={escrowTxHash.slice(0, 20) + '…'} />
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-DEFAULT hover:text-white font-mono transition-colors"
            >
              View on XRPL Explorer ↗
            </a>
          </div>
        )}
        {finishedDone && (
          <div className="animate-slide-up mt-2 rounded-lg border border-emerald-DEFAULT/30 bg-emerald-DEFAULT/5 p-3">
            <p className="text-xs text-emerald-DEFAULT font-mono">✓ Escrow settled · funds released to worker</p>
          </div>
        )}
      </div>
    </div>
  );
}
