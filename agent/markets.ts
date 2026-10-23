/**
 * Connection and market discovery for dreamDEX perps on Somnia Tokyo testnet (Hideki).
 */

import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES, type PerpMarket } from '@somnia-chain/markets-sdk';
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';
import { createPublicClient, http, parseAbi, type Address, type Hex } from 'viem';

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
    }));
}
