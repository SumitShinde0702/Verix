import type { DemoEvent } from '../types';

interface Props {
  role: 'buyer' | 'verix' | 'worker';
  events: DemoEvent[];
}

const CONFIG = {
  buyer: {
    icon: '🤖',
    label: 'BUYER AGENT',
    sub: 'Posts task · Locks escrow',
    color: 'cyan',
    badge: { label: 'LOCKED',   step: 'escrow_created'  as const },
    settle: { label: 'SETTLED', step: 'escrow_finished' as const },
  },
  verix: {
    icon: '⬡',
    label: 'VERIX',
    sub: 'Validates · Settles · Logs',
    color: 'violet',
    badge: { label: 'VERIFIED', step: 'hash_validated'  as const },
    settle: null,
  },
  worker: {
    icon: '🤖',
    label: 'WORKER AGENT',
    sub: 'Fetches data · Gets paid',
    color: 'emerald',
    badge: { label: 'PAID',     step: 'escrow_finished' as const },
    settle: null,
  },
} as const;

const colorClass = {
  cyan:    { text: 'text-cyan-DEFAULT',    border: 'border-cyan-DEFAULT/40',    bg: 'bg-cyan-glow',    badge: 'text-cyan-DEFAULT bg-cyan-glow border-cyan-DEFAULT/30' },
  violet:  { text: 'text-violet-DEFAULT',  border: 'border-violet-DEFAULT/40',  bg: 'bg-violet-glow',  badge: 'text-violet-DEFAULT bg-violet-glow border-violet-DEFAULT/30' },
  emerald: { text: 'text-emerald-DEFAULT', border: 'border-emerald-DEFAULT/40', bg: 'bg-emerald-DEFAULT/10', badge: 'text-emerald-DEFAULT bg-emerald-DEFAULT/10 border-emerald-DEFAULT/30' },
};

export default function AgentCard({ role, events }: Props) {
  const cfg   = CONFIG[role];
  const cls   = colorClass[cfg.color];
  const has   = (step: string) => events.some((e) => e.step === step && e.status === 'completed');
  const field = (step: string, key: string) => {
    const ev = events.find((e) => e.step === step && e.status === 'completed');
    return (ev?.data?.[key] as string) ?? '';
  };

  const badgeDone   = has(cfg.badge.step);
  const settleDone  = cfg.settle ? has(cfg.settle.step) : false;

  const address =
    role === 'buyer'  ? field('agents_created', 'buyerAddress')  :
    role === 'worker' ? field('agents_created', 'workerAddress') : '';

  const isActive = events.some((e) =>
    role === 'buyer'  ? ['agents_created','task_posted','escrow_created'].includes(e.step) :
    role === 'verix'  ? ['schema_validated','sig_validated','hash_validated'].includes(e.step) :
    ['api_called','output_signed','escrow_finished'].includes(e.step)
  );

  return (
    <div className={`rounded-xl border transition-all duration-500 p-4
      ${isActive ? `${cls.border} ${cls.bg}` : 'border-border bg-card'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold tracking-widest ${isActive ? cls.text : 'text-slate-500'}`}>
            {cfg.label}
          </p>
          <p className="text-xs text-slate-600 truncate">{cfg.sub}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {badgeDone && (
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${cls.badge}`}>
              {cfg.badge.label}
            </span>
          )}
          {settleDone && role === 'buyer' && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded border text-slate-400 bg-surface border-border">
              SETTLED
            </span>
          )}
        </div>
      </div>
      {address && (
        <p className="text-xs font-mono text-slate-600 truncate">{address}</p>
      )}
      {role === 'verix' && badgeDone && (
        <p className="text-xs font-mono text-emerald-DEFAULT">3/3 checks passed</p>
      )}
    </div>
  );
}
