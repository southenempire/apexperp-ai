/**
 * Pure Sentinel maths: health ratio, the decision, and reduce-only order sizing.
 * No I/O here, so every rule can be unit-tested without a chain.
 */

export type SentinelAction = 'NONE' | 'REDUCE' | 'FLATTEN';

export interface Thresholds {
  reduceBelowHealth: number;
  flattenBelowHealth: number;
  reducePercentage: number;
}

/**
 * Equity over maintenance-margin requirement. 1.0 is the liquidation line.
 * Returns null when the account holds no position (mmReq == 0).
 */
export function healthRatio(equity: bigint, mmReq: bigint): number | null {
  if (mmReq <= 0n) return null;
  // Four decimal places of precision without converting the bigints to floats first.
  return Number((equity * 10_000n) / mmReq) / 10_000;
}

export function decide(ratio: number | null, t: Thresholds): { action: SentinelAction; pct: number } {
  if (ratio === null) return { action: 'NONE', pct: 0 };
  if (ratio <= t.flattenBelowHealth) return { action: 'FLATTEN', pct: 100 };
  if (ratio <= t.reduceBelowHealth) return { action: 'REDUCE', pct: t.reducePercentage };
  return { action: 'NONE', pct: 0 };
}

const abs = (x: bigint) => (x < 0n ? -x : x);

export interface ReduceSizingInput {
  /** Signed position size, raw base units (positive = long). */
  size: bigint;
  pct: number;
  lotSize: bigint;
  minQuantity: bigint;
  /** Pool's `effectiveReducingCapacity`: the most an opposite order can close without opening. */
  reducingCapacity: bigint;
}

/**
 * Quantity for a reduce-only order: `pct` of the position, aligned down to the lot grid
 * and never above the reducing capacity, so the order can only shrink the position.
 * Returns 0n when no valid reduce-only order exists (e.g. below the pool minimum).
 */
export function reduceQuantity(p: ReduceSizingInput): bigint {
  const cap = p.reducingCapacity - (p.reducingCapacity % p.lotSize);
  if (cap < p.minQuantity) return 0n;

  const wanted = (abs(p.size) * BigInt(Math.round(p.pct * 100))) / 10_000n;
  let qty = wanted - (wanted % p.lotSize);
  // A trim smaller than the pool minimum would revert; trim the minimum instead.
  if (qty < p.minQuantity) qty = p.minQuantity;
  return qty > cap ? cap : qty;
}

/**
 * Crossing limit price for a protective IOC order: mark +/- slippage, aligned to the
 * tick so a buy never rounds below and a sell never rounds above the bound.
 */
export function protectivePrice(mark: bigint, isBid: boolean, maxSlippage: number, tickSize: bigint): bigint {
  const bps = BigInt(Math.round(maxSlippage * 10_000));
  if (isBid) {
    const raw = (mark * (10_000n + bps)) / 10_000n;
    const rem = raw % tickSize;
    return rem === 0n ? raw : raw + (tickSize - rem);
  }
  const raw = (mark * (10_000n - bps)) / 10_000n;
  return raw - (raw % tickSize);
}
