/**
 * Opens a real perp position on Somnia Tokyo testnet so the Sentinel has something to guard.
 *
 *   npm run open -- ETH long 0.01                    market order, 0.01 ETH
 *   npm run open -- BTC short 0.0002 --deposit 50    deposit 50 USDso margin first (own-wallet mode)
 *
 * With OWNER_ADDRESS set, PRIVATE_KEY is a linked bot and the order is placed for that account.
 * Positions above 200 USDso notional need --force. The transaction is recorded in PROOF.md.
 */

import { formatUnits, parseUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadEnv } from '../agent/config';
import { canPlaceFor, createLinkedKey, LINK_HELP, placeFor } from '../agent/linked';
import { connect, loadPerps, MARGIN_BANK } from '../agent/markets';
import { recordProof } from '../agent/proof';
import { protectivePrice } from '../agent/sentinel';

const ORDER_TYPE_MARKET = 2;
const MAX_NOTIONAL_USD = 200;

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  if (force) args.splice(args.indexOf('--force'), 1);
  const depositIdx = args.indexOf('--deposit');
  const deposit = depositIdx >= 0 ? args.splice(depositIdx, 2)[1] : undefined;
  const [symbol, side, size] = args;
  if (!symbol || (side !== 'long' && side !== 'short') || !size) {
    console.error('usage: npm run open -- <SYMBOL> <long|short> <size> [--deposit <USDso>] [--force]');
    process.exit(1);
  }

  const env = loadEnv();
  const signer: Address = privateKeyToAccount(env.privateKey).address;
  const account: Address = env.ownerAddress ?? signer;
  const linked = env.ownerAddress ? createLinkedKey(env.ownerAddress, env.privateKey) : null;
  const exchange = connect(env);
  const perps = await loadPerps(exchange);
  const perp = perps.find((p) => p.name.toUpperCase() === `${symbol.toUpperCase()}-PERP`);
  if (!perp) throw new Error(`unknown market ${symbol}; live: ${perps.map((p) => p.name).join(', ')}`);

  if (deposit) {
    if (linked) throw new Error('A linked bot cannot deposit. Add margin from your own account in the dreamDEX app.');
    const amount = parseUnits(deposit, perp.quoteDecimals);
    const tx = await exchange.trader.depositMargin({ marginBank: MARGIN_BANK, amount });
    console.log(`deposited ${deposit} USDso: ${tx.hash}`);
  }

  const quantity = parseUnits(size, perp.baseDecimals);
  if (quantity % perp.lotSize !== 0n || quantity < perp.minQuantity) {
    throw new Error(
      `size must be a multiple of ${formatUnits(perp.lotSize, perp.baseDecimals)} and at least ${formatUnits(perp.minQuantity, perp.baseDecimals)}`,
    );
  }

  const state = await exchange.client.getPerpState(perp.pool);
  if (!state.markPriceOk) throw new Error(`${perp.name} has no live mark price right now`);
  const notional = Number(formatUnits((quantity * state.markPrice) / 10n ** BigInt(perp.baseDecimals), perp.quoteDecimals));
  if (notional > MAX_NOTIONAL_USD && !force) {
    throw new Error(`that is about ${notional.toFixed(0)} USDso notional, above the ${MAX_NOTIONAL_USD} safety cap. Pass --force if you mean it.`);
  }
  if (linked && !(await canPlaceFor(linked.key, perp.pool))) {
    throw new Error(`the bot ${signer} cannot place orders for ${account} on ${perp.name}. ${LINK_HELP}`);
  }

  const isBid = side === 'long';
  const price = protectivePrice(state.markPrice, isBid, env.maxSlippage, perp.tickSize);
  console.log(`${account}${linked ? ` via bot ${signer}` : ''}: ${isBid ? 'BUY' : 'SELL'} ${size} ${perp.name} (about ${notional.toFixed(2)} USDso) @ <=${formatUnits(price, perp.quoteDecimals)}`);
  if (env.dryRun) {
    console.log('DRY_RUN is set: nothing sent.');
    process.exit(0);
  }

  const order = { pool: perp.pool, isBid, price, quantity, orderType: ORDER_TYPE_MARKET };
  const result = linked ? await placeFor(linked, order) : await exchange.trader.placePerpOrder(order);
  console.log(`tx ${result.hash} status=${result.receipt.status} block=${result.receipt.blockNumber} fills=${result.fills.length}`);
  recordProof({
    timestamp: new Date().toISOString(),
    kind: 'OPEN_POSITION',
    market: perp.name,
    side: isBid ? 'buy' : 'sell',
    quantity: size,
    limitPrice: formatUnits(price, perp.quoteDecimals),
    txHash: result.hash,
    block: result.receipt.blockNumber.toString(),
    status: result.receipt.status,
    account,
  });

  const health = await exchange.client.getAccountHealth(MARGIN_BANK, account);
  console.log(`account health: equity ${formatUnits(health.equity, 18)} / mm ${formatUnits(health.mmReq, 18)} (${health.marginStatus})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
