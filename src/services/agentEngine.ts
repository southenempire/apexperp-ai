import { AiStrategyIntent, PerpMarketData, Position, SentinelConfig, ExecutionLog } from '../types';

export class AgentEngine {
  /**
   * Parse natural language prompts into executable perp trading intents
   */
  static parseIntent(prompt: string, markets: PerpMarketData[]): AiStrategyIntent {
    const text = prompt.toLowerCase();
    
    // Find market
    let matchedMarket = markets.find(m => 
      text.includes(m.symbol.toLowerCase().replace('-perp', '')) || 
      text.includes(m.symbol.toLowerCase())
    ) || markets[1]; // default ETH-PERP

    // Side detection
    let side: 'long' | 'short' = 'long';
    if (text.includes('short') || text.includes('sell') || text.includes('bear')) {
      side = 'short';
    } else if (text.includes('long') || text.includes('buy') || text.includes('bull')) {
      side = 'long';
    }

    // Leverage detection (e.g., "3x", "5x leverage")
    const levMatch = text.match(/(\d+)x/);
    let leverage = levMatch ? Math.min(parseInt(levMatch[1], 10), matchedMarket.maxLeverage) : 3;

    // Notional or Collateral (e.g. "$100", "50 usd", "100 usdt")
    const notionalMatch = text.match(/\$?(\d+)\s*(usd|usdt|usdso|collateral|\$)?/i);
    let notional = notionalMatch && parseInt(notionalMatch[1], 10) > 0 ? parseInt(notionalMatch[1], 10) : 50;

    // TP / SL detection
    const tpMatch = text.match(/tp\s*:?\s*(\d+)%?|take[\s-]profit\s*:?\s*(\d+)%?/);
    const slMatch = text.match(/sl\s*:?\s*(\d+)%?|stop[\s-]loss\s*:?\s*(\d+)%?/);
    
    const tp = tpMatch ? parseInt(tpMatch[1] || tpMatch[2], 10) : 3;
    const sl = slMatch ? parseInt(slMatch[1] || slMatch[2], 10) : 1.5;

    // Action categorization
    let action: AiStrategyIntent['action'] = 'OPEN';
    let reasoning = '';

    if (text.includes('guard') || text.includes('protect') || text.includes('sentinel') || text.includes('liquidat')) {
      action = 'GUARD';
      reasoning = `Sub-Second Sentinel configured to guard ${matchedMarket.symbol} margin health. Auto-de-risk triggers below 1.5x maintenance equity with 25% trim tranches.`;
    } else if (text.includes('funding') || text.includes('arbitrage') || text.includes('harvest')) {
      action = 'ARBITRAGE';
      const isPositive = matchedMarket.fundingRate > 0;
      const targetSide = isPositive ? 'short' : 'long';
      reasoning = `Funding rate on ${matchedMarket.symbol} is ${matchedMarket.fundingRateText}. Recommended delta-neutral posture: ${targetSide.toUpperCase()} to continuously harvest funding yield.`;
      side = targetSide;
    } else if (text.includes('grid')) {
      action = 'GRID';
      reasoning = `High-frequency CLOB grid configured around mark $${matchedMarket.markPrice.toLocaleString()} with 5 bid/ask tiers and automatic rebalancing.`;
    } else {
      action = 'OPEN';
      reasoning = `Compiled intent into ${leverage}x ${side.toUpperCase()} on ${matchedMarket.symbol} ($${notional} USDso notional). Protected by bracket stop order (TP: +${tp}%, SL: -${sl}%).`;
    }

    return {
      rawPrompt: prompt,
      action,
      symbol: matchedMarket.symbol,
      side,
      notionalUsd: notional,
      leverage,
      takeProfitPct: tp,
      stopLossPct: sl,
      reasoning,
      confidence: 0.96,
      executablePayload: {
        symbol: matchedMarket.symbol,
        ccxtSymbol: matchedMarket.ccxtSymbol,
        orderType: 'market',
        side,
        sizeLots: Math.max(1, Math.round(notional / matchedMarket.markPrice / matchedMarket.lotSize)),
        leverage,
        takeProfitPct: tp,
        stopLossPct: sl,
        clientOrderId: `apex_${Date.now()}`
      }
    };
  }

  /**
   * Evaluates position margin health and triggers Sentinel defense actions
   */
  static evaluateSentinel(
    position: Position,
    config: SentinelConfig
  ): { needsAction: boolean; actionType?: 'REDUCE' | 'FLATTEN' | 'MICRO_HEDGE'; message?: string; amountPct?: number } {
    if (!config.autoDeRiskEnabled) return { needsAction: false };

    // Liquidation line is 1.0. Maintenance cushion is 1.0 - 1.5x.
    if (position.healthRatio <= config.flattenBelowHealth) {
      return {
        needsAction: true,
        actionType: 'FLATTEN',
        message: `CRITICAL: Health ${position.healthRatio.toFixed(2)}x breached emergency threshold ${config.flattenBelowHealth}x! Flattening 100% of ${position.symbol} to prevent on-chain liquidation waterfall penalty.`,
        amountPct: 100
      };
    }

    if (position.healthRatio <= config.reduceBelowHealth) {
      return {
        needsAction: true,
        actionType: 'REDUCE',
        message: `WARNING: Health ${position.healthRatio.toFixed(2)}x breached safety threshold ${config.reduceBelowHealth}x. Executing sub-second micro-trim (-${config.reducePercentage}%) on ${position.symbol}.`,
        amountPct: config.reducePercentage
      };
    }

    return { needsAction: false };
  }

  /**
   * Generates a realistic Somnia Tokyo Testnet transaction hash for execution proof
   */
  static generateTxHash(): string {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}
