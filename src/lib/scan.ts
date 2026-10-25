/**
 * Candle history for every dreamDEX perp market, for the setup scanner.
 * Candles come from the markets indexer; a candle that is still forming is dropped.
 */

import { useCallback, useEffect, useState } from 'react';
import { closedCandles, type Candle } from '../../agent/setups';
import { getPerps } from './hooks';
import { exchange } from './somnia';

export const TIMEFRAMES = { '15m': 15 * 60_000, '1h': 60 * 60_000, '4h': 4 * 60 * 60_000 } as const;
export type Timeframe = keyof typeof TIMEFRAMES;

let marketsLoaded: Promise<unknown> | null = null;
function ensureMarkets() {
  marketsLoaded ??= exchange.loadMarkets().catch((err) => {
    marketsLoaded = null;
    throw err;
  });
  return marketsLoaded;
}

export async function fetchCandles(base: string, tf: Timeframe): Promise<Candle[]> {
  await ensureMarkets();
  const rows = (await exchange.fetchOHLCV(`${base}/USDso:USDso`, tf, undefined, 1000)) as unknown as number[][];
  const candles = rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] })).sort((a, b) => a.t - b.t);
  return closedCandles(candles, TIMEFRAMES[tf]);
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

export interface MarketCandles {
  /** Base symbol, e.g. ETH. */
  name: string;
  candles: Candle[];
}

interface ScanState {
  markets: MarketCandles[];
  loaded: number;
  total: number;
  failed: number;
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: ScanState = { markets: [], loaded: 0, total: 0, failed: 0, updatedAt: null, loading: true, error: null };
const cache = new Map<Timeframe, ScanState>();

/** Loads every perp market's candles for a timeframe, then refreshes them quietly every minute. */
export function useScanData(tf: Timeframe, refreshMs = 60_000) {
  const [state, setState] = useState<ScanState>(() => cache.get(tf) ?? INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cached = cache.get(tf);
    setState(cached ?? INITIAL);

    const run = async (visible: boolean) => {
      try {
        const names = (await getPerps()).map((p) => p.name.replace('-PERP', ''));
        const markets: MarketCandles[] = [];
        let done = 0;
        let failed = 0;
        if (visible) setState((s) => ({ ...s, loading: true, error: null, total: names.length, loaded: 0, failed: 0 }));
        await pool(names, 4, async (name) => {
          try {
            markets.push({ name, candles: await fetchCandles(name, tf) });
          } catch {
            failed++;
          }
          done++;
          if (alive && visible) setState((s) => ({ ...s, loaded: done, failed }));
        });
        if (!alive) return;
        if (markets.length === 0) throw new Error("Couldn't load candles from the indexer.");
        markets.sort((a, b) => a.name.localeCompare(b.name));
        const next: ScanState = { markets, loaded: names.length, total: names.length, failed, updatedAt: Date.now(), loading: false, error: null };
        cache.set(tf, next);
        setState(next);
      } catch (err) {
        if (alive) setState((s) => ({ ...s, loading: false, error: (err as Error).message || "Couldn't load candles." }));
      } finally {
        if (alive) timer = setTimeout(() => run(false), refreshMs);
      }
    };

    run(!cached);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [tf, tick, refreshMs]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, retry };
}
