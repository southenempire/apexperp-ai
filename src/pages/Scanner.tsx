import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { edgeCheck, MIN_SAMPLE, verdict, type EdgeStats, type Verdict } from '../../agent/edge';
import { applyFilters, findSetups, SESSION_LABEL, SETUP_LABEL, type Filters, type Session, type Setup, type SetupKind } from '../../agent/setups';
import { CopyButton, ErrorNote, PanelHead, Skeleton } from '../components/ui';
import { fmtPrice, timeAgo } from '../lib/format';
import { TIMEFRAMES, useScanData, type Timeframe } from '../lib/scan';

const KINDS: SetupKind[] = ['CRT', 'TURTLE_SOUP'];

const KIND_BLURB: Record<SetupKind, string> = {
  CRT: 'A candle sweeps one side of the previous candle and closes back inside. Aims for the other side.',
  TURTLE_SOUP: 'Price takes out a 20-candle high or low and closes back inside. Aims for 2R.',
};

function Select({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block min-h-10 w-full border border-border bg-bg px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
      >
        {children}
      </select>
    </div>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`btn min-h-10 border ${pressed ? 'border-accent-ink bg-accent text-accent-fg' : 'border-border text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}

const VERDICT_STYLE: Record<Verdict, string> = { TOO_FEW: 'text-muted', NO_EDGE: 'text-fg', BETTER: 'text-safe', WORSE: 'text-danger' };

function verdictText(v: Verdict, s: EdgeStats): string {
  switch (v) {
    case 'TOO_FEW':
      return `Only ${s.n} setups so far, too few to say anything yet (we want at least ${MIN_SAMPLE}).`;
    case 'NO_EDGE':
      return 'No measurable edge. It wins about as often as random entries with the same stop and target.';
    case 'BETTER':
      return `Beats random entries by ${s.diffPts.toFixed(1)} points. Promising, but check it on more data before trusting it.`;
    case 'WORSE':
      return `Does worse than random entries by ${Math.abs(s.diffPts).toFixed(1)} points.`;
  }
}

function WinBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="num font-semibold">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 bg-fg/10" role="img" aria-label={`${label}: ${(value * 100).toFixed(1)} percent`}>
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
    </div>
  );
}

function EdgeCard({ kind, stats, days }: { kind: SetupKind; stats: EdgeStats; days: number }) {
  const v = verdict(stats);
  return (
    <section className="card" aria-labelledby={`edge-${kind}`}>
      <PanelHead id={`edge-${kind}`} label={`Edge check: ${SETUP_LABEL[kind]}`} />
      <div className="p-4 sm:p-5">
        <p className="text-xs text-muted">{KIND_BLURB[kind]}</p>
        <p className={`mt-3 text-lg font-semibold leading-snug ${VERDICT_STYLE[v]}`}>{verdictText(v, stats)}</p>
        {stats.n > 0 && (
          <>
            <div className="mt-5 space-y-3">
              <WinBar label={`${SETUP_LABEL[kind]} setups wins`} value={stats.winRate} tone="bg-accent" />
              <WinBar label="Random entries, same stop and target" value={stats.baselineWinRate} tone="bg-muted" />
            </div>
            <dl className="num mt-5 grid grid-cols-3 gap-px border border-border bg-border text-sm">
              {[
                ['Setups tested', stats.n.toLocaleString()],
                ['Average result', `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R`],
                ['Random average', `${stats.baselineAvgR >= 0 ? '+' : ''}${stats.baselineAvgR.toFixed(2)}R`],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface px-3 py-2">
                  <dt className="font-sans text-xs text-muted">{label}</dt>
                  <dd className="mt-0.5 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">
              Each setup is replayed on the candles after it, against {stats.baselineN.toLocaleString()} random entries with the same direction and the same stop and target distances. A candle that touches both counts as a loss, for both. About {Math.round(days)} days of history.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

interface LiveSetup extends Setup {
  market: string;
  closeAt: number;
  fresh: boolean;
}

const key = (s: LiveSetup, tf: string) => `${s.kind}:${s.market}:${tf}:${s.time}`;

export function Scanner() {
  const [tf, setTf] = useState<Timeframe>('1h');
  const [enabled, setEnabled] = useState<Record<SetupKind, boolean>>({ CRT: true, TURTLE_SOUP: true });
  const [session, setSession] = useState<Session>('ALL');
  const [minRR, setMinRR] = useState(0);
  const [windowCandles, setWindowCandles] = useState(12);
  const data = useScanData(tf);

  const kinds = KINDS.filter((k) => enabled[k]);
  const filters: Filters = useMemo(() => ({ session, minRR }), [session, minRR]);
  const kindsKey = kinds.join(',');

  const analysis = useMemo(() => {
    const tfMs = TIMEFRAMES[tf];
    const perMarket = data.markets.map((m) => ({ name: m.name, candles: m.candles, setups: applyFilters(findSetups(m.candles, kinds), filters) }));
    const stats = Object.fromEntries(
      kinds.map((k) => [k, edgeCheck(perMarket.map((m) => ({ candles: m.candles, setups: m.setups.filter((s) => s.kind === k) })))]),
    ) as Record<SetupKind, EdgeStats>;
    const live: LiveSetup[] = perMarket
      .flatMap((m) =>
        m.setups
          .filter((s) => s.index >= m.candles.length - windowCandles)
          .map((s) => ({ ...s, market: m.name, closeAt: s.time + tfMs, fresh: s.index >= m.candles.length - 2 })),
      )
      .sort((a, b) => b.closeAt - a.closeAt);
    const spans = data.markets.filter((m) => m.candles.length > 1).map((m) => (m.candles[m.candles.length - 1].t - m.candles[0].t) / 86_400_000);
    return { stats, live, days: spans.length ? Math.max(...spans) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.markets, kindsKey, filters, windowCandles, tf]);

  /* ---- browser notifications when a fresh setup forms while this tab is open ---- */
  const supported = typeof Notification !== 'undefined';
  const [notify, setNotify] = useState(() => {
    try {
      return supported && Notification.permission === 'granted' && localStorage.getItem('apexperp:notify') === '1';
    } catch {
      return false;
    }
  });
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const fresh = analysis.live.filter((s) => s.fresh);
    if (data.loading || data.markets.length === 0) return;
    if (seen.current === null) {
      seen.current = new Set(fresh.map((s) => key(s, tf)));
      return;
    }
    for (const s of fresh) {
      const k = key(s, tf);
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      if (notify && supported && Notification.permission === 'granted') {
        new Notification(`${SETUP_LABEL[s.kind]} on ${s.market}-PERP (${tf})`, {
          body: `${s.long ? 'Long' : 'Short'}: entry ${fmtPrice(s.entry)}, stop ${fmtPrice(s.stop)}, target ${fmtPrice(s.target)}`,
        });
      }
    }
  }, [analysis.live, data.loading, data.markets.length, notify, supported, tf]);
  useEffect(() => {
    seen.current = null; // a new timeframe starts a fresh baseline instead of alerting on everything
  }, [tf]);

  const toggleNotify = async () => {
    if (!supported) return;
    if (notify) {
      setNotify(false);
      try {
        localStorage.setItem('apexperp:notify', '0');
      } catch {}
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') {
      setNotify(true);
      try {
        localStorage.setItem('apexperp:notify', '1');
      } catch {}
    }
  };

  const loadingFirst = data.loading && data.markets.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Setup scanner</h1>
          <p className="mt-3 max-w-2xl text-fg/80">
            Every Turtle Soup and CRT that formed on dreamDEX perps, and whether that kind of setup has actually beaten random entries here.
          </p>
        </div>
        {supported && (
          <div className="shrink-0 sm:text-right">
            <button type="button" className="btn-secondary" onClick={toggleNotify} aria-pressed={notify} aria-describedby="alert-note">
              {notify ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
              {notify ? 'Alerts on' : 'Alert me'}
            </button>
            <p id="alert-note" className="mt-1.5 text-xs text-muted">
              Pings you when a new setup forms. Works while this tab is open.
            </p>
          </div>
        )}
      </div>

      <div className="card mt-5 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr_1fr]">
          <div>
            <p className="text-xs text-muted">Candle size</p>
            <div className="mt-1 flex gap-1" role="group" aria-label="Candle size">
              {(Object.keys(TIMEFRAMES) as Timeframe[]).map((t) => (
                <Toggle key={t} pressed={tf === t} onClick={() => setTf(t)}>
                  {t}
                </Toggle>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted">Setups</p>
            <div className="mt-1 flex gap-1" role="group" aria-label="Setups">
              {KINDS.map((k) => (
                <Toggle key={k} pressed={enabled[k]} onClick={() => setEnabled((e) => ({ ...e, [k]: !e[k] }))}>
                  {SETUP_LABEL[k]}
                </Toggle>
              ))}
            </div>
          </div>
          <Select id="scan-session" label="Only when it forms in" value={session} onChange={(v) => setSession(v as Session)}>
            {(Object.keys(SESSION_LABEL) as Session[]).map((s) => (
              <option key={s} value={s}>
                {SESSION_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select id="scan-rr" label="Reward over risk of at least" value={String(minRR)} onChange={(v) => setMinRR(Number(v))}>
            <option value="0">Any</option>
            <option value="1">1 : 1</option>
            <option value="1.5">1.5 : 1</option>
            <option value="2">2 : 1</option>
            <option value="3">3 : 1</option>
          </Select>
          <Select id="scan-window" label="Show setups from the last" value={String(windowCandles)} onChange={(v) => setWindowCandles(Number(v))}>
            <option value="3">3 candles</option>
            <option value="12">12 candles</option>
            <option value="48">48 candles</option>
          </Select>
        </div>
        <p className="mt-3 text-xs text-muted">The edge check below recalculates with the same filters, so you can test your own version of a setup.</p>
      </div>

      {data.error && data.markets.length === 0 && (
        <div className="mt-5">
          <ErrorNote message={data.error} onRetry={data.retry} />
        </div>
      )}

      {loadingFirst && !data.error && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <p className="num text-sm text-muted">
            Loading candles: {data.loaded} of {data.total || 21} markets
          </p>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {data.markets.length > 0 && (
        <>
          {kinds.length === 0 ? (
            <p className="mt-5 text-sm text-muted">Turn on at least one setup above.</p>
          ) : (
            <div className={`mt-5 grid gap-4 ${kinds.length > 1 ? 'lg:grid-cols-2' : ''}`}>
              {kinds.map((k) => (
                <EdgeCard key={k} kind={k} stats={analysis.stats[k]} days={analysis.days} />
              ))}
            </div>
          )}

          <section className="card mt-5" aria-labelledby="live-title">
            <PanelHead id="live-title" label="Setups that just formed">
              <span className="num text-xs text-muted">
                {analysis.live.length} found{data.failed > 0 ? ` · ${data.failed} markets unavailable` : ''}
                {data.updatedAt ? ` · updated ${timeAgo(data.updatedAt)}` : ''}
              </span>
            </PanelHead>
            {analysis.live.length === 0 ? (
              <div className="p-6 sm:p-8">
                <p className="font-display text-2xl font-bold uppercase">Nothing formed</p>
                <p className="mt-1 text-sm text-fg/80">No setups in the last {windowCandles} candles with these filters. Widen the window or check back after the next candle closes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th scope="col" className="px-4 py-2 font-normal sm:px-5">Formed</th>
                      <th scope="col" className="px-3 py-2 font-normal">Market</th>
                      <th scope="col" className="px-3 py-2 font-normal">Setup</th>
                      <th scope="col" className="px-3 py-2 font-normal">Side</th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">Entry</th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">Stop</th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">Target</th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">R:R</th>
                      <th scope="col" className="w-12 px-1 py-2"><span className="sr-only">Copy levels</span></th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {analysis.live.slice(0, 60).map((s) => (
                      <tr key={key(s, tf)} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                        <td className="px-4 py-2.5 text-muted sm:px-5">{timeAgo(s.closeAt)}</td>
                        <th scope="row" className="px-3 py-2.5 text-left font-display font-bold uppercase">{s.market}-PERP</th>
                        <td className="px-3 py-2.5 font-sans">{SETUP_LABEL[s.kind]}</td>
                        <td className={`px-3 py-2.5 font-semibold ${s.long ? 'text-safe' : 'text-danger'}`}>{s.long ? 'Long' : 'Short'}</td>
                        <td className="px-3 py-2.5 text-right">{fmtPrice(s.entry)}</td>
                        <td className="px-3 py-2.5 text-right text-danger">{fmtPrice(s.stop)}</td>
                        <td className="px-3 py-2.5 text-right text-safe">{fmtPrice(s.target)}</td>
                        <td className="px-3 py-2.5 text-right">{s.rr > 20 ? '20+' : s.rr.toFixed(1)}</td>
                        <td className="px-1 py-1">
                          <CopyButton
                            label="Copy levels"
                            text={`${s.market}-PERP ${s.long ? 'LONG' : 'SHORT'} ${SETUP_LABEL[s.kind]} (${tf}) entry ${fmtPrice(s.entry)} stop ${fmtPrice(s.stop)} target ${fmtPrice(s.target)}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="mt-4 text-xs text-muted">
            These are chart patterns found on closed candles, not advice. dreamDEX perps run on a testnet whose prices follow real markets, and the history shown is only the last days of candles. A pattern that looks good over a few days is often luck, which is why every setup comes with its edge check.
          </p>
        </>
      )}
    </main>
  );
}
