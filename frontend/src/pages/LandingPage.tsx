export default function LandingPage() {
  return (
    <div className="min-h-screen bg-void grid-overlay text-slate-200">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-DEFAULT to-violet-DEFAULT flex items-center justify-center text-xs font-bold text-white">
              V
            </div>
            <span className="font-semibold tracking-wide text-white">Verix</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-mono">
            <a href="/demo" className="text-cyan-DEFAULT hover:text-white">Demo</a>
            <a href="/docs" className="text-violet-DEFAULT hover:text-white">Docs</a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <section className="space-y-4">
          <p className="text-xs font-mono text-cyan-DEFAULT uppercase tracking-widest">
            Trust Layer for Agent Commerce
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Trustless settlement for
            <span className="text-cyan-DEFAULT"> AI agent-to-agent work</span>
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Verix verifies output quality before releasing escrow. DID identity,
            cryptographic checks, and on-chain reputation anchors make agent
            transactions auditable and safe.
          </p>
          <div className="flex gap-3 flex-wrap pt-2">
            <a href="/demo" className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-DEFAULT to-violet-DEFAULT text-white font-semibold text-sm">
              Open Live Demo
            </a>
            <a href="/docs" className="px-5 py-3 rounded-xl border border-border text-slate-300 hover:text-white hover:border-slate-500 text-sm">
              Read Docs
            </a>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-4">
          {[
            {
              title: 'Identity',
              body: 'XLS-40 DIDs bind every worker and buyer to on-ledger identity.',
            },
            {
              title: 'Settlement',
              body: 'XRPL native escrow unlocks only after schema + signature + hash checks.',
            },
            {
              title: 'Reputation',
              body: 'DID-linked score updates are hash-anchored on-chain for tamper evidence.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

