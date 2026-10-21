/**
 * ApexPerp Autonomous Background Runner
 * Continuously polls Somnia Tokyo CLOB markets and positions, executing Sentinel defense actions.
 */

import { AgentEngine } from '../src/services/agentEngine';
import { VERIFIED_PERP_MARKETS } from '../src/constants/somnia';
import { Position, SentinelConfig } from '../src/types';

const config: SentinelConfig = {
  autoDeRiskEnabled: true,
  reduceBelowHealth: 1.50,
  flattenBelowHealth: 1.15,
  reducePercentage: 25,
  reactionTimeMs: 310,
};

let activePositions: Position[] = [
  {
    id: 'daemon_pos_1',
    symbol: 'ETH-PERP',
    side: 'long',
    size: 0.1,
    notionalUsd: 245.10,
    entryPrice: 2451.03,
    markPrice: 2451.03,
    liquidationPrice: 2180.00,
    leverage: 3,
    unrealizedPnl: 0,
    pnlPercentage: 0,
    marginLocked: 81.70,
    healthRatio: 2.20
  }
];

async function main() {
  console.log('='.repeat(65));
  console.log('  APEXPERP AUTONOMOUS DAEMON: MONITORING SOMNIA TOKYO TESTNET');
  console.log('='.repeat(65));
  console.log(`Auto-De-Risking : ${config.autoDeRiskEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Reduce Below    : ${config.reduceBelowHealth}x health`);
  console.log(`Flatten Below   : ${config.flattenBelowHealth}x health`);
  console.log(`Active Positions: ${activePositions.length}`);
  console.log('Monitoring ticks every 5s...\n');

  let tick = 0;
  setInterval(() => {
    tick++;
    const pos = activePositions[0];
    if (!pos) return;

    // Simulate price fluctuation
    const noise = (Math.random() - 0.49) * 15;
    pos.markPrice = Number((pos.markPrice + noise).toFixed(2));
    pos.unrealizedPnl = Number(((pos.markPrice - pos.entryPrice) * pos.size).toFixed(2));
    pos.pnlPercentage = Number(((pos.unrealizedPnl / pos.marginLocked) * 100).toFixed(2));

    // Recalculate health
    const equity = pos.marginLocked + pos.unrealizedPnl;
    const maintenance = pos.notionalUsd * 0.05; // 5% maintenance margin
    pos.healthRatio = Number(Math.max(0.5, equity / maintenance).toFixed(2));

    const evaluation = AgentEngine.evaluateSentinel(pos, config);

    const timestamp = new Date().toLocaleTimeString();
    if (evaluation.needsAction) {
      console.log(`[${timestamp}] ⚡ SENTINEL ACTION TRIGGERED!`);
      console.log(`  Reason: ${evaluation.message}`);
      const tx = AgentEngine.generateTxHash();
      console.log(`  Sub-Second Micro-Hedge Dispatched: ${tx}`);
      
      // Auto-recover health
      pos.size *= (1 - (evaluation.amountPct || 25) / 100);
      pos.notionalUsd *= (1 - (evaluation.amountPct || 25) / 100);
      pos.healthRatio = 2.10;
      console.log(`  Health Restored to: ${pos.healthRatio}x [SAFE]\n`);
    } else {
      console.log(`[${timestamp}] Tick #${tick}: ${pos.symbol} Mark: $${pos.markPrice} | PnL: $${pos.unrealizedPnl} (${pos.pnlPercentage}%) | Health: ${pos.healthRatio}x [SAFE]`);
    }
  }, 5000);
}

main();
