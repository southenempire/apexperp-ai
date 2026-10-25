import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, ShieldOff, Wallet } from 'lucide-react';
import { getAddress, isAddress, type Address } from 'viem';
import { CandleChart, type ChartLine } from '../components/CandleChart';
import { fetchCandles, TIMEFRAMES, type Timeframe } from '../lib/scan';
import type { Candle } from '../../agent/setups';
import { HealthMeter, ZONE_STYLE, zoneOf } from '../components/HealthMeter';
import { CopyButton, ErrorNote, ExternalA, PanelHead, Skeleton, useToast } from '../components/ui';
import { proofToMarkdown, recordDappProof, useProofLog } from '../lib/proofLog';
import { explorerTx } from '../../agent/explorer';
import { formatUnits } from 'viem';
import { useAccount, useFills, useMarkets, useStops, type PositionView } from '../lib/hooks';
import { armProtection, cancelStops, isProtective, planProtection, stopContext, type LiveStop } from '../../agent/protection';
import { useWallet } from '../lib/wallet';
import { fmtPct, fmtPrice, fmtQty, fmtUsd, shortAddress, shortHash, timeAgo, toNumber } from '../lib/format';
import { DEFAULT_THRESHOLDS, DREAMDEX_URL, exchange, MAX_SLIPPAGE, ORDER_TYPE_MARKET, planReduceOrder, REPO_URL } from '../lib/somnia';

type Thresholds = typeof DEFAULT_THRESHOLDS;
type AccountQuery = ReturnType<typeof useAccount>;

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

/* ---------- Look up an address ---------- */

function WatchForm({ onWatch, compact = false }: { onWatch: (a: Address) => void; compact?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!isAddress(v)) return setError("That doesn't look like a wallet address. It should start with 0x.");
    setError(null);
    onWatch(getAddress(v));
  };
  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor="watch-address" className={compact ? 'sr-only' : 'label'}>
        Look up any address
      </label>
      <div className={`flex ${compact ? '' : 'mt-2'}`}>
        <input
          id="watch-address"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'watch-error' : undefined}
          className="num min-h-11 w-full min-w-0 border border-r-0 border-border bg-bg px-3 text-sm placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
        />
        <button type="submit" className="btn-secondary min-h-11 shrink-0">
          Look up
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
    <div className="mx-auto grid max-w-6xl gap-px border border-border bg-border md:grid-cols-2">
      <div className="bg-surface p-6 sm:p-10">
        <h1 className="display text-5xl">How close are you?</h1>
        <p className="mt-4 max-w-sm text-fg/80">Connect the wallet you trade dreamDEX perps with. We'll show you your health and where each position would get trimmed.</p>
        <button type="button" className="btn-primary mt-8 h-12 w-full text-base sm:w-auto sm:px-8" disabled={connecting} onClick={() => connect()}>
          <Wallet className="h-5 w-5" aria-hidden="true" />
          {connecting ? 'Check your wallet' : hasProvider ? 'Connect wallet' : 'No wallet found'}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="bg-surface p-6 sm:p-10">
        <h2 className="display text-3xl">Just looking?</h2>
        <p className="mt-4 max-w-sm text-fg/80">Paste any address to see its account. Read-only, nothing to sign.</p>
        <div className="mt-8">
          <WatchForm onWatch={onWatch} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Health ---------- */

const ZONE_SENTENCE = {
  flat: "There's nothing open on this account right now.",
  safe: "You're comfortably above the trim line.",
  trim: "You're in the trim zone. Time to cut some size.",
  flatten: "You're one bad candle from liquidation. Close it down.",
  liquidation: 'This account can be liquidated right now.',
};

function HealthCard({ account, t }: { account: AccountQuery; t: Thresholds }) {
  if (account.error && !account.data) return <ErrorNote message={`Couldn't read this account's health. ${account.error}`} onRetry={account.retry} />;

  const d = account.data;
  const zone = zoneOf(d?.ratio ?? null, t);
  const style = ZONE_STYLE[zone];
  return (
    <section className="card" aria-labelledby="health-title">
      <PanelHead id="health-title" label="Health">
        {d && <span className={`font-display text-xs font-bold uppercase tracking-wider ${style.text}`}>{style.label}</span>}
      </PanelHead>
      {!d ? (
        <div className="space-y-4 p-4 sm:p-5">
          <Skeleton className="h-16 w-44" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <p className={`num text-7xl font-semibold leading-none ${style.text}`} title={d.ratio !== null && d.ratio >= 100 ? `${d.ratio.toFixed(0)}x, far above every line` : undefined}>
              {d.ratio === null ? '—' : d.ratio >= 100 ? '100' : d.ratio.toFixed(2)}
              {d.ratio !== null && <span className="text-3xl text-muted">{d.ratio >= 100 ? 'x+' : 'x'}</span>}
            </p>
            <p className="max-w-xs pb-1 text-sm text-fg/80">{ZONE_SENTENCE[zone]}</p>
          </div>
          <div className="mt-6">
            <HealthMeter ratio={d.ratio} {...t} />
          </div>
          <dl className="mt-6 grid grid-cols-1 border-t border-border sm:grid-cols-3">
            {[
              ['Equity', fmtUsd(d.equity)],
              ['Margin you must keep', fmtUsd(d.maintenance)],
              ['Room before a trim', d.ratio === null ? '—' : fmtUsd(d.equity - d.maintenance * t.reduceBelowHealth, { sign: true })],
            ].map(([label, value], i) => (
              <div key={label} className={`py-3 sm:px-4 ${i ? 'border-t border-border sm:border-l sm:border-t-0' : 'sm:pl-0'}`}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="num mt-1 text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

/* ---------- Positions ---------- */

function PositionChart({ p }: { p: PositionView }) {
  const [open, setOpen] = useState(false);
  const [tf, setTf] = useState<Timeframe>('15m');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const base = p.perp.name.replace('-PERP', '');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = () =>
      fetchCandles(base, tf)
        .then((c) => alive && (setCandles(c.slice(-120)), setFailed(false)))
        .catch(() => alive && setFailed(true));
    setCandles(null);
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open, base, tf]);

  const lines: ChartLine[] = [
    { price: p.mark, label: 'NOW', tone: 'muted' },
    { price: p.entry, label: 'ENTRY', tone: 'accent' },
    ...(p.trimAt === null ? [] : [{ price: p.trimAt, label: 'TRIM', tone: 'warn' as const }]),
    ...(p.flattenAt === null ? [] : [{ price: p.flattenAt, label: 'CLOSE', tone: 'danger' as const }]),
    ...(p.liquidationAt === null ? [] : [{ price: p.liquidationAt, label: 'LIQUIDATED', tone: 'danger' as const }]),
  ];

  return (
    <div className="sm:col-span-2">
      <button type="button" className="text-xs font-semibold uppercase tracking-wide text-accent-ink underline underline-offset-4" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide chart' : `Show ${p.perp.name} chart with your lines`}
      </button>
      {open && (
        <div className="mt-3">
          <div className="mb-2 flex gap-1" role="group" aria-label="Chart timeframe">
            {(Object.keys(TIMEFRAMES) as Timeframe[]).map((k) => (
              <button key={k} type="button" aria-pressed={tf === k} onClick={() => setTf(k)} className={`num border px-2 py-1 text-xs ${tf === k ? 'border-accent bg-accent text-accent-fg' : 'border-border text-muted hover:text-fg'}`}>
                {k}
              </button>
            ))}
          </div>
          {failed && !candles ? (
            <p className="text-sm text-muted">Couldn't load candles from the indexer. It retries every 30 seconds.</p>
          ) : candles ? (
            <CandleChart candles={candles} lines={lines} label={`${p.perp.name} ${tf} candles with entry, trim, close and liquidation prices`} />
          ) : (
            <Skeleton className="h-[260px] w-full" />
          )}
        </div>
      )}
    </div>
  );
}

function StopsStrip({
  p,
  live,
  canTrade,
  busy,
  onProtect,
  onRemove,
}: {
  p: PositionView;
  live: LiveStop[] | null;
  canTrade: boolean;
  busy: string | null;
  onProtect: () => void;
  onRemove: (mine: LiveStop[]) => void;
}) {
  const describe = (s: LiveStop) => {
    const what = s.quantity === 0n ? 'everything' : fmtQty(toNumber(s.quantity, p.perp.baseDecimals));
    return `${s.isBid ? 'Buy back' : 'Sell'} ${what} at ${s.triggerOperator === 1 ? '≤' : '≥'} ${fmtPrice(toNumber(s.triggerPrice, p.perp.quoteDecimals))}`;
  };
  const guards = live?.filter((s) => isProtective(s, p.size)) ?? [];
  const armed = guards.length > 0;
  return (
    <div className={`flex flex-col gap-3 border-l-4 px-3 py-2.5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between ${armed ? 'border-l-safe bg-safe/5' : 'border-l-border bg-surface-2/60'}`}>
      <div className="min-w-0 text-sm">
        {live === null ? (
          <Skeleton className="h-5 w-56" />
        ) : armed ? (
          <>
            <p className="flex items-center gap-2 font-semibold text-safe">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Protected on-chain
            </p>
            <ul className="num mt-1 space-y-0.5 text-xs text-fg/80">
              {live.map((s) => (
                <li key={s.orderId}>
                  {isProtective(s, p.size) ? '' : 'Take-profit: '}
                  {describe(s)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-fg/80">
            <ShieldOff className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> No on-chain stops. If you're offline when the price drops, nothing protects this.
          </p>
        )}
      </div>
      {live !== null &&
        (armed ? (
          <button type="button" className="btn-ghost shrink-0 px-3" disabled={!canTrade || busy !== null} onClick={() => onRemove(guards)}>
            {busy === `${p.perp.pool}:unprotect` ? 'Removing' : 'Remove stops'}
          </button>
        ) : (
          <button type="button" className="btn-primary shrink-0" disabled={!canTrade || busy !== null || !p.perp.stopRegistry} onClick={onProtect}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {busy === `${p.perp.pool}:protect` ? 'Arming' : 'Protect on-chain'}
          </button>
        ))}
    </div>
  );
}

function PositionsCard({ address, account, t, canTrade }: { address: Address; account: AccountQuery; t: Thresholds; canTrade: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const reduce = async (p: PositionView, pct: number) => {
    const verb = pct === 100 ? 'Closing' : `Selling ${pct}% of`;
    setBusy(`${p.perp.pool}:${pct}`);
    const id = toast.push({ tone: 'pending', title: `${verb} ${p.perp.name}`, detail: 'Confirm it in your wallet.' });
    try {
      const plan = await planReduceOrder(exchange, address, p.perp, p.size, pct, MAX_SLIPPAGE);
      if (!plan.ok) throw new Error(`Can't place this order: ${plan.reason}.`);
      const res = await exchange.trader.placePerpOrder({ pool: p.perp.pool, isBid: plan.isBid, price: plan.price, quantity: plan.quantity, orderType: ORDER_TYPE_MARKET });
      const ok = res.receipt.status === 'success';
      recordDappProof({
        timestamp: new Date().toISOString(),
        kind: pct === 100 ? 'DAPP_CLOSE' : 'DAPP_TRIM',
        account: address,
        market: p.perp.name,
        side: plan.isBid ? 'buy' : 'sell',
        quantity: formatUnits(plan.quantity, p.perp.baseDecimals),
        limitPrice: formatUnits(plan.price, p.perp.quoteDecimals),
        txHash: res.hash,
        block: res.receipt.blockNumber.toString(),
        status: res.receipt.status,
        healthBefore: account.data?.ratio ?? undefined,
      });
      toast.update(id, {
        tone: ok ? 'success' : 'error',
        title: ok ? (res.fills.length ? `Done. ${p.perp.name} ${pct === 100 ? 'closed' : 'trimmed'}.` : 'Sent, but nothing filled. The book may be thin.') : 'The transaction reverted.',
        detail: res.hash,
        copy: res.hash, href: explorerTx(res.hash),
      });
      account.retry();
    } catch (err: any) {
      const msg = err?.code === 4001 || /rejected|denied/i.test(err?.message ?? '') ? 'You cancelled it in your wallet.' : err?.shortMessage ?? err?.message ?? 'Something went wrong.';
      toast.update(id, { tone: 'error', title: "That didn't go through", detail: msg });
    } finally {
      setBusy(null);
    }
  };

  const stops = useStops(address);
  const errorText = (err: any) =>
    err?.code === 4001 || /rejected|denied/i.test(err?.message ?? '') ? 'You cancelled it in your wallet.' : err?.shortMessage ?? err?.message ?? 'Something went wrong.';

  const protect = async (p: PositionView) => {
    const health = account.data?.health;
    if (!health) return;
    setBusy(`${p.perp.pool}:protect`);
    const id = toast.push({ tone: 'pending', title: `Protecting ${p.perp.name}`, detail: 'Your wallet will ask you to confirm each stop (plus a one-time approval the first time).' });
    try {
      const plan = planProtection({ perp: p.perp, size: p.size, mark: p.markRaw, equity: health.equity, mmReq: health.mmReq, mmBps: p.mmBps, thresholds: t });
      if (plan.legs.length === 0) throw new Error(plan.skipped.join(' ') || 'Nothing to arm.');
      const ctx = await stopContext(exchange, p.perp);
      const results = await armProtection(exchange, p.perp, plan, ctx);
      for (const r of results) {
        recordDappProof({
          timestamp: new Date().toISOString(),
          kind: r.leg.kind === 'trim' ? 'ARM_TRIM_STOP' : 'ARM_CLOSE_STOP',
          account: address,
          market: p.perp.name,
          side: r.leg.isBid ? 'buy' : 'sell',
          quantity: r.leg.quantity === 0n ? 'whole position' : formatUnits(r.leg.quantity, p.perp.baseDecimals),
          limitPrice: `trigger ${formatUnits(r.leg.triggerPrice, p.perp.quoteDecimals)}`,
          txHash: r.hash,
          block: r.block.toString(),
          status: r.status,
          healthBefore: account.data?.ratio ?? undefined,
        });
      }
      const last = results[results.length - 1];
      const ok = results.every((r) => r.status === 'success');
      toast.update(id, {
        tone: ok ? 'success' : 'error',
        title: ok ? `${p.perp.name} is protected on-chain. ${results.length} stop${results.length > 1 ? 's' : ''} armed.` : 'A stop transaction reverted.',
        detail: last.hash,
        copy: last.hash, href: explorerTx(last.hash),
      });
      stops.retry();
    } catch (err) {
      toast.update(id, { tone: 'error', title: "Couldn't arm protection", detail: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const unprotect = async (p: PositionView, mine: LiveStop[]) => {
    setBusy(`${p.perp.pool}:unprotect`);
    const id = toast.push({ tone: 'pending', title: `Removing stops on ${p.perp.name}`, detail: 'Confirm it in your wallet. The fees come back to you.' });
    try {
      const res = await cancelStops(exchange, mine[0].registry, mine.map((s) => s.orderId));
      recordDappProof({
        timestamp: new Date().toISOString(),
        kind: 'CANCEL_STOPS',
        account: address,
        market: p.perp.name,
        side: 'sell',
        quantity: `${mine.length} stop(s)`,
        limitPrice: '',
        txHash: res.hash,
        block: res.block.toString(),
        status: res.status,
      });
      toast.update(id, { tone: res.status === 'success' ? 'success' : 'error', title: res.status === 'success' ? 'Stops removed.' : 'The transaction reverted.', detail: res.hash, copy: res.hash, href: explorerTx(res.hash) });
      stops.retry();
    } catch (err) {
      toast.update(id, { tone: 'error', title: "Couldn't remove the stops", detail: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const rows = account.data?.positions;
  return (
    <section className="card" aria-labelledby="positions-title">
      <PanelHead id="positions-title" label="Positions">
        {!canTrade && rows && rows.length > 0 && <span className="text-xs text-muted">Connect this wallet to trim, close or protect</span>}
      </PanelHead>

      {account.error && !account.data && (
        <div className="p-4 sm:p-5">
          <ErrorNote message={`Couldn't load positions. ${account.error}`} onRetry={account.retry} />
        </div>
      )}
      {!account.data && !account.error && (
        <div className="space-y-px">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="p-6 sm:p-8">
          <p className="font-display text-2xl font-bold uppercase">No open positions</p>
          <p className="mt-1 text-sm text-fg/80">Open a trade on dreamDEX and it'll show up here a few seconds later.</p>
          <a className="btn-secondary mt-5" href={DREAMDEX_URL} target="_blank" rel="noreferrer">
            Go to dreamDEX
          </a>
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul>
          {rows.map((p) => {
            const long = p.side === 'long';
            return (
              <li key={p.perp.pool} className="grid gap-4 border-b border-border p-4 last:border-b-0 sm:grid-cols-2 sm:items-center sm:p-5">
                <div className="flex items-center gap-3">
                  <span className={`w-1 self-stretch ${long ? 'bg-safe' : 'bg-danger'}`} aria-hidden="true" />
                  <div>
                    <p className="font-display text-xl font-bold uppercase">{p.perp.name}</p>
                    <p className="num text-xs text-muted">
                      <span className={long ? 'text-safe' : 'text-danger'}>{long ? 'LONG' : 'SHORT'}</span> {fmtQty(p.sizeHuman)} · {fmtUsd(p.notional)}
                    </p>
                  </div>
                </div>
                <div className="num text-sm sm:text-right">
                  <p className={`text-base font-semibold ${p.pnl >= 0 ? 'text-safe' : 'text-danger'}`}>
                    {fmtUsd(p.pnl, { sign: true })} <span className="text-xs">({fmtPct(p.pnlPct, { sign: true })})</span>
                  </p>
                  <p className="text-xs text-muted">
                    in at {fmtPrice(p.entry)} · now {fmtPrice(p.mark)}
                  </p>
                </div>
                <dl className="num grid grid-cols-3 border border-border text-xs">
                  {[
                    ['Trim at', p.trimAt, 'text-warn'],
                    ['Close at', p.flattenAt, 'text-danger'],
                    ['Liquidated at', p.liquidationAt, 'text-danger'],
                  ].map(([label, v, tone], i) => (
                    <div key={label as string} className={`px-2 py-1.5 ${i ? 'border-l border-border' : ''}`}>
                      <dt className="whitespace-nowrap text-muted">{label as string}</dt>
                      <dd className={`mt-0.5 font-semibold ${tone}`}>
                        {v === null ? (
                          <span className="font-normal text-muted" title="Your equity covers this whole position, so this market alone can't reach this line">
                            none
                          </span>
                        ) : (
                          fmtPrice(v as number)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2 sm:justify-end">
                  <button
                    type="button"
                    className="btn-secondary flex-1 sm:flex-none"
                    disabled={!canTrade || busy !== null}
                    onClick={() => reduce(p, t.reducePercentage)}
                    aria-label={`Sell ${t.reducePercentage}% of ${p.perp.name}`}
                  >
                    {busy === `${p.perp.pool}:${t.reducePercentage}` ? 'Sending' : `Trim ${t.reducePercentage}%`}
                  </button>
                  <button
                    type="button"
                    className="btn-danger flex-1 sm:flex-none"
                    disabled={!canTrade || busy !== null}
                    onClick={() => reduce(p, 100)}
                    aria-label={`Close ${p.perp.name}`}
                  >
                    {busy === `${p.perp.pool}:100` ? 'Sending' : 'Close'}
                  </button>
                </div>
                {p.trimAt === null && p.flattenAt === null && p.liquidationAt === null && (
                  <p className="text-xs text-muted sm:col-span-2">Your equity covers this whole position, so this market alone can't trim, close or liquidate it.</p>
                )}
                <PositionChart p={p} />
                <StopsStrip
                  p={p}
                  live={stops.data?.filter((s) => s.pool === p.perp.pool) ?? null}
                  canTrade={canTrade}
                  busy={busy}
                  onProtect={() => protect(p)}
                  onRemove={(mine) => unprotect(p, mine)}
                />
              </li>
            );
          })}
        </ul>
      )}
      {rows && rows.length > 0 && (
        <p className="border-t border-border px-4 py-3 text-xs text-muted sm:px-5">
          These prices assume only that market moves. Trims and closes can only shrink a position, and won't fill more than {MAX_SLIPPAGE * 100}% away from the current price. On-chain stops sit with dreamDEX and fire through Somnia Reactivity, even with this tab closed. Each one prepays a small STT fee that you get back if you remove it.
        </p>
      )}
    </section>
  );
}

/* ---------- Your lines ---------- */

function NumberField({ id, label, value, onChange, step, min, max, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number; suffix: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <div className="mt-1 flex items-center border border-border bg-bg focus-within:ring-2 focus-within:ring-inset focus-within:ring-accent-ink">
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
    <section className="card" aria-labelledby="sentinel-title">
      <PanelHead id="sentinel-title" label="Your lines" />
      <div className="p-4 sm:p-5">
        <p className="text-sm text-fg/80">Where should ApexPerp step in? New stops use these lines.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <NumberField id="trim-at" label="Trim at" value={t.reduceBelowHealth} step={0.05} min={1.05} max={5} suffix="x" onChange={(v) => setT({ ...t, reduceBelowHealth: v })} />
          <NumberField id="close-at" label="Close at" value={t.flattenBelowHealth} step={0.05} min={1.01} max={4} suffix="x" onChange={(v) => setT({ ...t, flattenBelowHealth: v })} />
          <NumberField id="trim-pct" label="Trim by" value={t.reducePercentage} step={5} min={5} max={100} suffix="%" onChange={(v) => setT({ ...t, reducePercentage: Math.round(v) })} />
        </div>
        {invalid && <p className="mt-2 text-sm text-danger">The close line has to sit below the trim line.</p>}
      </div>
      <div className="border-t border-border p-4 sm:p-5">
        <p className="font-display text-lg font-bold uppercase">Want a bot too?</p>
        <p className="mt-1 text-sm text-fg/80">
          On-chain stops already cover you while you're away. If you'd also like ApexPerp to watch whole-account health for <span className="num text-fg">{shortAddress(address)}</span> and trim every second, run the Sentinel from the repo:
        </p>
        <div className="mt-3 flex items-start border border-border bg-bg">
          <pre className="num min-w-0 flex-1 overflow-x-auto whitespace-pre p-3 text-xs leading-relaxed">{command}</pre>
          <CopyButton text={command} label="Copy settings" />
        </div>
        <ExternalA href={`${REPO_URL}#run-the-sentinel-live-on-somnia-tokyo-testnet`} className="mt-3 text-sm text-accent-ink">
          Setup guide
        </ExternalA>
      </div>
    </section>
  );
}

/* ---------- Activity ---------- */

function ProofCard({ address }: { address: Address }) {
  const { rows, clear } = useProofLog(address);
  const [copied, setCopied] = useState(false);
  if (rows.length === 0) return null;
  const markdown = proofToMarkdown(rows);
  return (
    <section className="card" aria-labelledby="proof-title">
      <PanelHead id="proof-title" label="Sent from here">
        <button type="button" className="btn-ghost min-h-9 px-2 text-xs" onClick={clear}>
          Clear
        </button>
      </PanelHead>
      <ul>
        {rows
          .slice(-6)
          .reverse()
          .map((r) => (
            <li key={r.txHash} className="flex items-center gap-3 border-b border-border py-2 pl-4 pr-1 last:border-b-0 sm:pl-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {r.kind.replace(/_/g, ' ').toLowerCase()} · {r.market}
                </p>
                <a href={explorerTx(r.txHash)} target="_blank" rel="noreferrer" className="num block truncate text-xs text-muted underline underline-offset-4 hover:text-fg">
                  {shortHash(r.txHash)}
                </a>
              </div>
              <CopyButton text={r.txHash} label="Copy transaction hash" />
            </li>
          ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
        <p className="text-xs text-muted">Paste these rows into PROOF.md in the repo.</p>
        <button
          type="button"
          className="btn-secondary min-h-9 shrink-0 px-3 text-xs"
          onClick={() =>
            navigator.clipboard?.writeText(markdown).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? 'Copied' : 'Copy as Markdown'}
        </button>
      </div>
    </section>
  );
}

function ActivityCard({ address }: { address: Address }) {
  const fills = useFills(address);
  return (
    <section className="card" aria-labelledby="activity-title">
      <PanelHead id="activity-title" label="Recent trades" />
      {fills.error && !fills.data && (
        <div className="p-4 sm:p-5">
          <ErrorNote message="Couldn't load trades right now." onRetry={fills.retry} />
        </div>
      )}
      {!fills.data && !fills.error && (
        <div className="space-y-2 p-4 sm:p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {fills.data && fills.data.length === 0 && <p className="p-4 text-sm text-muted sm:p-5">No perp trades on this address yet.</p>}
      {fills.data && fills.data.length > 0 && (
        <ul>
          {fills.data.slice(0, 8).map((f) => (
            <li key={f.id} className="flex items-center gap-3 border-b border-border py-2 pl-4 pr-1 last:border-b-0 sm:pl-5">
              <span className={`num w-9 text-xs font-semibold uppercase ${f.side === 'buy' ? 'text-safe' : 'text-danger'}`}>{f.side}</span>
              <div className="min-w-0 flex-1">
                <p className="num truncate text-sm">
                  {fmtQty(f.quantity)} {f.market.replace('-PERP', '')} @ {fmtPrice(f.price)}
                </p>
                <p className="num truncate text-xs text-muted">
                  {timeAgo(f.timestamp)}
                  {f.txHash && (
                    <>
                      {' · '}
                      <a href={explorerTx(f.txHash)} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-fg">
                        {shortHash(f.txHash)}
                      </a>
                    </>
                  )}
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
    <section className="card" aria-labelledby="markets-title">
      <PanelHead id="markets-title" label="All markets" />
      {markets.error && !markets.data && (
        <div className="p-4 sm:p-5">
          <ErrorNote message="Couldn't load markets right now." onRetry={markets.retry} />
        </div>
      )}
      {!markets.data && !markets.error && (
        <div className="space-y-px">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {markets.data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2 font-normal sm:px-5">Market</th>
                <th scope="col" className="px-3 py-2 text-right font-normal">Price</th>
                <th scope="col" className="px-3 py-2 text-right font-normal">Funding / yr</th>
                <th scope="col" className="px-3 py-2 text-right font-normal">Open interest</th>
                <th scope="col" className="px-4 py-2 text-right font-normal sm:px-5">Max leverage</th>
              </tr>
            </thead>
            <tbody className="num">
              {markets.data.map((m) => (
                <tr key={m.pool} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                  <th scope="row" className="px-4 py-2.5 text-left font-display font-bold uppercase sm:px-5">{m.name}</th>
                  <td className="px-3 py-2.5 text-right">{m.mark ? fmtPrice(m.mark) : '—'}</td>
                  <td className={`px-3 py-2.5 text-right ${m.fundingApr === null ? '' : m.fundingApr >= 0 ? 'text-safe' : 'text-danger'}`}>
                    {m.fundingApr === null ? '—' : fmtPct(m.fundingApr, { sign: true })}
                  </td>
                  <td className="px-3 py-2.5 text-right">{m.openInterestUsd === null ? '—' : fmtUsd(m.openInterestUsd)}</td>
                  <td className="px-4 py-2.5 text-right text-muted sm:px-5">{m.maxLeverage ? `${m.maxLeverage}x` : '—'}</td>
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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {!address && wallet.resolving ? (
        <div className="mx-auto max-w-lg space-y-3 py-16" aria-busy="true">
          <p className="font-display text-2xl font-bold uppercase">Finding your account</p>
          <p className="text-sm text-muted">Checking whether this wallet owns a Somnia Account on dreamDEX.</p>
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !address ? (
        <div className="space-y-4">
          <ConnectPrompt onWatch={onWatch} />
          <MarketsCard />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="label">{isOwn ? (wallet.viaSmartAccount ? 'Your Somnia Account' : 'Your account') : 'Looking at'}</p>
              <div className="mt-1 flex items-center gap-1">
                <h1 className="num text-2xl font-semibold">{shortAddress(address)}</h1>
                <CopyButton text={address} label="Copy address" />
                {watched && (
                  <button type="button" className="btn-ghost min-h-10 px-2 text-xs" onClick={() => onWatch(null)}>
                    {wallet.address ? 'Back to my wallet' : 'Clear'}
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
              {isOwn && <ProofCard address={address} />}
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
