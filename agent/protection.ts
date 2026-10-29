/**
 * On-chain protection: reduce-only stop orders at the trim and close prices, held by
 * dreamDEX's PerpStopOrderRegistry and fired by Somnia Reactivity when the mark crosses.
 * They keep working with no bot running and no key handed over. Shared by the dapp and
 * `npm run protect`.
 */

import { perpLiquidationPrice, type SomniaMarkets } from '@somnia-chain/markets-sdk';
import { parseAbi, type Address } from 'viem';
import { publicClient, type PerpInfo } from './markets';
import { reduceQuantity, type Thresholds } from './sentinel';

const registryAbi = parseAbi(['function somiPaymentPerOrder() view returns (uint256)']);

const LTE = 1; // fires when mark <= trigger (protects a long)
const GTE = 0; // fires when mark >= trigger (protects a short)
const STOP_MARKET = 1;

/**
 * Mark at which equity / maintenance margin reaches `k` (k = 1 is liquidation), solved
 * for this market alone. Maintenance scales linearly, so scaling mmReq and mmBps by `k`
 * turns the SDK's liquidation-price solve into a threshold solve.
 */
export function priceAtRatio(p: { k: number; equity: bigint; mmReq: bigint; size: bigint; mark: bigint; mmBps: bigint; oneBase: bigint }): bigint | null {
  const kb = BigInt(Math.round(p.k * 10_000));
  const price = perpLiquidationPrice({
    equity: p.equity,
    mmReq: (p.mmReq * kb) / 10_000n,
    size: p.size,
    markPrice: p.mark,
    maintenanceMarginBps: (p.mmBps * kb) / 10_000n,
    oneBase: p.oneBase,
  });
  return price === null || price <= 0n ? null : price;
}

export interface StopLeg {
  kind: 'trim' | 'close';
  isBid: boolean;
  /** Raw base units; 0n means "the whole position when it fires". */
  quantity: bigint;
  triggerPrice: bigint;
  triggerOperator: 0 | 1;
}

export interface ProtectionPlan {
  legs: StopLeg[];
  /** Human-readable reasons a leg was left out. */
  skipped: string[];
}

export function planProtection(p: {
  perp: PerpInfo;
  size: bigint;
  mark: bigint;
  equity: bigint;
  mmReq: bigint;
  mmBps: bigint;
  thresholds: Thresholds;
}): ProtectionPlan {
  // With the close line at or above the trim line the close stop fires first (or is skipped as
  // already past while the trim stop is armed), so refuse rather than arm a broken pair.
  if (p.thresholds.flattenBelowHealth >= p.thresholds.reduceBelowHealth) {
    return { legs: [], skipped: ['the close line has to sit below the trim line'] };
  }
  const long = p.size > 0n;
  const oneBase = 10n ** BigInt(p.perp.baseDecimals);
  const tick = p.perp.tickSize;
  // Round toward the mark, so a stop fires a hair early rather than late.
  const align = (x: bigint) => (long ? x + ((tick - (x % tick)) % tick) : x - (x % tick));
  const legs: StopLeg[] = [];
  const skipped: string[] = [];

  const add = (kind: StopLeg['kind'], k: number, quantity: bigint) => {
    const raw = priceAtRatio({ k, equity: p.equity, mmReq: p.mmReq, size: p.size, mark: p.mark, mmBps: p.mmBps, oneBase });
    if (raw === null) return skipped.push(`${kind}: no ${kind} price, the account is too well collateralised for this market alone to reach it`);
    const trigger = align(raw);
    const beyondMark = long ? trigger >= p.mark : trigger <= p.mark;
    if (beyondMark) return skipped.push(`${kind}: already past the ${kind} line, ${kind} now instead`);
    legs.push({ kind, isBid: !long, quantity, triggerPrice: trigger, triggerOperator: long ? LTE : GTE });
  };

  const absSize = p.size < 0n ? -p.size : p.size;
  const trimQty = reduceQuantity({
    size: p.size,
    pct: p.thresholds.reducePercentage,
    lotSize: p.perp.lotSize,
    minQuantity: p.perp.minQuantity,
    reducingCapacity: absSize,
  });
  if (trimQty === 0n || trimQty >= absSize) skipped.push('trim: position is too small to trim, the close stop covers it');
  else add('trim', p.thresholds.reduceBelowHealth, trimQty);
  add('close', p.thresholds.flattenBelowHealth, 0n);
  return { legs, skipped };
}

export interface StopContext {
  registry: Address;
  operatorRegistry: Address;
  /** Native token prepaid per stop for the Reactivity trigger; refunded on cancel. */
  feePerStop: bigint;
}

const operatorRegistryCache = new Map<Address, Address>();

export async function stopContext(exchange: SomniaMarkets, perp: PerpInfo): Promise<StopContext> {
  if (!perp.stopRegistry) throw new Error(`${perp.name} has no stop registry`);
  let operatorRegistry = operatorRegistryCache.get(perp.pool);
  if (!operatorRegistry) {
    // The Hideki address preset ships without operatorPermissionsRegistry, so the SDK
    // cannot resolve it on its own; read it from the pool instead (see feedback/).
    const found = await exchange.client.getOperatorPermissionsRegistry(perp.pool);
    if (!found) throw new Error(`${perp.name} has no operator permissions registry`);
    operatorRegistry = found;
    operatorRegistryCache.set(perp.pool, found);
  }
  const feePerStop = await publicClient.readContract({ address: perp.stopRegistry, abi: registryAbi, functionName: 'somiPaymentPerOrder' });
  return { registry: perp.stopRegistry, operatorRegistry, feePerStop };
}

/** Sends one stop per leg. The first one may also send the one-time operator approval. */
export async function armProtection(exchange: SomniaMarkets, perp: PerpInfo, plan: ProtectionPlan, ctx: StopContext) {
  const results = [];
  for (const leg of plan.legs) {
    const res = await exchange.trader.placePerpStopOrder({
      registry: ctx.registry,
      pool: perp.pool,
      operatorRegistry: ctx.operatorRegistry,
      isBid: leg.isBid,
      quantity: leg.quantity,
      triggerPrice: leg.triggerPrice,
      triggerOperator: leg.triggerOperator,
      stopOrderType: STOP_MARKET,
      somiPayment: ctx.feePerStop,
    });
    results.push({ leg, hash: res.hash, status: res.receipt.status, block: res.receipt.blockNumber, stopOrderId: res.stopOrderId });
  }
  return results;
}

export interface LiveStop {
  registry: Address;
  orderId: string;
  pool: Address;
  isBid: boolean;
  quantity: bigint;
  triggerPrice: bigint;
  triggerOperator: number;
}

/** The account's pending reduce-only stops, from the indexer. */
export async function listLiveStops(exchange: SomniaMarkets, account: Address, perps: PerpInfo[]): Promise<LiveStop[]> {
  const byRegistry = new Map(perps.filter((p) => p.stopRegistry).map((p) => [p.stopRegistry!.toLowerCase(), p]));
  const rows = await exchange.client.listPerpStopOrders({ account, status: ['PENDING'] });
  return rows.flatMap((r) => {
    const perp = byRegistry.get(r.registry.toLowerCase());
    if (!perp || r.intent === 'opening') return [];
    return [
      {
        registry: perp.stopRegistry!,
        orderId: r.orderIdRaw,
        pool: perp.pool,
        isBid: r.isBid,
        quantity: BigInt(r.quantity),
        triggerPrice: BigInt(r.triggerPrice),
        triggerOperator: r.triggerOperator,
      },
    ];
  });
}

export async function cancelStops(exchange: SomniaMarkets, registry: Address, orderIds: string[]) {
  const res = await exchange.trader.cancelPerpStopOrders({ registry, orderIds });
  return { hash: res.hash, status: res.receipt.status, block: res.receipt.blockNumber };
}

/**
 * True when a stop guards against losses on a position of this sign: a sell that fires
 * as the mark falls (long), or a buy-back that fires as it rises (short). Anything else
 * on the pool is a take-profit and is left alone.
 */
export function isProtective(stop: Pick<LiveStop, 'isBid' | 'triggerOperator'>, size: bigint): boolean {
  return size > 0n ? !stop.isBid && stop.triggerOperator === LTE : stop.isBid && stop.triggerOperator === GTE;
}
