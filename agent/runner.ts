/**
 * ApexPerp Sentinel: watches a dreamDEX cross-margin account on Somnia Tokyo testnet
 * and sends reduce-only market orders before it reaches liquidation.
 *
 * Two ways to run it:
 *   - PRIVATE_KEY only: the key is the account's own (a plain wallet account).
 *   - PRIVATE_KEY + OWNER_ADDRESS: the key is a bot linked to that dreamDEX account (for Somnia
 *     Accounts). It places orders for the account and can never withdraw. See agent/linked.ts.
 *
 *   equity / mmReq <= REDUCE_BELOW_HEALTH   -> trim every position by REDUCE_PERCENTAGE
 *   equity / mmReq <= FLATTEN_BELOW_HEALTH  -> close every position
 *
 * Every order sent is recorded in PROOF.md and proof/transactions.jsonl.
 */

import { formatUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadEnv } from './config';
import { explorerTx } from './explorer';
import { createLinkedKey, LINK_HELP, linkCoverage, placeFor } from './linked';
import { connect, loadPerps, MARGIN_BANK, planReduceOrder, type PerpInfo } from './markets';
import { recordProof } from './proof';
import { decide, healthRatio, type SentinelAction } from './sentinel';

const ORDER_TYPE_MARKET = 2; // IOC

const env = loadEnv();
const signer: Address = privateKeyToAccount(env.privateKey).address;
/** The dreamDEX account being guarded. */
const account: Address = env.ownerAddress ?? signer;
const linked = env.ownerAddress ? createLinkedKey(env.ownerAddress, env.privateKey) : null;
/** Pools the linked bot may place orders on; null outside linked mode. */
let coveredPools: Set<string> | null = null;
const exchange = connect(env);
const client = exchange.client;

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function openPositions(perps: PerpInfo[]) {
  const rows = await Promise.all(
    perps.map(async (perp) => ({ perp, position: await client.getPerpPosition({ marginBank: MARGIN_BANK, account, pool: perp.pool }) })),
  );
  return rows.filter((r) => r.position.size !== 0n);
}

/** Returns true when an order was sent (or would have been, in a dry run). */
async function protect(perp: PerpInfo, size: bigint, action: Exclude<SentinelAction, 'NONE'>, pct: number, ratio: number): Promise<boolean> {
  if (coveredPools && !coveredPools.has(perp.pool.toLowerCase())) {
    log(`  ${perp.name}: skipped, the bot is not linked on this market. ${LINK_HELP}`);
    return false;
  }
  const plan = await planReduceOrder(exchange, account, perp, size, pct, env.maxSlippage);
  if (!plan.ok) {
    log(`  ${perp.name}: skipped, ${plan.reason}`);
    return false;
  }
  const { isBid, price, quantity } = plan;
  const qtyText = formatUnits(quantity, perp.baseDecimals);
  const priceText = formatUnits(price, perp.quoteDecimals);
  log(`  ${perp.name}: ${isBid ? 'BUY' : 'SELL'} ${qtyText} @ <=${priceText} (IOC, reduce-only)`);

  if (env.dryRun) return true;

  const order = { pool: perp.pool, isBid, price, quantity, orderType: ORDER_TYPE_MARKET };
  const result = linked ? await placeFor(linked, order) : await exchange.trader.placePerpOrder(order);
  log(`  tx ${result.hash} status=${result.receipt.status} block=${result.receipt.blockNumber} fills=${result.fills.length}\n  ${explorerTx(result.hash)}`);
  recordProof({
    timestamp: new Date().toISOString(),
    kind: action === 'FLATTEN' ? 'SENTINEL_FLATTEN' : 'SENTINEL_REDUCE',
    market: perp.name,
    side: isBid ? 'buy' : 'sell',
    quantity: qtyText,
    limitPrice: priceText,
    txHash: result.hash,
    block: result.receipt.blockNumber.toString(),
    status: result.receipt.status,
    healthBefore: ratio,
    account,
  });
  return true;
}

async function main() {
  log(`ApexPerp Sentinel on Somnia Tokyo testnet (Hideki 50383)${env.dryRun ? ' [DRY RUN]' : ''}`);
  log(`account ${account}${linked ? ` (guarded by bot key ${signer})` : ''}, margin bank ${MARGIN_BANK}`);
  log(`reduce ${env.reducePercentage}% at <=${env.reduceBelowHealth}x, flatten at <=${env.flattenBelowHealth}x, slippage ${env.maxSlippage * 100}%`);

  const perps = await loadPerps(exchange);
  log(`watching ${perps.length} perp markets: ${perps.map((p) => p.name).join(', ')}`);

  if (linked) {
    const { linked: ok, missing } = await linkCoverage(linked.key, perps);
    coveredPools = new Set(ok.map((p) => p.pool.toLowerCase()));
    if (ok.length === 0) {
      log(`This bot key (${signer}) cannot place orders for ${account} on any perp market. ${LINK_HELP}`);
      if (!env.dryRun) process.exit(1);
    } else if (missing.length > 0) {
      log(`linked on ${ok.length} of ${perps.length} markets; not on ${missing.map((m) => m.name).join(', ')}. ${LINK_HELP}`);
    } else {
      log(`bot key is linked on all ${perps.length} markets`);
    }
  }

  let lastActionAt = 0;
  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const health = await client.getAccountHealth(MARGIN_BANK, account);
      const ratio = healthRatio(health.equity, health.mmReq);
      const { action, pct } = decide(ratio, env);
      const ratioText = ratio === null ? 'flat' : `${ratio.toFixed(3)}x`;

      if (action === 'NONE' || ratio === null) {
        log(`health ${ratioText} | equity ${formatUnits(health.equity, 18)} USDso | mm ${formatUnits(health.mmReq, 18)} | ${health.marginStatus}`);
        return;
      }
      if (Date.now() - lastActionAt < env.cooldownMs) {
        log(`health ${ratioText} still below threshold, cooling down`);
        return;
      }

      log(`!! health ${ratioText} -> ${action} ${pct}%`);
      const positions = await openPositions(perps);
      let acted = false;
      for (const { perp, position } of positions) {
        try {
          acted = (await protect(perp, position.size, action, pct, ratio)) || acted;
        } catch (err) {
          log(`  ${perp.name}: order failed: ${(err as Error).message}`);
        }
      }
      lastActionAt = Date.now();
      if (env.once && acted) {
        log('ONCE is set: one protective action done, exiting.');
        process.exit(0);
      }
    } catch (err) {
      log(`tick failed: ${(err as Error).message}`);
    } finally {
      busy = false;
    }
  };

  await tick();
  setInterval(tick, env.pollIntervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
