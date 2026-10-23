import { useEffect, useState, type FormEvent } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Eye, Scissors, ShieldCheck, Terminal, Wallet, X } from 'lucide-react';
import { getAddress, isAddress, type Address } from 'viem';
import { HealthMeter, ZONE_STYLE, zoneOf } from '../components/HealthMeter';
import { CopyButton, ErrorNote, ExternalA, Skeleton, useToast } from '../components/ui';
import { useAccount, useFills, useMarkets, type PositionView } from '../lib/hooks';
import { useWallet } from '../lib/wallet';
import { fmtPct, fmtPrice, fmtQty, fmtUsd, shortAddress, shortHash, timeAgo } from '../lib/format';
import { DEFAULT_THRESHOLDS, DREAMDEX_URL, exchange, MAX_SLIPPAGE, ORDER_TYPE_MARKET, planReduceOrder, REPO_URL } from '../lib/somnia';

type Thresholds = typeof DEFAULT_THRESHOLDS;

function useThresholds() {
  const [t, setT] = useState<Thresholds>(() => {
    try {
      return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem('apexperp:thresholds') ?? '{}') };
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('apexperp:thresholds', JSON.stringify(t));
    } catch {}
  }, [t]);
  return [t, setT] as const;
}

/* ---------- Empty state: nothing to watch yet ---------- */

function WatchForm({ onWatch, compact = false }: { onWatch: (a: Address) => void; compact?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!isAddress(v)) return setError('Enter a valid 0x address.');
    setError(null);
    onWatch(getAddress(v));
  };
  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor="watch-address" className={compact ? 'sr-only' : 'label'}>
        Watch an address
      </label>
      <div className={`flex gap-2 ${compact ? '' : 'mt-2'}`}>
        <input
          id="watch-address"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'watch-error' : undefined}
          className="num min-h-10 w-full min-w-0 rounded-xl border border-border bg-bg px-3 text-sm placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button type="submit" className="btn-secondary shrink-0">
          <Eye className="h-4 w-4" aria-hidden="true" />
          Watch
        </button>
      </div>
      {error && (
        <p id="watch-error" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function ConnectPrompt({ onWatch }: { onWatch: (a: Address) => void }) {
  const { connect, connecting, error, hasProvider } = useWallet();
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Check your margin health</h1>
      <p className="mt-3 text-muted">Connect the wallet you trade dreamDEX perps with. You can also watch any address read-only.</p>
      <button type="button" className="btn-primary mt-8 h-12 w-full text-base" disabled={connecting} onClick={() => connect()}>
        <Wallet className="h-5 w-5" aria-hidden="true" />
        {connecting ? 'Check your wallet…' : hasProvider ? 'Connect wallet' : 'No wallet detected'}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="text-left">
        <WatchForm onWatch={onWatch} />
      </div>
    </div>
  );
}

/* ---------- Health ---------- */

type AccountQuery = ReturnType<typeof useAccount>;

function HealthCard({ account, t }: { account: AccountQuery; t: Thresholds }) {
  if (account.error && !account.data) return <ErrorNote message={`Could not read account health: ${account.error}`} onRetry={account.retry} />;

  const d = account.data;
  const zone = zoneOf(d?.ratio ?? null, t);
  const style = ZONE_STYLE[zone];
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="health-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="health-title" className="label">Account health</h2>
        {d && <span className={`rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold ${style.text}`}>{style.label}</span>}
      </div>
      {!d ? (
        <div className="mt-4 space-y-4">
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          <p className={`num mt-3 text-6xl font-bold ${style.text}`}>
            {d.ratio === null ? '—' : d.ratio.toFixed(2)}
            {d.ratio !== null && <span className="text-3xl text-muted">x</span>}
          </p>
          <p className="mt-1 text-sm text-muted">Equity over maintenance margin. 1.00x is liquidation.</p>
          <div className="mt-8">
            <HealthMeter ratio={d.ratio} {...t} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Equity', fmtUsd(d.equity)],
              ['Maintenance margin', fmtUsd(d.maintenance)],
              ['Buffer to trim', d.ratio === null ? '—' : fmtUsd(d.equity - d.maintenance * t.reduceBelowHealth, { sign: true })],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-bg/60 p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="num mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

/* ---------- Positions ---------- */

function PositionsCard({ address, account, t, canTrade }: { address: Address; account: AccountQuery; t: Thresholds; canTrade: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const reduce = async (p: PositionView, pct: number) => {
    const verb = pct === 100 ? 'Close' : `Trim ${pct}%`;
    setBusy(`${p.perp.pool}:${pct}`);
    const id = toast.push({ tone: 'pending', title: `${verb} ${p.perp.name}`, detail: 'Confirm the order in your wallet…' });
    try {
      const plan = await planReduceOrder(exchange, address, p.perp, p.size, pct, MAX_SLIPPAGE);
      if (!plan.ok) throw new Error(`Cannot build a reduce-only order: ${plan.reason}.`);
      const res = await exchange.trader.placePerpOrder({ pool: p.perp.pool, isBid: plan.isBid, price: plan.price, quantity: plan.quantity, orderType: ORDER_TYPE_MARKET });
      const ok = res.receipt.status === 'success';
      toast.update(id, {
        tone: ok ? 'success' : 'error',
        title: ok ? `${verb} ${p.perp.name}: ${res.fills.length ? 'filled' : 'sent, no fill'}` : 'Transaction reverted',
        detail: res.hash,
        copy: res.hash,
      });
      account.retry();
    } catch (err: any) {
      const msg = err?.code === 4001 || /rejected|denied/i.test(err?.message ?? '') ? 'You rejected the request.' : err?.shortMessage ?? err?.message ?? 'Unknown error';
      toast.update(id, { tone: 'error', title: `${verb} failed`, detail: msg });
    } finally {
      setBusy(null);
    }
  };

  const rows = account.data?.positions;
  return (
    <section className="card overflow-hidden" aria-labelledby="positions-title">
      <div className="flex items-center justify-between gap-3 p-5 pb-3 sm:px-6">
        <h2 id="positions-title" className="label">Positions</h2>
        {!canTrade && rows && rows.length > 0 && <span className="text-xs text-muted">Connect this wallet to trim or close</span>}
      </div>

      {account.error && !account.data && (
        <div className="px-5 pb-5 sm:px-6">
          <ErrorNote message={`Could not read positions: ${account.error}`} onRetry={account.retry} />
        </div>
      )}
      {!account.data && !account.error && (
        <div className="space-y-2 px-5 pb-5 sm:px-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="px-5 pb-8 pt-4 text-center sm:px-6">
          <p className="font-semibold">No open positions</p>
          <p className="mt-1 text-sm text-muted">Open a perp on dreamDEX and it shows up here within seconds.</p>
          <a className="btn-secondary mt-4" href={DREAMDEX_URL} target="_blank" rel="noreferrer">
            Trade on dreamDEX
          </a>
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((p) => {
            const long = p.side === 'long';
            return (
              <li key={p.perp.pool} className="grid gap-4 p-5 sm:grid-cols-2 sm:items-center sm:px-6">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${long ? 'bg-safe/10 text-safe' : 'bg-danger/10 text-danger'}`}>
                    {long ? <ArrowUpRight className="h-5 w-5" aria-hidden="true" /> : <ArrowDownRight className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <div>
                    <p className="font-semibold">{p.perp.name}</p>
                    <p className="num text-xs text-muted">
                      <span className={long ? 'text-safe' : 'text-danger'}>{long ? 'Long' : 'Short'}</span> {fmtQty(p.sizeHuman)} · {fmtUsd(p.notional)}
                    </p>
                  </div>
                </div>
                <div className="num text-sm sm:text-right">
                  <p className={p.pnl >= 0 ? 'text-safe' : 'text-danger'}>
                    {fmtUsd(p.pnl, { sign: true })} <span className="text-xs">({fmtPct(p.pnlPct, { sign: true })})</span>
                  </p>
                  <p className="text-xs text-muted">
                    Entry {fmtPrice(p.entry)} · Mark {fmtPrice(p.mark)}
                  </p>
                </div>
                <dl className="num grid grid-cols-3 gap-2 text-xs">
                  {[
                    ['Trim at', p.trimAt, 'text-warn'],
                    ['Close at', p.flattenAt, 'text-danger'],
                    ['Liq at', p.liquidationAt, 'text-danger'],
                  ].map(([label, v, tone]) => (
                    <div key={label as string} className="rounded-lg bg-bg/60 px-2 py-1.5">
                      <dt className="whitespace-nowrap text-muted">{label as string}</dt>
                      <dd className={`mt-0.5 font-semibold ${tone}`}>{v === null ? '—' : fmtPrice(v as number)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2 sm:justify-end">
                  <button
                    type="button"
                    className="btn-secondary flex-1 sm:flex-none"
                    disabled={!canTrade || busy !== null}
                    onClick={() => reduce(p, t.reducePercentage)}
                    aria-label={`Trim ${p.perp.name} by ${t.reducePercentage}%`}
                  >
                    <Scissors className="h-4 w-4" aria-hidden="true" />
                    {busy === `${p.perp.pool}:${t.reducePercentage}` ? 'Sending…' : `Trim ${t.reducePercentage}%`}
                  </button>
                  <button
                    type="button"
                    className="btn flex-1 border border-danger/40 text-danger hover:bg-danger/10 sm:flex-none"
                    disabled={!canTrade || busy !== null}
                    onClick={() => reduce(p, 100)}
                    aria-label={`Close ${p.perp.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    {busy === `${p.perp.pool}:100` ? 'Sending…' : 'Close'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows && rows.length > 0 && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted sm:px-6">
          Trigger prices assume only that market moves. Trims and closes are reduce-only IOC orders with at most {MAX_SLIPPAGE * 100}% slippage.
        </p>
      )}
    </section>
  );
}

/* ---------- Sentinel ---------- */

function NumberField({ id, label, value, onChange, step, min, max, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number; suffix: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded-xl border border-border bg-bg focus-within:ring-2 focus-within:ring-accent">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="num min-h-10 w-full min-w-0 appearance-none bg-transparent px-2.5 text-sm focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />
        <span className="pr-2.5 text-sm text-muted">{suffix}</span>
      </div>
    </div>
  );
}

function SentinelCard({ address, t, setT }: { address: Address; t: Thresholds; setT: (t: Thresholds) => void }) {
  const invalid = t.flattenBelowHealth >= t.reduceBelowHealth;
  const command = `# .env\nREDUCE_BELOW_HEALTH=${t.reduceBelowHealth}\nFLATTEN_BELOW_HEALTH=${t.flattenBelowHealth}\nREDUCE_PERCENTAGE=${t.reducePercentage}\n\nnpm run agent:live`;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="sentinel-title">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="sentinel-title" className="label">Sentinel rules</h2>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <NumberField id="trim-at" label="Trim at" value={t.reduceBelowHealth} step={0.05} min={1.05} max={5} suffix="x" onChange={(v) => setT({ ...t, reduceBelowHealth: v })} />
        <NumberField id="close-at" label="Close at" value={t.flattenBelowHealth} step={0.05} min={1.01} max={4} suffix="x" onChange={(v) => setT({ ...t, flattenBelowHealth: v })} />
        <NumberField id="trim-pct" label="Trim size" value={t.reducePercentage} step={5} min={5} max={100} suffix="%" onChange={(v) => setT({ ...t, reducePercentage: Math.round(v) })} />
      </div>
      {invalid && <p className="mt-2 text-sm text-danger">Close threshold must be below the trim threshold.</p>}

      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Terminal className="h-4 w-4 text-muted" aria-hidden="true" />
          Run it 24/7
        </div>
        <p className="mt-2 text-sm text-muted">
          The always-on Sentinel runs from the repo with this wallet's testnet key and these rules, guarding <span className="num text-fg">{shortAddress(address)}</span> even when this tab is closed.
        </p>
        <div className="mt-3 flex items-start gap-1 rounded-lg bg-surface-2 p-2">
          <pre className="num min-w-0 flex-1 overflow-x-auto whitespace-pre px-1 py-1.5 text-xs leading-relaxed text-fg">{command}</pre>
          <CopyButton text={command} label="Copy command" />
        </div>
        <ExternalA href={`${REPO_URL}#run-the-sentinel-live-on-somnia-tokyo-testnet`} className="mt-3 text-sm text-accent">
          Setup guide
        </ExternalA>
      </div>
    </section>
  );
}

/* ---------- Activity ---------- */

function ActivityCard({ address }: { address: Address }) {
  const fills = useFills(address);
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="activity-title">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="activity-title" className="label">Recent fills</h2>
      </div>
      {fills.error && !fills.data && (
        <div className="mt-4">
          <ErrorNote message="Could not load fills from the indexer." onRetry={fills.retry} />
        </div>
      )}
      {!fills.data && !fills.error && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {fills.data && fills.data.length === 0 && <p className="mt-4 text-sm text-muted">No perp fills yet for this address.</p>}
      {fills.data && fills.data.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {fills.data.slice(0, 8).map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <span className={`w-10 text-xs font-semibold uppercase ${f.side === 'buy' ? 'text-safe' : 'text-danger'}`}>{f.side}</span>
              <div className="min-w-0 flex-1">
                <p className="num truncate text-sm">
                  {fmtQty(f.quantity)} {f.market.replace('-PERP', '')} @ {fmtPrice(f.price)}
                </p>
                <p className="num truncate text-xs text-muted">
                  {timeAgo(f.timestamp)}
                  {f.txHash && ` · ${shortHash(f.txHash)}`}
                </p>
              </div>
              {f.txHash && <CopyButton text={f.txHash} label="Copy transaction hash" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Markets ---------- */

function MarketsCard() {
  const markets = useMarkets();
  return (
    <section className="card overflow-hidden" aria-labelledby="markets-title">
      <div className="p-5 pb-3 sm:px-6">
        <h2 id="markets-title" className="label">Markets</h2>
      </div>
      {markets.error && !markets.data && (
        <div className="px-5 pb-5 sm:px-6">
          <ErrorNote message="Could not load markets." onRetry={markets.retry} />
        </div>
      )}
      {!markets.data && !markets.error && (
        <div className="space-y-2 px-5 pb-5 sm:px-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
      {markets.data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs text-muted">
                <th scope="col" className="px-5 py-2 font-medium sm:px-6">Market</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Mark</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Funding APR</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Open interest</th>
                <th scope="col" className="px-5 py-2 text-right font-medium sm:px-6">Max lev</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-border">
              {markets.data.map((m) => (
                <tr key={m.pool} className="hover:bg-surface-2/60">
                  <th scope="row" className="px-5 py-2.5 text-left font-sans font-semibold sm:px-6">{m.name}</th>
                  <td className="px-3 py-2.5 text-right">{m.mark ? fmtPrice(m.mark) : '—'}</td>
                  <td className={`px-3 py-2.5 text-right ${m.fundingApr === null ? '' : m.fundingApr >= 0 ? 'text-safe' : 'text-danger'}`}>
                    {m.fundingApr === null ? '—' : fmtPct(m.fundingApr, { sign: true })}
                  </td>
                  <td className="px-3 py-2.5 text-right">{m.openInterestUsd === null ? '—' : fmtUsd(m.openInterestUsd)}</td>
                  <td className="px-5 py-2.5 text-right text-muted sm:px-6">{m.maxLeverage ? `${m.maxLeverage}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Page ---------- */

export function Dashboard({ watched, onWatch }: { watched: Address | null; onWatch: (a: Address | null) => void }) {
  const wallet = useWallet();
  const [t, setT] = useThresholds();
  const address = watched ?? wallet.address;
  const isOwn = !!address && !!wallet.address && address.toLowerCase() === wallet.address.toLowerCase();
  const canTrade = isOwn && wallet.onRightChain;
  const account = useAccount(address, t);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {!address ? (
        <>
          <ConnectPrompt onWatch={onWatch} />
          <MarketsCard />
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="label">{isOwn ? 'Your account' : 'Watching'}</p>
              <div className="mt-1 flex items-center gap-1">
                <h1 className="num text-xl font-semibold">{shortAddress(address)}</h1>
                <CopyButton text={address} label="Copy address" />
                {watched && (
                  <button type="button" className="btn-ghost min-h-10 px-3 text-xs" onClick={() => onWatch(null)}>
                    {wallet.address ? 'Back to my wallet' : 'Stop watching'}
                  </button>
                )}
              </div>
            </div>
            <div className="sm:w-96">
              <WatchForm onWatch={onWatch} compact />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <HealthCard account={account} t={t} />
              <PositionsCard address={address} account={account} t={t} canTrade={canTrade} />
            </div>
            <div className="space-y-4">
              <SentinelCard address={address} t={t} setT={setT} />
              <ActivityCard address={address} />
            </div>
          </div>
          <div className="mt-4">
            <MarketsCard />
          </div>
        </>
      )}
    </main>
  );
}
