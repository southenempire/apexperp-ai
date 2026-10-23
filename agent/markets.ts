/**
 * Connection and market discovery for dreamDEX perps on Somnia Tokyo testnet (Hideki).
 */

import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES, type PerpMarket } from '@somnia-chain/markets-sdk';
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';
import { createPublicClient, http, parseAbi, type Address, type Hex } from 'viem';
import { protectivePrice, reduceQuantity } from './sentinel';

export const reducingCapacityAbi = parseAbi([
  'function getReducingCapacity(address account) view returns ((int128 positionSize, uint256 pendingBidQuantity, uint256 pendingAskQuantity, uint256 pendingOppositeQuantity, uint256 effectiveReducingCapacity) capacity)',
]);

export const MARGIN_BANK = SOMNIA_HIDEKI_TESTNET_ADDRESSES.marginBank as Address;

export interface PerpInfo {
  name: string;
  pool: Address;
  baseDecimals: number;
  quoteDecimals: number;
  tickSize: bigint;
  lotSize: bigint;
  minQuantity: bigint;
  /** PerpStopOrderRegistry for on-chain stops, null when the pool has none. */
  stopRegistry: Address | null;
}

export const publicClient = createPublicClient({ chain: hidekiTestnet, transport: http() });

export function connect(opts: { indexerUrl: string; wsRpcUrl: string; privateKey: Hex }) {
  return new SomniaMarkets({
    indexerUrl: opts.indexerUrl,
    chain: hidekiTestnet,
    wsRpcUrl: opts.wsRpcUrl,
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    privateKey: opts.privateKey,
  });
}

export type ReducePlan =
  | { ok: true; isBid: boolean; price: bigint; quantity: bigint }
  | { ok: false; reason: string };

/**
 * Builds a reduce-only IOC order closing `pct` of a position: sized against the pool's
 * reducing capacity, priced at mark +/- slippage. Shared by the agent and the dapp.
 */
export async function planReduceOrder(
  exchange: SomniaMarkets,
  account: Address,
  perp: PerpInfo,
  size: bigint,
  pct: number,
  maxSlippage: number,
): Promise<ReducePlan> {
  const [capacity, state] = await Promise.all([
    publicClient.readContract({ address: perp.pool, abi: reducingCapacityAbi, functionName: 'getReducingCapacity', args: [account] }),
    exchange.client.getPerpState(perp.pool),
  ]);
  const quantity = reduceQuantity({
    size,
    pct,
    lotSize: perp.lotSize,
    minQuantity: perp.minQuantity,
    reducingCapacity: capacity.effectiveReducingCapacity,
  });
  if (quantity === 0n) return { ok: false, reason: 'reducing capacity is below the pool minimum' };
  if (!state.markPriceOk) return { ok: false, reason: 'mark price is stale' };

  const isBid = size < 0n; // buy back a short, sell down a long
  return { ok: true, isBid, quantity, price: protectivePrice(state.markPrice, isBid, maxSlippage, perp.tickSize) };
}

export async function loadPerps(exchange: SomniaMarkets): Promise<PerpInfo[]> {
  const markets: PerpMarket[] = await exchange.client.listPerpMarkets();
  return markets
    .filter((m) => m.marginBank.toLowerCase() === MARGIN_BANK.toLowerCase())
    .map((m) => ({
      name: `${m.baseSymbol ?? m.poolAddress}-PERP`,
      pool: m.poolAddress as Address,
      baseDecimals: m.baseDecimals,
      quoteDecimals: m.quoteDecimals,
      tickSize: BigInt(m.tickSize),
      lotSize: BigInt(m.lotSize),
      minQuantity: BigInt(m.minQuantity),
      stopRegistry: (m.stopRegistry as Address | null) ?? null,
    }));
}
