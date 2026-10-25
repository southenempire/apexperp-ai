/**
 * Live reads from Somnia Tokyo testnet. Every number on screen comes from here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { annualizedFundingRate, type AccountHealth, type PerpMarket } from '@somnia-chain/markets-sdk';
import type { Address } from 'viem';
import { listLiveStops, priceAtRatio, type LiveStop } from '../../agent/protection';
import { healthRatio } from '../../agent/sentinel';
import { exchange, loadPerps, MARGIN_BANK, publicClient, type PerpInfo } from './somnia';
import { toNumber } from './format';

/** Re-runs `fn` every `ms` while mounted; keeps the last good value on a failed refresh. */
function usePoll<T>(fn: (() => Promise<T>) | null, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const depsKey = JSON.stringify(deps);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    // New subject (e.g. another address): drop the old data. A retry keeps it on screen.
    if (lastKey.current !== depsKey) {
      lastKey.current = depsKey;
      setData(null);
      setError(null);
    }
    if (!fnRef.current) {
      setLoading(false);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    // Chain the next poll after this one settles, so slow RPC round trips never pile up.
    const run = async () => {
      try {
        const next = await fnRef.current!();
        if (!alive) return;
        setData(next);
        setError(null);
      } catch (err: any) {
        if (alive) setError(err?.shortMessage ?? err?.message ?? 'Request failed');
      } finally {
        if (alive) {
          setLoading(false);
          timer = setTimeout(run, ms);
        }
      }
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [depsKey, tick, ms]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, retry };
}

let perpsPromise: Promise<PerpInfo[]> | null = null;
export function getPerps(): Promise<PerpInfo[]> {
  perpsPromise ??= loadPerps(exchange).catch((err) => {
    perpsPromise = null;
    throw err;
  });
  return perpsPromise;
}

export function useBlockNumber() {
  return usePoll(() => publicClient.getBlockNumber(), 2000, []);
}

export interface MarketRow {
  name: string;
  pool: Address;
  mark: number;
  fundingApr: number | null;
  openInterestUsd: number | null;
  maxLeverage: number;
}

export function useMarkets() {
  return usePoll(async () => {
    const rows: PerpMarket[] = await exchange.client.listPerpMarkets();
    return rows
      .filter((m) => m.marginBank.toLowerCase() === MARGIN_BANK.toLowerCase())
      .map<MarketRow>((m) => {
        const mark = m.markPrice ? toNumber(BigInt(m.markPrice), m.quoteDecimals) : 0;
        const oi = m.openInterest ? toNumber(BigInt(m.openInterest), m.baseDecimals) : null;
        return {
          name: `${m.baseSymbol ?? '?'}-PERP`,
          pool: m.poolAddress,
          mark,
          fundingApr: m.fundingRate && m.fundingWindowSec ? annualizedFundingRate(BigInt(m.fundingRate), m.fundingWindowSec) * 100 : null,
          openInterestUsd: oi === null ? null : oi * mark,
          maxLeverage: m.initialMarginBps ? Math.floor(10_000 / m.initialMarginBps) : 0,
        };
      })
      .sort((a, b) => (b.openInterestUsd ?? 0) - (a.openInterestUsd ?? 0));
  }, 10_000, []);
}

export interface PositionView {
  perp: PerpInfo;
  size: bigint;
  side: 'long' | 'short';
  sizeHuman: number;
  markRaw: bigint;
  mmBps: bigint;
  entry: number;
  mark: number;
  notional: number;
  pnl: number;
  pnlPct: number;
  /** Mark at which the account would hit each threshold if only this market moved. */
  trimAt: number | null;
  flattenAt: number | null;
  liquidationAt: number | null;
}

export interface AccountView {
  health: AccountHealth;
  ratio: number | null;
  equity: number;
  maintenance: number;
  positions: PositionView[];
}

const mmBpsCache = new Map<Address, bigint>();
async function maintenanceBps(pool: Address): Promise<bigint> {
  const hit = mmBpsCache.get(pool);
  if (hit !== undefined) return hit;
  const params = await exchange.client.getPerpRiskParams(pool);
  mmBpsCache.set(pool, params.maintenanceMarginBps);
  return params.maintenanceMarginBps;
}

const lastOpen = new Map<Address, Set<string>>();

/**
 * Pools worth a chain read: the indexer's open positions (one round trip) plus whatever
 * was open last tick, so a position the indexer has not caught up on is not dropped.
 * Falls back to every pool when the indexer is down.
 */
async function candidatePools(address: Address): Promise<PerpInfo[]> {
  const [perps, indexed] = await Promise.all([getPerps(), exchange.client.listPerpPositions(address).catch(() => null)]);
  if (!indexed) return perps;
  const pools = new Set([...indexed.map((p) => p.pool.toLowerCase()), ...(lastOpen.get(address) ?? [])]);
  return perps.filter((p) => pools.has(p.pool.toLowerCase()));
}

export function useAccount(address: Address | null, thresholds: { reduceBelowHealth: number; flattenBelowHealth: number }) {
  const { reduceBelowHealth, flattenBelowHealth } = thresholds;
  return usePoll<AccountView>(
    address
      ? async () => {
          // Health needs nothing else, so it starts first and overlaps everything below.
          const healthP = exchange.client.getAccountHealth(MARGIN_BANK, address);
          const candidates = await candidatePools(address);
          const [health, rows] = await Promise.all([
            healthP,
            Promise.all(
              candidates.map(async (perp) => {
                const [pos, state, mmBps] = await Promise.all([
                  exchange.client.getPerpPosition({ marginBank: MARGIN_BANK, account: address, pool: perp.pool }),
                  exchange.client.getPerpState(perp.pool),
                  maintenanceBps(perp.pool),
                ]);
                return { perp, pos, state, mmBps };
              }),
            ),
          ]);
          const open = rows.filter((r) => r.pos.size !== 0n);
          lastOpen.set(address, new Set(open.map((r) => r.perp.pool.toLowerCase())));

          const positions = await Promise.all(
            open.map(async ({ perp, pos, state, mmBps }) => {
              const oneBase = 10n ** BigInt(perp.baseDecimals);
              const absSize = pos.size < 0n ? -pos.size : pos.size;
              const q = (raw: bigint | null) => (raw === null ? null : toNumber(raw, perp.quoteDecimals));
              const pnlRaw = ((state.markPrice - pos.avgEntryPrice) * pos.size) / oneBase;
              const entryNotional = toNumber((absSize * pos.avgEntryPrice) / oneBase, perp.quoteDecimals);
              const pnl = toNumber(pnlRaw, perp.quoteDecimals);
              const at = (k: number) => q(priceAtRatio({ k, equity: health.equity, mmReq: health.mmReq, size: pos.size, mark: state.markPrice, mmBps, oneBase }));
              return {
                perp,
                size: pos.size,
                side: pos.size > 0n ? 'long' : 'short',
                markRaw: state.markPrice,
                mmBps,
                sizeHuman: toNumber(absSize, perp.baseDecimals),
                entry: toNumber(pos.avgEntryPrice, perp.quoteDecimals),
                mark: toNumber(state.markPrice, perp.quoteDecimals),
                notional: toNumber((absSize * state.markPrice) / oneBase, perp.quoteDecimals),
                pnl,
                pnlPct: entryNotional > 0 ? (pnl / entryNotional) * 100 : 0,
                trimAt: at(reduceBelowHealth),
                flattenAt: at(flattenBelowHealth),
                liquidationAt: at(1),
              } satisfies PositionView;
            }),
          );

          return {
            health,
            ratio: healthRatio(health.equity, health.mmReq),
            equity: toNumber(health.equity, 18),
            maintenance: toNumber(health.mmReq, 18),
            positions,
          };
        }
      : null,
    3000,
    [address, reduceBelowHealth, flattenBelowHealth],
  );
}

export interface FillView {
  id: string;
  market: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  txHash: string | null;
  timestamp: number;
}

export function useFills(address: Address | null) {
  return usePoll<FillView[]>(
    address
      ? async () => {
          const perps = await getPerps();
          const byPool = new Map(perps.map((p) => [p.pool.toLowerCase(), p]));
          const rows = await exchange.client.getUserFills(address, { limit: 25 });
          const me = address.toLowerCase();
          return rows.flatMap((f) => {
            const perp = byPool.get(f.pool.toLowerCase());
            if (!perp) return [];
            const iAmTaker = f.taker?.toLowerCase() === me;
            const takerBuys = f.takerIsBid ?? false;
            const buy = iAmTaker ? takerBuys : !takerBuys;
            return [
              {
                id: f.id,
                market: perp.name,
                side: buy ? 'buy' : 'sell',
                price: toNumber(BigInt(f.fillPrice), perp.quoteDecimals),
                quantity: toNumber(BigInt(f.quantity), perp.baseDecimals),
                txHash: (f as { txHash?: string }).txHash ?? null,
                timestamp: Number(f.timestamp) > 1e15 ? Number(f.timestamp) / 1e6 : Number(f.timestamp) > 1e12 ? Number(f.timestamp) : Number(f.timestamp) * 1000,
              } satisfies FillView,
            ];
          });
        }
      : null,
    10_000,
    [address],
  );
}

/** Pending on-chain stops for an account, refreshed every 10s. */
export function useStops(address: Address | null) {
  return usePoll<LiveStop[]>(address ? async () => listLiveStops(exchange, address, await getPerps()) : null, 10_000, [address]);
}

export interface NetworkProtection {
  stops: number;
  traders: number;
  /** Notional of fixed-size stops at current marks; whole-position stops are not counted. */
  coveredUsd: number;
}

/** Reduce-only stops pending across every dreamDEX perp market, refreshed every 30s. */
export function useNetworkProtection() {
  return usePoll<NetworkProtection>(async () => {
    const markets: PerpMarket[] = (await exchange.client.listPerpMarkets()).filter((m) => m.marginBank.toLowerCase() === MARGIN_BANK.toLowerCase());
    const rows = await Promise.all(
      markets.map(async (m) => ({ m, stops: await exchange.client.listPerpStopOrders({ pool: m.poolAddress, status: ['PENDING'], limit: 1000 }) })),
    );
    const traders = new Set<string>();
    let stops = 0;
    let coveredUsd = 0;
    for (const { m, stops: list } of rows) {
      const mark = m.markPrice ? toNumber(BigInt(m.markPrice), m.quoteDecimals) : 0;
      for (const s of list) {
        if (s.intent === 'opening') continue;
        stops++;
        traders.add(s.owner.toLowerCase());
        coveredUsd += toNumber(BigInt(s.quantity), m.baseDecimals) * mark;
      }
    }
    return { stops, traders: traders.size, coveredUsd };
  }, 30_000, []);
}
