import type { FailAt } from '../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  failAt: FailAt;
  onFailAtChange: (v: FailAt) => void;
  disabled: boolean;
}

const ASSET_CHIPS = [
  { label: 'ETH',  query: 'Get me the Ethereum price' },
  { label: 'BTC',  query: 'What is the Bitcoin price right now?' },
  { label: 'SOL',  query: 'Fetch the Solana price' },
  { label: 'XRP',  query: 'Get me the XRP price' },
  { label: 'AVAX', query: 'What is AVAX trading at?' },
  { label: 'LINK', query: 'Fetch Chainlink price data' },
  { label: 'ADA',  query: 'Get the Cardano price' },
  { label: 'DOT',  query: 'What is Polkadot worth?' },
];

const WORKER_MODES: { id: FailAt; label: string; sublabel: string; color: string }[] = [
  {
    id:       'none',
    label:    'Honest worker',
    sublabel: 'Returns correct output — escrow releases',
    color:    'emerald',
  },
  {
    id:       'schema',
    label:    'Bad schema',
    sublabel: 'Wrong field names — Layer 1 (AJV) catches it',
    color:    'rose',
  },
  {
    id:       'signature',
    label:    'Forged signature',
    sublabel: 'Signed with wrong key — Layer 2 (HMAC) catches it',
    color:    'rose',
  },
];

export default function QueryInput({ value, onChange, failAt, onFailAtChange, disabled }: Props) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      {/* Text input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
          🧠
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g. Get me the Bitcoin price"
          className={`w-full bg-card border rounded-xl pl-10 pr-4 py-3.5 text-sm text-slate-200
            placeholder:text-slate-600 outline-none transition-all duration-200
            ${disabled
              ? 'border-border cursor-not-allowed opacity-50'
              : 'border-border focus:border-cyan-DEFAULT/60 focus:shadow-glow-cyan'
            }`}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <span className="text-xs font-mono text-slate-600">AI request</span>
        </div>
      </div>

      {/* Asset chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {ASSET_CHIPS.map(({ label, query }) => (
          <button
            key={label}
            onClick={() => onChange(query)}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all duration-200
              ${disabled
                ? 'border-border text-slate-700 cursor-not-allowed'
                : value.toUpperCase().includes(label)
                  ? 'border-cyan-DEFAULT/60 bg-cyan-glow text-cyan-DEFAULT'
                  : 'border-border text-slate-500 hover:border-slate-500 hover:text-slate-300'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Worker mode selector */}
      <div className="border-t border-border pt-4 space-y-2">
        <p className="text-xs font-mono text-slate-500 text-center uppercase tracking-widest">
          Worker behaviour
        </p>
        <div className="grid grid-cols-3 gap-2">
          {WORKER_MODES.map((mode) => {
            const active = failAt === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onFailAtChange(mode.id)}
                disabled={disabled}
                className={`rounded-xl border p-3 text-left transition-all duration-200
                  ${disabled ? 'cursor-not-allowed opacity-40' : ''}
                  ${active
                    ? mode.color === 'emerald'
                      ? 'border-emerald-DEFAULT/60 bg-emerald-DEFAULT/10'
                      : 'border-rose-DEFAULT/60 bg-rose-DEFAULT/10'
                    : 'border-border hover:border-slate-500'
                  }`}
              >
                <p className={`text-xs font-semibold mb-0.5
                  ${active
                    ? mode.color === 'emerald' ? 'text-emerald-DEFAULT' : 'text-rose-DEFAULT'
                    : 'text-slate-400'}`}
                >
                  {mode.id === 'none' ? '✓' : '✗'} {mode.label}
                </p>
                <p className="text-xs text-slate-600 leading-tight">{mode.sublabel}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
