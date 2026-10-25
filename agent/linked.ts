/**
 * Linked-bot mode: a bot key that trades FOR a dreamDEX account.
 *
 * In the dreamDEX app the owner links a bot (wallet -> Link a bot -> Perps). That grants the
 * bot key `placeOrderFor`, `cancelOrderFor` and `reduceOrderFor` on every perp pool. The key
 * then sends `placeOrderFor(owner, ...)`: the order belongs to the account, its margin comes
 * from the account's MarginBank balance, and every fill settles to the account. The key pays
 * gas only and can never withdraw. This is how a managed Somnia Account gets a Sentinel
 * without anyone exporting a key.
 *
 * The markets SDK has no perp `...For` writes (see feedback/06), so the call is sent with viem.
 */

import { CANCEL_ORDER_FOR_SELECTOR, contractErrorsAbi, decodePlaceOrder, PLACE_ORDER_FOR_SELECTOR, type OrderFill } from '@somnia-chain/markets-sdk';
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';
import { createWalletClient, http, parseAbi, toFunctionSelector, type Address, type Hex, type TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { publicClient, type PerpInfo } from './markets';

const PLACE_FOR = 'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)';
const CANCEL_FOR = 'function cancelOrderFor(address owner, uint128 orderId)';
const REDUCE_FOR = 'function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)';

const operatorAbi = [
  ...parseAbi([PLACE_FOR, CANCEL_FOR, REDUCE_FOR, 'function isOperatorAuthorized(address owner, address operator, bytes4 selector) view returns (bool)']),
  // Named revert reasons (ImmediateOrCancelNoFill, ...) make simulation errors readable.
  ...contractErrorsAbi,
] as const;

/** The selectors the app grants a linked bot, derived from the signatures so a typo cannot slip in. */
export const SELECTORS = {
  placeOrderFor: toFunctionSelector(PLACE_FOR),
  cancelOrderFor: toFunctionSelector(CANCEL_FOR),
  reduceOrderFor: toFunctionSelector(REDUCE_FOR),
} as const;

/** The SDK's own constants, for the two selectors it exports. Tests assert they match SELECTORS. */
export const SDK_SELECTORS = { placeOrderFor: PLACE_ORDER_FOR_SELECTOR, cancelOrderFor: CANCEL_ORDER_FOR_SELECTOR } as const;

const ZERO: Address = '0x0000000000000000000000000000000000000000';
/** Somnia bills gas used, not the limit; this is the ceiling the SDK itself uses for orders. */
const ORDER_GAS = 10_000_000n;

export interface LinkedKey {
  owner: Address;
  operator: Address;
}

export function createLinkedKey(owner: Address, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() === owner.toLowerCase()) {
    throw new Error('OWNER_ADDRESS is the bot key itself. Leave OWNER_ADDRESS blank to trade the key\'s own account, or set it to the dreamDEX account the bot is linked to.');
  }
  const wallet = createWalletClient({ account, chain: hidekiTestnet, transport: http() });
  const key: LinkedKey = { owner, operator: account.address };
  return { key, account, wallet };
}

export type Linked = ReturnType<typeof createLinkedKey>;

/** Whether the pool lets this bot place orders for the owner. The pool's answer is the one it enforces. */
export async function canPlaceFor(key: LinkedKey, pool: Address): Promise<boolean> {
  return publicClient.readContract({
    address: pool,
    abi: operatorAbi,
    functionName: 'isOperatorAuthorized',
    args: [key.owner, key.operator, SELECTORS.placeOrderFor],
  });
}

/** Which perp markets the bot is linked on. Linking is per market, so a market listed later needs the bot added again. */
export async function linkCoverage(key: LinkedKey, perps: PerpInfo[]) {
  const flags = await Promise.all(perps.map((p) => canPlaceFor(key, p.pool)));
  return { linked: perps.filter((_, i) => flags[i]), missing: perps.filter((_, i) => !flags[i]) };
}

export const LINK_HELP =
  'In the dreamDEX app open your wallet, choose Link a bot, tick Perps, paste the bot address and press Add bot. ' +
  'Send the bot a little STT for gas. A market listed later needs the same address added again.';

export interface LinkedPlacement {
  hash: Hex;
  receipt: TransactionReceipt;
  orderId?: bigint;
  fills: OrderFill[];
}

/** `placeOrderFor` on a perp pool: simulate first so a revert arrives as its named error, then send and wait. */
export async function placeFor(linked: Linked, p: { pool: Address; isBid: boolean; price: bigint; quantity: bigint; orderType: number }): Promise<LinkedPlacement> {
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 50 * 365 * 24 * 3600) * 1_000_000_000n;
  const { request } = await publicClient.simulateContract({
    address: p.pool,
    abi: operatorAbi,
    functionName: 'placeOrderFor',
    args: [linked.key.owner, p.isBid, 0n, p.price, p.quantity, expiry, p.orderType, 0, ZERO, 0n],
    account: linked.account,
    gas: ORDER_GAS,
  });
  const hash = await linked.wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`placeOrderFor reverted on-chain (tx ${hash})`);
  const { orderId, fills } = decodePlaceOrder(receipt, p.pool);
  return { hash, receipt, orderId, fills };
}
