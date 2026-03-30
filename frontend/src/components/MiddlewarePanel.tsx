import type { DemoEvent } from '../types';

interface Props {
  events: DemoEvent[];
  isRunning: boolean;
}

interface CheckProps {
  label: string;
  sublabel: string;
  state: 'idle' | 'running' | 'pass' | 'fail';
  delay?: string;
}

function ValidationCheck({ label, sublabel, state, delay = '0ms' }: CheckProps) {
  const iconClass = {
    idle:    'w-7 h-7 rounded-full border-2 border-border text-slate-700',
    running: 'w-7 h-7 rounded-full border-2 border-violet-DEFAULT bg-violet-glow text-violet-DEFAULT animate-pulse',
    pass:    'w-7 h-7 rounded-full bg-emerald-DEFAULT text-void shadow-[0_0_12px_rgba(16,185,129,0.7)]',
    fail:    'w-7 h-7 rounded-full bg-rose-DEFAULT text-void',
  }[state];

  const icon = { idle: '·', running: '⟳', pass: '✓', fail: '✗' }[state];

  return (
    <div
      className="flex items-start gap-4 animate-fade-in"
      style={{ animationDelay: delay }}
    >
      <div className={`flex-shrink-0 flex items-center justify-center font-bold text-sm transition-all duration-500 ${iconClass}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium transition-colors duration-300 ${state === 'pass' ? 'text-emerald-DEFAULT' : state === 'fail' ? 'text-rose-DEFAULT' : state === 'running' ? 'text-violet-DEFAULT' : 'text-slate-600'}`}>
          {label}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

function PipeArrow({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center my-1">
      <div className={`w-px h-5 transition-colors duration-500 ${active ? 'bg-violet-DEFAULT' : 'bg-border'}`} />
    </div>
  );
}

export default function MiddlewarePanel({ events, isRunning }: Props) {
  const has = (step: string, status?: string) =>
    events.some((e) => e.step === step && (!status || e.status === status));

  const schemaState = (): CheckProps['state'] => {
    if (has('schema_validated', 'completed')) return 'pass';
    if (has('schema_validated', 'failed'))   return 'fail';
    if (has('schema_validated', 'running'))  return 'running';
    return 'idle';
  };

  const sigState = (): CheckProps['state'] => {
    if (has('sig_validated', 'completed')) return 'pass';
    if (has('sig_validated', 'failed'))   return 'fail';
    if (schemaState() === 'pass' && !has('sig_validated')) return 'running';
    return 'idle';
  };

  const hashState = (): CheckProps['state'] => {
    if (has('hash_validated', 'completed')) return 'pass';
    if (has('hash_validated', 'failed'))   return 'fail';
    if (sigState() === 'pass' && !has('hash_validated')) return 'running';
    return 'idle';
  };

  const allPassed = schemaState() === 'pass' && sigState() === 'pass' && hashState() === 'pass';
  const settled   = has('escrow_finished', 'completed');
  const getEscrowTxHash = () => {
    const ev = events.find((e) => e.step === 'escrow_finished' && e.status === 'completed');
    return (ev?.data?.txHash as string) ?? '';
  };
  const getAuditUrl = () => {
    const ev = events.find((e) => e.step === 'audit_logged' && e.status === 'completed');
    return (ev?.data?.auditUrl as string) ?? '';
  };

  const isActive = isRunning || has('schema_validated');

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border transition-all duration-700
        ${isActive ? 'border-violet-DEFAULT/50 bg-card shadow-glow-violet' : 'border-border bg-card'}
      `}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base
              ${isActive ? 'bg-violet-glow border border-violet-DEFAULT/50' : 'bg-surface border border-border'}`}
          >
            ⬡
          </div>
          <div>
            <h2 className={`font-semibold text-sm ${isActive ? 'text-violet-DEFAULT text-glow-violet' : 'text-slate-400'}`}>
              VERIX MIDDLEWARE
            </h2>
            <p className="text-xs text-slate-600">Validates · Settles · Logs</p>
          </div>
          {isActive && !allPassed && (
            <div className="ml-auto flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-violet-DEFAULT animate-glow-pulse"
                  style={{ animationDelay: `${i * 300}ms` }}
                />
              ))}
            </div>
          )}
          {allPassed && (
            <div className="ml-auto text-xs font-mono text-emerald-DEFAULT bg-emerald-DEFAULT/10 border border-emerald-DEFAULT/30 rounded px-2 py-0.5">
              VERIFIED
            </div>
          )}
        </div>
      </div>

      {/* Core validation trinity */}
      <div className="px-5 py-5 border-b border-border">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-4">Validation Pipeline</p>
        <div className="space-y-0">
          <ValidationCheck
            label="JSON Schema"
            sublabel="AJV validates output structure matches expected schema"
            state={schemaState()}
          />
          <PipeArrow active={schemaState() === 'pass'} />
          <ValidationCheck
            label="DID Signature"
            sublabel="HMAC proves output is from the correct worker agent"
            state={sigState()}
            delay="100ms"
          />
          <PipeArrow active={sigState() === 'pass'} />
          <ValidationCheck
            label="Hash Condition"
            sublabel="SHA-256 output matches PREIMAGE-SHA-256 escrow condition"
            state={hashState()}
            delay="200ms"
          />
        </div>
      </div>

      {/* Live status log */}
      <div className="px-5 py-4 flex-1 overflow-auto space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Event Log</p>
        {events.length === 0 && (
          <p className="text-xs text-slate-700 font-mono">Awaiting demo start…</p>
        )}
        {events.map((ev, i) => (
          <div key={i} className="animate-slide-up flex items-start gap-2 text-xs font-mono">
            <span className={`flex-shrink-0 mt-0.5 ${
              ev.status === 'completed' ? 'text-emerald-DEFAULT' :
              ev.status === 'failed'    ? 'text-rose-DEFAULT' :
              'text-violet-DEFAULT'
            }`}>
              {ev.status === 'completed' ? '✓' : ev.status === 'failed' ? '✗' : '→'}
            </span>
            <span className="text-slate-400 leading-relaxed">{ev.message}</span>
          </div>
        ))}
      </div>

      {/* Settlement result */}
      {allPassed && settled && (
        <div className="px-5 pb-5 animate-fade-in">
          <div className="rounded-xl border border-emerald-DEFAULT/30 bg-emerald-DEFAULT/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-emerald-DEFAULT uppercase tracking-wider">
              ✓ Trustless settlement complete
            </p>
            {getEscrowTxHash() && (
              <a
                href={`https://testnet.xrpl.org/transactions/${getEscrowTxHash()}`}
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-mono text-cyan-DEFAULT hover:text-white truncate transition-colors"
              >
                EscrowFinish: {getEscrowTxHash().slice(0, 24)}… ↗
              </a>
            )}
            {getAuditUrl() && (
              <a
                href={getAuditUrl()}
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-mono text-violet-DEFAULT hover:text-white truncate transition-colors"
              >
                Audit memo on-chain ↗
              </a>
            )}
          </div>
        </div>
      )}
      {has('schema_validated', 'failed') && (
        <div className="px-5 pb-5 animate-fade-in">
          <div className="rounded-xl border border-rose-DEFAULT/30 bg-rose-DEFAULT/5 p-4">
            <p className="text-xs font-semibold text-rose-DEFAULT uppercase tracking-wider">
              ✗ Validation failed · Funds remain locked
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
