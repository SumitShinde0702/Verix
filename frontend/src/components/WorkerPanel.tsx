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
          ${done ? 'bg-emerald-DEFAULT text-void shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'border border-border text-slate-600'}`}
      >
        {done ? '✓' : '·'}
      </span>
      <span className={`transition-colors duration-300 ${done ? 'text-slate-200' : 'text-slate-600'}`}>{label}</span>
    </div>
  );
}

export default function WorkerPanel({ events, isRunning }: Props) {
  const has = (step: string, status?: string) =>
    events.some((e) => e.step === step && (!status || e.status === status));

  const getDataField = (step: string, field: string): string => {
    const ev = events.find((e) => e.step === step && e.status === 'completed');
    const val = ev?.data?.[field];
    if (val === undefined || val === null) return '—';
    return String(val);
  };

  const getOutput = (): Record<string, unknown> | null => {
    const ev = events.find((e) => e.step === 'api_called' && e.status === 'completed');
    return (ev?.data?.output as Record<string, unknown>) ?? null;
  };

  const agentsDone   = has('agents_created', 'completed');
  const didsDone     = has('dids_registered', 'completed');
  const apiDone      = has('api_called', 'completed');
  const signedDone   = has('output_signed', 'completed');
  const settledDone  = has('escrow_finished', 'completed');
  const auditDone    = has('audit_logged', 'completed');

  const workerAddress  = getDataField('agents_created', 'workerAddress');
  const workerBalance  = getDataField('agents_created', 'workerBalance');
  const workerDID      = getDataField('dids_registered', 'workerDID');
  const finishTxHash   = getDataField('escrow_finished', 'txHash');
  const explorerUrl    = getDataField('escrow_finished', 'explorerUrl');
  const complianceScore = getDataField('escrow_finished', 'complianceScore');

  const output = getOutput();

  const isActive = isRunning || agentsDone;

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border transition-all duration-700
        ${isActive ? 'border-emerald-DEFAULT/40 bg-card shadow-glow-emerald' : 'border-border bg-card'}
      `}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base
              ${isActive ? 'bg-emerald-DEFAULT/10 border border-emerald-DEFAULT/50' : 'bg-surface border border-border'}`}
          >
            🤖
          </div>
          <div>
            <h2 className={`font-semibold text-sm ${isActive ? 'text-emerald-DEFAULT' : 'text-slate-400'}`}>
              WORKER AGENT
            </h2>
            <p className="text-xs text-slate-600">Fetches data · Returns signed output</p>
          </div>
          {isRunning && !settledDone && (
            <div className="ml-auto flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-DEFAULT animate-pulse-slow"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          )}
          {settledDone && (
            <div className="ml-auto text-xs font-mono text-emerald-DEFAULT bg-emerald-DEFAULT/10 border border-emerald-DEFAULT/30 rounded px-2 py-0.5">
              PAID
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 py-4 border-b border-border space-y-2.5">
        <StepRow label="Wallet created + DID registered"     done={didsDone} />
        <StepRow label="Pick up task from buyer"             done={has('escrow_created', 'completed')} />
        <StepRow label="Call CoinGecko API"                  done={apiDone} />
        <StepRow label="Sign output with DID private key"    done={signedDone} />
        <StepRow label="Receive 1 XRP via EscrowFinish"      done={settledDone} />
      </div>

      {/* Data */}
      <div className="px-5 py-4 flex-1 overflow-auto space-y-4">
        {agentsDone && (
          <div className="animate-slide-up space-y-3">
            <Field label="Address" value={workerAddress} />
            <Field label="Balance" value={workerBalance} />
          </div>
        )}
        {didsDone && (
          <div className="animate-slide-up space-y-1">
            <Field label="DID (XLS-40)" value={workerDID} />
            <a
              href={`https://testnet.xrpl.org/accounts/${workerAddress}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-DEFAULT hover:text-white font-mono transition-colors"
            >
              View DID on XRPL ↗
            </a>
          </div>
        )}
        {output && apiDone && (
          <div className="animate-slide-up">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">API Response</p>
            <div className="bg-surface border border-border rounded-lg p-3">
              <pre className="text-sm font-mono text-emerald-DEFAULT leading-relaxed">
{JSON.stringify(output, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 font-mono">Source: api.coingecko.com</p>
          </div>
        )}
        {signedDone && (
          <div className="animate-slide-up">
            <div className="rounded-lg border border-amber-DEFAULT/30 bg-amber-DEFAULT/5 p-3">
              <p className="text-xs font-mono text-amber-DEFAULT">
                ✎ Output signed with DID key (HMAC-SHA256)
              </p>
              <p className="text-xs text-slate-600 mt-1">__sig field embedded in payload</p>
            </div>
          </div>
        )}
        {settledDone && (
          <div className="animate-fade-in space-y-3">
            <div className="rounded-xl border border-emerald-DEFAULT/30 bg-emerald-DEFAULT/5 p-4">
              <p className="text-xs font-semibold text-emerald-DEFAULT mb-3">✓ 1 XRP received from escrow</p>
              <div className="space-y-2">
                <Field label="Settlement Tx" value={finishTxHash.slice(0, 20) + '…'} />
                {complianceScore && (
                  <Field label="Compliance Score" value={`${complianceScore}/100`} mono={false} />
                )}
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-DEFAULT hover:text-white font-mono transition-colors"
                >
                  View EscrowFinish on XRPL ↗
                </a>
              )}
            </div>
          </div>
        )}
        {auditDone && (
          <div className="animate-fade-in rounded-lg border border-violet-DEFAULT/20 bg-violet-DEFAULT/5 p-3">
            <p className="text-xs font-mono text-violet-DEFAULT">
              ◈ Reputation score updated on-chain
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
