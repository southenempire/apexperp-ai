/**
 * ApexPerp Sentinel: watches a dreamDEX cross-margin account on Somnia Tokyo testnet
 * and sends reduce-only market orders before it reaches liquidation.
 *
 *   equity / mmReq <= REDUCE_BELOW_HEALTH   -> trim every position by REDUCE_PERCENTAGE
 *   equity / mmReq <= FLATTEN_BELOW_HEALTH  -> close every position
 *
 * Every order sent is recorded in PROOF.md and proof/transactions.jsonl.
 */

import { formatUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadEnv } from './config';
import { connect, loadPerps, MARGIN_BANK, planReduceOrder, type PerpInfo } from './markets';
import { recordProof } from './proof';
import { decide, healthRatio, type SentinelAction } from './sentinel';

const ORDER_TYPE_MARKET = 2; // IOC

const env = loadEnv();
const account: Address = privateKeyToAccount(env.privateKey).address;
const exchange = connect(env);
const client = exchange.client;
const trader = exchange.trader;

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function openPositions(perps: PerpInfo[]) {
  const rows = await Promise.all(
    perps.map(async (perp) => ({ perp, position: await client.getPerpPosition({ marginBank: MARGIN_BANK, account, pool: perp.pool }) })),
  );
  return rows.filter((r) => r.position.size !== 0n);
}

async function protect(perp: PerpInfo, size: bigint, action: Exclude<SentinelAction, 'NONE'>, pct: number, ratio: number) {
  const plan = await planReduceOrder(exchange, account, perp, size, pct, env.maxSlippage);
  if (!plan.ok) {
    log(`  ${perp.name}: skipped, ${plan.reason}`);
    return;
  }
  const { isBid, price, quantity } = plan;
  const qtyText = formatUnits(quantity, perp.baseDecimals);
  const priceText = formatUnits(price, perp.quoteDecimals);
  log(`  ${perp.name}: ${isBid ? 'BUY' : 'SELL'} ${qtyText} @ <=${priceText} (IOC, reduce-only)`);

  if (env.dryRun) return;

  const result = await trader.placePerpOrder({ pool: perp.pool, isBid, price, quantity, orderType: ORDER_TYPE_MARKET });
  log(`  tx ${result.hash} status=${result.receipt.status} block=${result.receipt.blockNumber} fills=${result.fills.length}`);
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
  });
}

async function main() {
  log(`ApexPerp Sentinel on Somnia Tokyo testnet (Hideki 50383)${env.dryRun ? ' [DRY RUN]' : ''}`);
  log(`account ${account}, margin bank ${MARGIN_BANK}`);
  log(`reduce ${env.reducePercentage}% at <=${env.reduceBelowHealth}x, flatten at <=${env.flattenBelowHealth}x, slippage ${env.maxSlippage * 100}%`);

  const perps = await loadPerps(exchange);
  log(`watching ${perps.length} perp markets: ${perps.map((p) => p.name).join(', ')}`);

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
      for (const { perp, position } of positions) {
        try {
          await protect(perp, position.size, action, pct, ratio);
        } catch (err) {
          log(`  ${perp.name}: order failed: ${(err as Error).message}`);
        }
      }
      lastActionAt = Date.now();
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
