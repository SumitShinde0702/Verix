import type { DemoEvent, DemoStepId } from '../types';

interface Props {
  events: DemoEvent[];
}

interface StepMeta {
  id: DemoStepId;
  actor: string;
  actorLabel: string;
  actorColor: string;
  label: string;
  sublabel: string;
  /** If true, only render this step when an event is actually received for it */
  conditional?: boolean;
}

const STEPS: StepMeta[] = [
  {
    id: 'agents_created',
    actor: '🤖',
    actorLabel: 'BUYER + WORKER',
    actorColor: 'text-cyan-DEFAULT',
    label: 'Agents created & funded',
    sublabel: 'New wallets generated, funded from XRPL testnet faucet',
  },
  {
    id: 'dids_registered',
    actor: '🔑',
    actorLabel: 'XRPL LEDGER',
    actorColor: 'text-slate-400',
    label: 'XLS-40 DIDs registered on-chain',
    sublabel: 'DIDSet transactions confirmed — agents have persistent on-chain identity',
  },
  {
    id: 'ai_decision',
    actor: '🧠',
    actorLabel: 'DEEPSEEK LLM',
    actorColor: 'text-amber-DEFAULT',
    label: 'AI agent interprets request & selects asset',
    sublabel: 'LLM maps your natural-language request to a specific price feed and issues a hiring decision',
  },
  {
    id: 'task_posted',
    actor: '🤖',
    actorLabel: 'BUYER AGENT',
    actorColor: 'text-cyan-DEFAULT',
    label: 'Task posted — crypto condition computed',
    sublabel: 'Expected output schema hashed to build PREIMAGE-SHA-256 escrow condition',
  },
  {
    id: 'escrow_created',
    actor: '🔒',
    actorLabel: 'XRPL LEDGER',
    actorColor: 'text-slate-400',
    label: '1 XRP locked in XRPL native escrow',
    sublabel: 'EscrowCreate confirmed — funds unreachable until fulfillment is provided',
  },
  {
    id: 'api_called',
    actor: '🌐',
    actorLabel: 'WORKER AGENT',
    actorColor: 'text-emerald-DEFAULT',
    label: 'CoinGecko API called — live price fetched',
    sublabel: 'Live price from api.coingecko.com/api/v3',
  },
  {
    id: 'output_signed',
    actor: '✍️',
    actorLabel: 'WORKER AGENT',
    actorColor: 'text-emerald-DEFAULT',
    label: 'Output signed with DID private key',
    sublabel: 'HMAC-SHA256 signature embedded as __sig — proves worker identity',
  },
  {
    id: 'schema_validated',
    actor: '⬡',
    actorLabel: 'VERIX',
    actorColor: 'text-violet-DEFAULT',
    label: 'Layer 1 — JSON Schema validated',
    sublabel: 'AJV confirms output matches expected { asset, price, timestamp } structure',
  },
  {
    id: 'sig_validated',
    actor: '⬡',
    actorLabel: 'VERIX',
    actorColor: 'text-violet-DEFAULT',
    label: 'Layer 2 — DID signature verified',
    sublabel: 'HMAC matches worker seed — output is authentically from the hired agent',
  },
  {
    id: 'hash_validated',
    actor: '⬡',
    actorLabel: 'VERIX',
    actorColor: 'text-violet-DEFAULT',
    label: 'Layer 3 — Hash condition confirmed',
    sublabel: 'SHA-256(preimage) matches escrow fingerprint — trustless proof complete',
  },
  {
    id: 'escrow_finished',
    actor: '💸',
    actorLabel: 'XRPL LEDGER',
    actorColor: 'text-slate-400',
    label: 'EscrowFinish — 1 XRP released to worker',
    sublabel: 'Funds released automatically by the ledger, no human required',
  },
  {
    id: 'audit_logged',
    actor: '📋',
    actorLabel: 'VERIX',
    actorColor: 'text-violet-DEFAULT',
    label: 'Audit trail written on-chain',
    sublabel: 'Immutable memo anchored to XRPL — proof of settlement available forever',
  },
  {
    id: 'funds_protected',
    actor: '🛡️',
    actorLabel: 'VERIX',
    actorColor: 'text-rose-DEFAULT',
    label: 'Escrow still locked — buyer funds protected',
    sublabel: 'Bad output blocked. EscrowFinish not submitted. Worker receives nothing.',
    conditional: true,
  },
];

function DataBlock({ data, step }: { data: Record<string, unknown>; step: DemoStepId }) {
  if (!data || Object.keys(data).length === 0) return null;

  // Render specialised views for key steps
  if (step === 'ai_decision') {
    return (
      <div className="mt-2 bg-surface border border-amber-DEFAULT/20 rounded-lg p-3 space-y-2">
        {/* User request */}
        {!!data.userQuery && (
          <div className="flex items-start gap-2 pb-2 border-b border-border">
            <span className="text-xs font-mono text-slate-500 flex-shrink-0">User request</span>
            <p className="text-xs text-slate-200 italic">&quot;{String(data.userQuery)}&quot;</p>
          </div>
        )}

        {/* AI chosen asset + model */}
        <div className="flex items-center gap-3 flex-wrap">
          {!!data.symbol && (
            <span className="text-sm font-bold text-amber-DEFAULT">
              {String(data.symbol)}/USD
            </span>
          )}
          <span className="text-xs font-mono text-amber-DEFAULT/60 uppercase tracking-wider">
            {String(data.model ?? 'deepseek-chat')}
          </span>
          {!!data.confidence && (
            <span className="text-xs font-mono text-slate-500">
              {String(data.confidence)}% confidence
            </span>
          )}
        </div>

        {/* Reasoning */}
        <p className="text-xs text-slate-300 leading-relaxed italic">
          &quot;{String(data.reasoning ?? '')}&quot;
        </p>

        {/* Task description */}
        {!!data.taskDescription && (
          <div className="border-t border-border pt-2">
            <p className="text-xs text-slate-500 mb-0.5">Task issued to worker:</p>
            <p className="text-xs font-mono text-cyan-DEFAULT">→ {String(data.taskDescription)}</p>
          </div>
        )}
      </div>
    );
  }

  if (step === 'agents_created') {
    return (
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Buyer Agent</p>
          <p className="text-xs font-mono text-cyan-DEFAULT truncate">{data.buyerAddress as string}</p>
          <p className="text-xs text-slate-400">{data.buyerBalance as string}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Worker Agent</p>
          <p className="text-xs font-mono text-emerald-DEFAULT truncate">{data.workerAddress as string}</p>
          <p className="text-xs text-slate-400">{data.workerBalance as string}</p>
        </div>
      </div>
    );
  }

  if (step === 'dids_registered') {
    return (
      <div className="mt-2 space-y-1.5">
        <DataRow label="Buyer DID"  value={data.buyerDID  as string} href={`https://testnet.xrpl.org/accounts/${(data.buyerDID as string)?.split(':').pop()}`} />
        <DataRow label="Worker DID" value={data.workerDID as string} href={`https://testnet.xrpl.org/accounts/${(data.workerDID as string)?.split(':').pop()}`} />
      </div>
    );
  }

  if (step === 'escrow_created') {
    return (
      <div className="mt-2 space-y-1.5">
        <DataRow label="Sequence"  value={String(data.escrowSequence)} />
        <DataRow label="Tx"        value={(data.escrowTxHash as string)?.slice(0, 24) + '…'} href={data.explorerUrl as string} />
        <p className="text-xs font-mono text-cyan-DEFAULT">
          Condition: <span className="text-slate-400">{(data.conditionHex as string)}</span>
        </p>
      </div>
    );
  }

  if (step === 'api_called') {
    const output = data.output as Record<string, unknown>;
    return (
      <div className="mt-2 bg-surface border border-border rounded-lg p-3">
        <pre className="text-sm font-mono text-emerald-DEFAULT leading-relaxed">
{JSON.stringify(output, null, 2)}
        </pre>
        <p className="text-xs text-slate-600 mt-1">Source: api.coingecko.com</p>
      </div>
    );
  }

  if (step === 'funds_protected') {
    const failedAt = data.failedAt as string | undefined;
    const layerName =
      failedAt === 'schema'    ? 'Layer 1 — JSON Schema' :
      failedAt === 'signature' ? 'Layer 2 — DID Signature' :
      failedAt === 'hash'      ? 'Layer 3 — Hash Condition' : 'Validation';
    return (
      <div className="mt-2 bg-rose-DEFAULT/5 border border-rose-DEFAULT/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-rose-DEFAULT">Blocked by: {layerName}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500">Worker paid</p>
            <p className="text-sm font-bold text-rose-DEFAULT">0 XRP</p>
          </div>
          <div className="bg-surface rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500">Escrow status</p>
            <p className="text-sm font-bold text-amber-DEFAULT">LOCKED</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'schema_validated' && data.failedAt) {
    return (
      <div className="mt-2 bg-rose-DEFAULT/5 border border-rose-DEFAULT/20 rounded-lg p-3 space-y-1.5">
        {!!data.expected && <DataRow label="Expected" value={String(data.expected)} />}
        {!!data.received && <DataRow label="Got"      value={String(data.received)} />}
      </div>
    );
  }

  if (step === 'escrow_finished') {
    return (
      <div className="mt-2 space-y-1.5">
        <DataRow label="Settlement Tx"    value={(data.txHash as string)?.slice(0, 24) + '…'} href={`https://testnet.xrpl.org/transactions/${data.txHash as string}`} />
        <DataRow label="Compliance Score" value={`${data.complianceScore as string}/100`} />
      </div>
    );
  }

  if (step === 'audit_logged') {
    return (
      <div className="mt-2 space-y-1.5">
        {!!data.auditUrl && <DataRow label="Audit Memo" value="View on XRPL explorer" href={data.auditUrl as string} />}
        <p className="text-xs font-mono text-slate-500">{data.summary as string}</p>
      </div>
    );
  }

  return null;
}

function DataRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-slate-500 flex-shrink-0 w-28">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer"
          className="font-mono text-cyan-DEFAULT hover:text-white truncate transition-colors">
          {value} ↗
        </a>
      ) : (
        <span className="font-mono text-slate-300 truncate">{value}</span>
      )}
    </div>
  );
}

export default function StoryFeed({ events }: Props) {
  // Build a map of latest event per step
  const eventMap = new Map<DemoStepId, DemoEvent>();
  for (const ev of events) {
    eventMap.set(ev.step, ev);
  }

  // Determine which steps are visible (at least one event for that step)
  const visibleStepIds = new Set(events.map((e) => e.step));

  return (
    <div className="space-y-0">
      {STEPS.map((step, idx) => {
        const ev = eventMap.get(step.id);

        // Conditional steps (e.g. funds_protected) only render when an event arrives
        if (step.conditional && !ev) return null;

        if (!ev && !visibleStepIds.has(step.id)) {
          // Hide non-conditional future steps after a failure.
          // We only want to show follow-up events that were actually emitted
          // (e.g. funds_protected), not stale pending validation layers.
          const prevStatus = idx > 0 ? eventMap.get(STEPS[idx - 1].id)?.status : 'completed';
          if (!prevStatus || prevStatus === 'failed') return null;
        }

        const status = ev?.status ?? 'pending';

        return (
          <div key={step.id} className="relative">
            {/* Connector line */}
            {idx > 0 && (
              <div className={`absolute left-[23px] -top-3 w-px h-3 transition-colors duration-500
                ${status === 'completed' ? 'bg-emerald-DEFAULT/40' :
                  status === 'failed'    ? 'bg-rose-DEFAULT/40' :
                  'bg-border'}`}
              />
            )}

            <div className={`flex gap-4 p-3 rounded-xl transition-all duration-500 animate-slide-up
              ${status === 'completed' ? 'bg-surface/60' :
                status === 'running'   ? 'bg-violet-DEFAULT/5 border border-violet-DEFAULT/20' :
                status === 'failed'    ? 'bg-rose-DEFAULT/5 border border-rose-DEFAULT/20' :
                'opacity-40'
              }`}
            >
              {/* Status indicator */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-0.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 flex-shrink-0
                  ${status === 'completed' ? 'bg-emerald-DEFAULT text-void shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                    status === 'running'   ? 'bg-violet-DEFAULT/20 border border-violet-DEFAULT text-violet-DEFAULT animate-pulse' :
                    status === 'failed'    ? 'bg-rose-DEFAULT text-void' :
                    'bg-surface border border-border text-slate-700'
                  }`}
                >
                  {status === 'completed' ? '✓' :
                   status === 'running'   ? '⟳' :
                   status === 'failed'    ? '✗' :
                   String(idx + 1)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${step.actorColor}`}>
                    {step.actor} {step.actorLabel}
                  </span>
                  <span className="text-slate-700 text-xs">·</span>
                  <span className={`text-sm font-medium
                    ${status === 'completed' ? 'text-slate-200' :
                      status === 'running'   ? 'text-violet-DEFAULT' :
                      status === 'failed'    ? 'text-rose-DEFAULT' :
                      'text-slate-600'}`}
                  >
                    {/* For api_called / ai_decision, prefer the live message which contains the actual coin */}
                    {(status === 'completed' && ev?.message &&
                      (step.id === 'api_called' || step.id === 'ai_decision'))
                      ? ev.message
                      : step.label}
                  </span>
                  {status === 'running' && (
                    <span className="flex gap-0.5">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1 h-1 rounded-full bg-violet-DEFAULT animate-pulse-slow"
                          style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {status === 'failed' && ev?.message
                    ? 'Validation failed for this layer.'
                    : step.sublabel}
                </p>

                {/* Data block for completed AND failed steps */}
                {(status === 'completed' || status === 'failed') && ev?.data && (
                  <DataBlock data={ev.data} step={step.id} />
                )}
                {status === 'failed' && ev?.message && (
                  <p className="text-xs font-mono text-rose-DEFAULT mt-1">{ev.message}</p>
                )}
              </div>

              {/* Timestamp */}
              {ev?.timestamp && (
                <span className="text-xs font-mono text-slate-700 flex-shrink-0 self-start mt-1">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
