import { useMemo, useState } from 'react';
import { ArrowRight, Wallet } from 'lucide-react';
import { HealthMeter, ZONE_STYLE, zoneOf } from '../components/HealthMeter';
import { ExternalA, Logo, Skeleton } from '../components/ui';
import { useBlockNumber, useMarkets, useNetworkProtection } from '../lib/hooks';
import { useWallet } from '../lib/wallet';
import { fmtUsd } from '../lib/format';
import { DEFAULT_THRESHOLDS, DREAMDEX_URL, PROOF_URL, REPO_URL } from '../lib/somnia';

/* ---------- Breaker demo: a simplified 1 ETH long, replayed down to the dragged price ---------- */

const DEMO = { entry: 2400, size: 1, margin: 400, mmRate: 0.05, low: 1950, high: 2650 };

interface DemoEvent {
  kind: 'trim' | 'close' | 'liquidated';
  price: number;
  after?: number;
}

function replay(target: number, guarded: boolean) {
  const t = DEFAULT_THRESHOLDS;
  let cash = DEMO.margin;
  let size = DEMO.size;
  const events: DemoEvent[] = [];
  const equity = (p: number) => cash + size * (p - DEMO.entry);
  const health = (p: number) => (size === 0 ? null : equity(p) / (DEMO.mmRate * size * p));

  // Walk the price down a dollar at a time so every trip point fires in order.
  for (let p = DEMO.entry; p >= target && size > 0; p -= 1) {
    const h = health(p)!;
    if (!guarded) {
      if (h <= 1) {
        events.push({ kind: 'liquidated', price: p });
        cash = 0;
        size = 0;
      }
      continue;
    }
    if (h <= t.flattenBelowHealth) {
      cash = equity(p);
      size = 0;
      events.push({ kind: 'close', price: p });
    } else if (h <= t.reduceBelowHealth) {
      const cut = size * (t.reducePercentage / 100);
      cash += cut * (p - DEMO.entry);
      size -= cut;
      events.push({ kind: 'trim', price: p, after: health(p) ?? undefined });
    }
  }
  return { events, ratio: health(target), kept: size === 0 ? cash : equity(target) };
}

function BreakerDemo() {
  const [price, setPrice] = useState(DEMO.entry);
  const guarded = useMemo(() => replay(price, true), [price]);
  const bare = useMemo(() => replay(price, false), [price]);
  const zone = zoneOf(guarded.ratio, DEFAULT_THRESHOLDS);
  const last = guarded.events[guarded.events.length - 1];
  const liq = bare.events.find((e) => e.kind === 'liquidated');

  let status = 'All good. Nothing to do.';
  const trims = guarded.events.filter((e) => e.kind === 'trim').length;
  if (last?.kind === 'trim')
    status =
      trims === 1
        ? `Sold ${DEFAULT_THRESHOLDS.reducePercentage}% at $${last.price.toLocaleString()}. Health back up to ${last.after?.toFixed(2)}x.`
        : `Trimmed ${trims} times on the way down, last at $${last.price.toLocaleString()}. Still standing.`;
  if (last?.kind === 'close') status = `Closed everything at $${last.price.toLocaleString()} before liquidation could.`;

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
        <span className="label">Try it: drag the price down</span>
        <span className="num text-xs text-muted">1 ETH long · $400 margin</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label">ETH price</p>
            <p className="num mt-1 text-3xl font-semibold">${price.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="label">Health</p>
            <p className={`num mt-1 text-3xl font-semibold ${ZONE_STYLE[zone].text}`}>{guarded.ratio === null ? 'Closed' : `${guarded.ratio.toFixed(2)}x`}</p>
          </div>
        </div>

        <label htmlFor="demo-price" className="sr-only">
          ETH price
        </label>
        <input
          id="demo-price"
          type="range"
          className="fader mt-4"
          min={DEMO.low}
          max={DEMO.high}
          step={1}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />

        <div className="mt-2">
          <HealthMeter ratio={guarded.ratio} {...DEFAULT_THRESHOLDS} />
        </div>

        <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2">
          <div className="bg-surface p-3">
            <p className="label text-accent-ink">With ApexPerp</p>
            <p className="mt-1.5 text-sm leading-snug">{status}</p>
            <p className="num mt-2 text-sm text-muted">
              Margin left <span className="text-fg">{fmtUsd(Math.max(0, guarded.kept))}</span>
            </p>
          </div>
          <div className="bg-surface p-3">
            <p className="label">Without</p>
            <p className="mt-1.5 text-sm leading-snug">{liq ? `Liquidated at $${liq.price.toLocaleString()}. The penalty comes out of what's left.` : 'Still open, for now.'}</p>
            <p className="num mt-2 text-sm text-muted">
              Margin left <span className={liq ? 'text-danger' : 'text-fg'}>{liq ? '$0.00' : fmtUsd(bare.kept)}</span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">A simplified example with 5% maintenance margin, no fees or slippage.</p>
      </div>
    </div>
  );
}

/* ---------- Live chain numbers ---------- */

function LiveStats() {
  const block = useBlockNumber();
  const markets = useMarkets();
  const guard = useNetworkProtection();
  const oi = markets.data?.reduce((sum, m) => sum + (m.openInterestUsd ?? 0), 0);
  const stats = [
    { label: 'Latest block', value: block.data !== null ? `#${block.data.toLocaleString()}` : null },
    { label: 'Markets covered', value: markets.data ? String(markets.data.length) : null },
    { label: 'Open interest', value: oi !== undefined ? `$${(oi / 1e6).toFixed(1)}M` : null },
    { label: 'Stops guarding positions', value: guard.data ? guard.data.stops.toLocaleString() : null, sub: guard.data ? `${guard.data.traders.toLocaleString()} traders · $${(guard.data.coveredUsd / 1e6).toFixed(1)}M+ covered` : null },
  ];
  return (
    <dl className="grid grid-cols-2 border-y border-border md:grid-cols-4">
      {stats.map((s, i) => (
        <div key={s.label} className={`px-4 py-5 sm:px-6 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''} border-border`}>
          <dt className="label">{s.label}</dt>
          <dd className="num mt-2 text-2xl font-semibold">{s.value ?? <Skeleton className="h-8 w-28" />}</dd>
          {'sub' in s && s.sub && <dd className="mt-1 text-xs text-muted">{s.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* ---------- Page ---------- */

const STEPS = [
  { title: 'Connect your wallet', body: 'We read your margin straight from the dreamDEX contracts. No sign-up, no API keys.' },
  { title: 'See how close you are', body: 'Your health score, plus the exact prices where each position would get trimmed, closed or liquidated.' },
  { title: 'Protect it on-chain', body: "One click puts stop orders on dreamDEX at your trim and close prices. Somnia fires them the moment the price hits the line, even with your laptop shut. They can only shrink your position, never open or flip one." },
];

const RULES = [
  { at: `Above ${DEFAULT_THRESHOLDS.reduceBelowHealth.toFixed(2)}x`, what: 'Nothing happens. Trade however you like.', tone: 'border-l-safe' },
  { at: `${DEFAULT_THRESHOLDS.reduceBelowHealth.toFixed(2)}x`, what: `Sell ${DEFAULT_THRESHOLDS.reducePercentage}% of every open position.`, tone: 'border-l-warn' },
  { at: `${DEFAULT_THRESHOLDS.flattenBelowHealth.toFixed(2)}x`, what: 'Close everything before liquidation can.', tone: 'border-l-danger' },
];

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  const { connect, connecting, error, hasProvider } = useWallet();

  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="hazard-yellow h-2" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <h1 className="display text-6xl leading-[1] sm:text-7xl lg:text-8xl">
              Get trimmed,
              <br />
              <span className="text-accent-ink">not liquidated.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-fg/80">
              ApexPerp shows you exactly where your dreamDEX positions get liquidated, then puts stops on-chain that sell off a piece first. You lose a bit instead of everything, even if you're asleep.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn-primary h-12 px-6 text-base" disabled={connecting} onClick={async () => (await connect()) && onLaunch()}>
                <Wallet className="h-5 w-5" aria-hidden="true" />
                {connecting ? 'Check your wallet' : hasProvider ? 'Connect wallet' : 'Get a wallet first'}
              </button>
              <button type="button" className="btn-secondary h-12 px-6 text-base" onClick={onLaunch}>
                Look up an address
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <p className="mt-5 text-sm text-muted">
              New to dreamDEX? Join the <ExternalA href={DREAMDEX_URL} className="text-fg">Perps Arena</ExternalA> and you get free paper USDso every week.
            </p>
          </div>
          <BreakerDemo />
        </div>
        <LiveStats />
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <h2 className="display text-5xl sm:text-6xl">How it works</h2>
          <ol className="mt-10 border-t border-border">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid gap-2 border-b border-border py-6 sm:grid-cols-[6rem_16rem_1fr] sm:gap-6">
                <span className="num text-sm text-accent-ink">0{i + 1}</span>
                <h3 className="font-display text-2xl font-bold uppercase">{s.title}</h3>
                <p className="max-w-xl text-fg/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rules */}
      <section id="rules" className="scroll-mt-16 border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <h2 className="display text-5xl sm:text-6xl">Three lines. That's it.</h2>
            <p className="mt-5 max-w-md text-fg/80">
              Health is your equity divided by the margin dreamDEX requires you to keep. At 1.00x you can be liquidated. You pick where ApexPerp steps in. These are the defaults.
            </p>
          </div>
          <dl className="border-t border-border">
            {RULES.map((r) => (
              <div key={r.at} className={`grid grid-cols-[7rem_1fr] items-baseline gap-4 border-b border-l-4 border-border py-5 pl-4 ${r.tone}`}>
                <dt className="num text-xl font-semibold">{r.at}</dt>
                <dd className="text-fg/80">{r.what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="scroll-mt-16 border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-[1fr_auto] md:items-end md:py-24">
          <div>
            <h2 className="display text-5xl sm:text-6xl">Don't take our word for it.</h2>
            <p className="mt-5 max-w-xl text-fg/80">
              Every stop and every trim is a real transaction on Somnia. We log each one with its hash so you can look it up yourself.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a className="btn-primary h-12 px-6" href={PROOF_URL} target="_blank" rel="noreferrer">
              See every transaction <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a className="btn-secondary h-12 px-6" href={REPO_URL} target="_blank" rel="noreferrer">
              Read the code
            </a>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-accent text-accent-fg">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="display text-4xl sm:text-5xl">How close are you to liquidation?</h2>
            <p className="mt-2 text-accent-fg/80">Takes ten seconds to find out.</p>
          </div>
          <button
            type="button"
            className="btn h-12 bg-accent-fg px-6 text-base text-accent hover:bg-accent-fg/85 focus-visible:ring-accent-fg focus-visible:ring-offset-accent"
            onClick={onLaunch}
          >
            Check my account <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center">
          <Logo />
          <p>Built for the dreamDEX Perps Builder Bounty.</p>
          <ExternalA href={REPO_URL}>GitHub</ExternalA>
        </div>
      </footer>
    </main>
  );
}
