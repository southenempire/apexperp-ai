/**
 * Arms on-chain protection for every open position: a reduce-only trim stop and a
 * whole-position close stop, fired by Somnia Reactivity. Every transaction is recorded
 * in PROOF.md.
 *
 *   npm run protect            arm stops at the thresholds in .env
 *   npm run protect -- --list  show pending stops
 *   npm run protect -- --cancel  cancel every pending stop (fees are refunded)
 */

import { formatUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadEnv } from '../agent/config';
import { connect, loadPerps, MARGIN_BANK } from '../agent/markets';
import { recordProof } from '../agent/proof';
import { armProtection, cancelStops, isProtective, listLiveStops, planProtection, stopContext } from '../agent/protection';
import { healthRatio } from '../agent/sentinel';

async function main() {
  const mode = process.argv.includes('--cancel') ? 'cancel' : process.argv.includes('--list') ? 'list' : 'arm';
  const env = loadEnv();
  const account: Address = privateKeyToAccount(env.privateKey).address;
  const exchange = connect(env);
  const perps = await loadPerps(exchange);
  const fmtPrice = (raw: bigint, decimals: number) => formatUnits(raw, decimals);

  const live = await listLiveStops(exchange, account, perps);
  if (mode !== 'arm') {
    console.log(`${live.length} pending stop(s) for ${account}`);
    for (const s of live) {
      const perp = perps.find((p) => p.pool === s.pool)!;
      const qty = s.quantity === 0n ? 'whole position' : formatUnits(s.quantity, perp.baseDecimals);
      console.log(`  ${perp.name} #${s.orderId}: ${s.isBid ? 'BUY' : 'SELL'} ${qty} when mark ${s.triggerOperator === 1 ? '<=' : '>='} ${fmtPrice(s.triggerPrice, perp.quoteDecimals)}`);
    }
    if (mode === 'cancel') {
      const byRegistry = new Map<Address, string[]>();
      for (const s of live) byRegistry.set(s.registry, [...(byRegistry.get(s.registry) ?? []), s.orderId]);
      for (const [registry, ids] of byRegistry) {
        const perp = perps.find((p) => p.stopRegistry === registry)!;
        const res = await cancelStops(exchange, registry, ids);
        console.log(`cancelled ${ids.length} on ${perp.name}: ${res.hash}`);
        recordProof({ timestamp: new Date().toISOString(), kind: 'CANCEL_STOPS', market: perp.name, side: 'sell', quantity: `${ids.length} stop(s)`, limitPrice: '', txHash: res.hash, block: res.block.toString(), status: res.status });
      }
    }
    process.exit(0);
  }

  const health = await exchange.client.getAccountHealth(MARGIN_BANK, account);
  const ratio = healthRatio(health.equity, health.mmReq);
  console.log(`${account} health ${ratio === null ? 'flat' : ratio.toFixed(3) + 'x'}; trim ${env.reducePercentage}% at ${env.reduceBelowHealth}x, close at ${env.flattenBelowHealth}x`);

  const positions = (
    await Promise.all(perps.map(async (perp) => ({ perp, pos: await exchange.client.getPerpPosition({ marginBank: MARGIN_BANK, account, pool: perp.pool }) })))
  ).filter((r) => r.pos.size !== 0n);
  if (positions.length === 0) {
    console.log('No open positions to protect.');
    process.exit(0);
  }

  for (const { perp, pos } of positions) {
    if (live.some((s) => s.pool === perp.pool && isProtective(s, pos.size))) {
      console.log(`${perp.name}: already protected, skipping (run --cancel first to re-arm)`);
      continue;
    }
    const [state, risk, ctx] = await Promise.all([exchange.client.getPerpState(perp.pool), exchange.client.getPerpRiskParams(perp.pool), stopContext(exchange, perp)]);
    const plan = planProtection({ perp, size: pos.size, mark: state.markPrice, equity: health.equity, mmReq: health.mmReq, mmBps: risk.maintenanceMarginBps, thresholds: env });
    for (const reason of plan.skipped) console.log(`${perp.name}: skipped ${reason}`);
    if (plan.legs.length === 0) continue;
    console.log(`${perp.name}: arming ${plan.legs.length} stop(s), ${formatUnits(ctx.feePerStop, 18)} STT fee each (refunded if cancelled)`);

    const results = await armProtection(exchange, perp, plan, ctx);
    for (const r of results) {
      const qty = r.leg.quantity === 0n ? 'whole position' : formatUnits(r.leg.quantity, perp.baseDecimals);
      const trigger = fmtPrice(r.leg.triggerPrice, perp.quoteDecimals);
      console.log(`  ${r.leg.kind} stop #${r.stopOrderId}: ${r.leg.isBid ? 'BUY' : 'SELL'} ${qty} at ${trigger}  tx ${r.hash}`);
      recordProof({
        timestamp: new Date().toISOString(),
        kind: r.leg.kind === 'trim' ? 'ARM_TRIM_STOP' : 'ARM_CLOSE_STOP',
        market: perp.name,
        side: r.leg.isBid ? 'buy' : 'sell',
        quantity: qty,
        limitPrice: `trigger ${trigger}`,
        txHash: r.hash,
        block: r.block.toString(),
        status: r.status,
        healthBefore: ratio ?? undefined,
      });
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
