import { ArrowRight, Eye, FileCheck2, Gauge, Scissors, ShieldCheck, Wallet, Zap } from 'lucide-react';
import { HealthMeter } from '../components/HealthMeter';
import { ExternalA, LiveDot, Logo, Skeleton } from '../components/ui';
import { useBlockNumber, useMarkets } from '../lib/hooks';
import { useWallet } from '../lib/wallet';
import { fmtUsd } from '../lib/format';
import { DEFAULT_THRESHOLDS, DREAMDEX_URL, PROOF_URL, REPO_URL } from '../lib/somnia';

function LiveStats() {
  const block = useBlockNumber();
  const markets = useMarkets();
  const oi = markets.data?.reduce((sum, m) => sum + (m.openInterestUsd ?? 0), 0);
  const stats = [
    { label: 'Latest block', value: block.data !== null ? `#${block.data.toLocaleString()}` : null },
    { label: 'Perp markets guarded', value: markets.data ? String(markets.data.length) : null },
    { label: 'Open interest', value: oi !== undefined ? fmtUsd(oi) : null },
    { label: 'Block time', value: '10 ms' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface px-5 py-4">
          <dt className="label">{s.label}</dt>
          <dd className="num mt-1 text-xl font-semibold">{s.value ?? <Skeleton className="mt-1 h-6 w-24" />}</dd>
        </div>
      ))}
    </dl>
  );
}

function HeroPreview() {
  const ratio = 1.42;
  return (
    <div className="card relative p-5 shadow-2xl shadow-accent/10 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="label">Example account</span>
        <span className="rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">Trim zone</span>
      </div>
      <p className="num mt-3 text-5xl font-bold text-warn">
        {ratio.toFixed(2)}
        <span className="text-2xl text-muted">x</span>
      </p>
      <p className="mt-1 text-sm text-muted">Equity over maintenance margin</p>
      <div className="mt-8">
        <HealthMeter ratio={ratio} {...DEFAULT_THRESHOLDS} />
      </div>
      <div className="mt-6 space-y-2 rounded-xl border border-border bg-bg/60 p-3 text-sm">
        <div className="flex items-center gap-2 text-warn">
          <Scissors className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold">Sentinel trimmed ETH-PERP by 25%</span>
        </div>
        <p className="num text-xs text-muted">SELL 0.025 ETH · reduce-only IOC · health back to 1.89x</p>
      </div>
      <p className="mt-3 text-xs text-muted">Illustration. Connect a wallet to see your live account.</p>
    </div>
  );
}

const STEPS = [
  { icon: Wallet, title: 'Connect your wallet', body: 'ApexPerp reads your dreamDEX cross-margin account straight from the MarginBank contract on Somnia Tokyo testnet.' },
  { icon: Gauge, title: 'See your real distance to liquidation', body: 'Live health, and the exact mark price at which each position would trim, close or liquidate.' },
  { icon: ShieldCheck, title: 'Let the Sentinel act first', body: 'When health crosses your threshold it sends reduce-only market orders, so it can shrink a position but never open or flip one.' },
];

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  const { connect, connecting, error, hasProvider } = useWallet();

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 md:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">
              <LiveDot /> Live on Somnia Tokyo testnet · dreamDEX perps
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Trim before you get <span className="text-accent">liquidated.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              ApexPerp watches your dreamDEX margin health and cuts exposure with reduce-only orders the moment it slips, so a wick costs you a trim instead of your whole position.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn-primary h-12 px-6 text-base"
                disabled={connecting}
                onClick={async () => (await connect()) && onLaunch()}
              >
                <Wallet className="h-5 w-5" aria-hidden="true" />
                {connecting ? 'Check your wallet…' : hasProvider ? 'Connect wallet' : 'Install a wallet to connect'}
              </button>
              <button type="button" className="btn-secondary h-12 px-6 text-base" onClick={onLaunch}>
                <Eye className="h-5 w-5" aria-hidden="true" />
                Watch any address
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <p className="mt-4 text-sm text-muted">
              No account yet? Join the Perps Arena on <ExternalA href={DREAMDEX_URL} className="text-fg">dreamDEX</ExternalA> for weekly paper USDso.
            </p>
          </div>
          <HeroPreview />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-20">
          <LiveStats />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="label text-accent">How it works</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Three steps between you and a liquidation.</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="num text-sm text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rules */}
      <section id="rules" className="scroll-mt-20 border-t border-border/60 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <p className="label text-accent">The rules</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Simple, predictable, on-chain.</h2>
            <p className="mt-4 text-muted">
              Health is your account equity divided by its maintenance-margin requirement, read from the MarginBank contract. At 1.00x the protocol can liquidate you. The Sentinel steps in well before that.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { tone: 'border-safe/30 bg-safe/5', dot: 'bg-safe', title: `Above ${DEFAULT_THRESHOLDS.reduceBelowHealth.toFixed(2)}x`, body: 'Nothing happens. You trade as usual.' },
              { tone: 'border-warn/30 bg-warn/5', dot: 'bg-warn', title: `At or below ${DEFAULT_THRESHOLDS.reduceBelowHealth.toFixed(2)}x`, body: `Trim every open position by ${DEFAULT_THRESHOLDS.reducePercentage}% with a reduce-only market order.` },
              { tone: 'border-danger/30 bg-danger/5', dot: 'bg-danger', title: `At or below ${DEFAULT_THRESHOLDS.flattenBelowHealth.toFixed(2)}x`, body: 'Close every position before the liquidation engine gets to it.' },
            ].map((r) => (
              <div key={r.title} className={`flex gap-4 rounded-2xl border p-5 ${r.tone}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${r.dot}`} aria-hidden="true" />
                <div>
                  <p className="num font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-muted">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="scroll-mt-20 border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="card flex flex-col items-start justify-between gap-8 p-8 md:flex-row md:items-center md:p-10">
            <div className="max-w-xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <FileCheck2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Every action is a transaction you can check.</h2>
              <p className="mt-3 text-muted">
                The Sentinel logs each order it sends with its hash, block and status. Nothing is simulated: verify any of them against the Somnia Tokyo RPC.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <a className="btn-primary h-12 px-6" href={PROOF_URL} target="_blank" rel="noreferrer">
                View the proof log <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a className="btn-secondary h-12 px-6" href={REPO_URL} target="_blank" rel="noreferrer">
                Read the code
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 py-20 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <Zap className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Check your health in ten seconds.</h2>
          <p className="mt-3 text-muted">Connect a wallet, or paste any dreamDEX address to watch it.</p>
          <button type="button" className="btn-primary mt-8 h-12 px-8 text-base" onClick={onLaunch}>
            Launch app <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted sm:flex-row">
          <Logo />
          <p>Built for the dreamDEX Perps Builder Bounty on Somnia.</p>
          <ExternalA href={REPO_URL}>GitHub</ExternalA>
        </div>
      </footer>
    </main>
  );
}
