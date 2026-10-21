export interface PerpMarketData {
  symbol: string;           // "ETH-PERP"
  ccxtSymbol: string;       // "ETH/USDso:USDso"
  markPrice: number;
  indexPrice: number;
  fundingRate: number;      // e.g. -20.48% (negative = pays longs)
  fundingRateText: string;  // "-20.487% (pays longs)"
  bid: number;
  ask: number;
  tickSize: number;
  lotSize: number;
  minQty: number;
  initialMarginBps: number; // e.g. 500 (20x max lev)
  maxLeverage: number;      // 10000 / initialMarginBps
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  notionalUsd: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  leverage: number;
  unrealizedPnl: number;
  pnlPercentage: number;
  marginLocked: number;
  healthRatio: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
}

export interface SentinelConfig {
  autoDeRiskEnabled: boolean;
  reduceBelowHealth: number;    // e.g. 1.50
  flattenBelowHealth: number;   // e.g. 1.15
  reducePercentage: number;     // e.g. 25%
  reactionTimeMs: number;       // e.g. 320ms on Somnia
  lastAction?: {
    timestamp: number;
    type: 'ALERT' | 'REDUCE' | 'MICRO_HEDGE' | 'FLATTEN';
    message: string;
  };
}

export interface AiStrategyIntent {
  rawPrompt: string;
  action: 'OPEN' | 'CLOSE' | 'GUARD' | 'ARBITRAGE' | 'GRID';
  symbol: string;
  side?: 'long' | 'short';
  notionalUsd?: number;
  leverage?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  reasoning: string;
  confidence: number;
  executablePayload: Record<string, any>;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  type: 'AI_INTENT' | 'SENTINEL_GUARD' | 'ORDER_FILLED' | 'CANCEL';
  message: string;
  status: 'SUCCESS' | 'EXECUTING' | 'SIMULATED' | 'FAILED';
  txHash?: string;
}
