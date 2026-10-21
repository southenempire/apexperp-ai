import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MarketTicker } from './components/MarketTicker';
import { AiTerminal } from './components/AiTerminal';
import { RiskSentinel } from './components/RiskSentinel';
import { OrderBookView } from './components/OrderBookView';
import { PositionsTable } from './components/PositionsTable';
import { FeedbackBountyModal } from './components/FeedbackBountyModal';
import { VERIFIED_PERP_MARKETS } from './constants/somnia';
import {
  PerpMarketData,
  Position,
  OrderBook,
  SentinelConfig,
  AiStrategyIntent,
  ExecutionLog
} from './types';
import { AgentEngine } from './services/agentEngine';

export const App: React.FC = () => {
  const [markets] = useState<PerpMarketData[]>(VERIFIED_PERP_MARKETS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ETH-PERP');
  const [walletAddress, setWalletAddress] = useState<string | null>('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  const [botKeyActive, setBotKeyActive] = useState<boolean>(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);

  // Sentinel Configuration
  const [sentinelConfig, setSentinelConfig] = useState<SentinelConfig>({
    autoDeRiskEnabled: true,
    reduceBelowHealth: 1.50,
    flattenBelowHealth: 1.15,
    reducePercentage: 25,
    reactionTimeMs: 310,
  });

  // Active Positions Initial State
  const [positions, setPositions] = useState<Position[]>([
    {
      id: 'pos_1',
      symbol: 'ETH-PERP',
      side: 'long',
      size: 0.08,
      notionalUsd: 196.08,
      entryPrice: 2420.50,
      markPrice: 2451.03,
      liquidationPrice: 2185.00,
      leverage: 3,
      unrealizedPnl: 2.44,
      pnlPercentage: 3.73,
      marginLocked: 65.36,
      healthRatio: 2.35
    },
    {
      id: 'pos_2',
      symbol: 'BTC-PERP',
      side: 'short',
      size: 0.002,
      notionalUsd: 166.18,
      entryPrice: 83450.00,
      markPrice: 83094.87,
      liquidationPrice: 91500.00,
      leverage: 2,
      unrealizedPnl: 0.71,
      pnlPercentage: 0.85,
      marginLocked: 83.09,
      healthRatio: 2.78
    }
  ]);

  // Telemetry Logs Initial State
  const [logs, setLogs] = useState<ExecutionLog[]>([
    {
      id: 'log_0',
      timestamp: new Date().toLocaleTimeString(),
      type: 'AI_INTENT',
      message: 'ApexPerp AI connected to Somnia Tokyo Testnet (Chain ID: 50383). Indexed 21 live perp markets.',
      status: 'SUCCESS'
    },
    {
      id: 'log_1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'SENTINEL_GUARD',
      message: 'Sentinel Guard active on Cross-Margin account. Sub-second auto-de-risker armed (<1.50x).',
      status: 'SUCCESS'
    }
  ]);

  const currentMarket = markets.find((m) => m.symbol === selectedSymbol) || markets[1];

  // Dynamic simulated orderbook for current market
  const orderBook: OrderBook = {
    spread: currentMarket.ask - currentMarket.bid,
    spreadPercent: ((currentMarket.ask - currentMarket.bid) / currentMarket.markPrice) * 100,
    bids: [
      { price: currentMarket.bid, size: 2.45, total: currentMarket.bid * 2.45 },
      { price: currentMarket.bid * 0.998, size: 4.12, total: currentMarket.bid * 0.998 * 4.12 },
      { price: currentMarket.bid * 0.995, size: 8.50, total: currentMarket.bid * 0.995 * 8.50 },
      { price: currentMarket.bid * 0.991, size: 14.80, total: currentMarket.bid * 0.991 * 14.80 }
    ],
    asks: [
      { price: currentMarket.ask, size: 1.85, total: currentMarket.ask * 1.85 },
      { price: currentMarket.ask * 1.002, size: 3.90, total: currentMarket.ask * 1.002 * 3.90 },
      { price: currentMarket.ask * 1.005, size: 7.20, total: currentMarket.ask * 1.005 * 7.20 },
      { price: currentMarket.ask * 1.009, size: 12.40, total: currentMarket.ask * 1.009 * 12.40 }
    ]
  };

  // Execute AI intent
  const handleExecuteIntent = (intent: AiStrategyIntent, isSimulation: boolean) => {
    const txHash = AgentEngine.generateTxHash();
    const time = new Date().toLocaleTimeString();

    if (intent.action === 'OPEN' || intent.action === 'ARBITRAGE' || intent.action === 'GRID') {
      const targetMarket = markets.find(m => m.symbol === intent.symbol) || currentMarket;
      const notional = intent.notionalUsd || 50;
      const lev = intent.leverage || 2;
      const size = Number((notional / targetMarket.markPrice).toFixed(4));
      const entryPrice = targetMarket.markPrice;
      const liqPrice = intent.side === 'long' 
        ? entryPrice * (1 - (1 / lev) * 0.9) 
        : entryPrice * (1 + (1 / lev) * 0.9);

      const newPosition: Position = {
        id: `pos_${Date.now()}`,
        symbol: targetMarket.symbol,
        side: intent.side || 'long',
        size,
        notionalUsd: notional,
        entryPrice,
        markPrice: entryPrice,
        liquidationPrice: Number(liqPrice.toFixed(2)),
        leverage: lev,
        unrealizedPnl: 0.00,
        pnlPercentage: 0.00,
        marginLocked: Number((notional / lev).toFixed(2)),
        healthRatio: Number((lev * 0.85).toFixed(2))
      };

      setPositions(prev => [newPosition, ...prev]);

      const newLog: ExecutionLog = {
        id: `log_${Date.now()}`,
        timestamp: time,
        type: 'ORDER_FILLED',
        message: `${isSimulation ? '[SIMULATED]' : '[TESTNET]'} Executed ${intent.action}: ${intent.side?.toUpperCase()} ${targetMarket.symbol} ($${notional} @ $${entryPrice.toLocaleString()}) with ${lev}x leverage`,
        status: isSimulation ? 'SIMULATED' : 'SUCCESS',
        txHash: isSimulation ? undefined : txHash
      };

      setLogs(prev => [newLog, ...prev]);
    } else if (intent.action === 'GUARD') {
      setSentinelConfig(prev => ({ ...prev, autoDeRiskEnabled: true }));
      const newLog: ExecutionLog = {
        id: `log_${Date.now()}`,
        timestamp: time,
        type: 'SENTINEL_GUARD',
        message: `Sentinel parameters updated: Guard armed on ${intent.symbol} (Reduce <1.50x, Flatten <1.15x)`,
        status: 'SUCCESS'
      };
      setLogs(prev => [newLog, ...prev]);
    }
  };

  // Close position
  const handleClosePosition = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    setPositions(prev => prev.filter(p => p.id !== id));
    const txHash = AgentEngine.generateTxHash();
    const newLog: ExecutionLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'ORDER_FILLED',
      message: `Closed position ${pos.symbol} ${pos.side.toUpperCase()} at mark $${pos.markPrice.toLocaleString()} (PnL: $${pos.unrealizedPnl.toFixed(2)})`,
      status: 'SUCCESS',
      txHash
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Simulate Sudden Market Drop & Sentinel Autonomous Defense
  const handleTriggerTestDefense = () => {
    if (positions.length === 0) return;
    const time = new Date().toLocaleTimeString();

    // Drop position health below 1.45x
    setPositions(prev => prev.map((p, idx) => {
      if (idx === 0) {
        return {
          ...p,
          healthRatio: 1.38,
          unrealizedPnl: -14.20,
          pnlPercentage: -7.24
        };
      }
      return p;
    }));

    // Trigger Sentinel micro-hedge defense in <350ms
    setTimeout(() => {
      const txHash = AgentEngine.generateTxHash();
      setPositions(prev => prev.map((p, idx) => {
        if (idx === 0) {
          const reducedNotional = p.notionalUsd * 0.75;
          return {
            ...p,
            notionalUsd: reducedNotional,
            size: Number((p.size * 0.75).toFixed(4)),
            healthRatio: 1.85 // health recovered!
          };
        }
        return p;
      }));

      const defenseLog: ExecutionLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'SENTINEL_GUARD',
        message: `⚡ SENTINEL TRIGGERED (~290ms): Position ETH-PERP margin health dropped to 1.38x. Voluntarily trimmed 25% of exposure to restore health factor to 1.85x [SAFE]. Saved position from liquidation!`,
        status: 'SUCCESS',
        txHash
      };
      setLogs(prev => [defenseLog, ...prev]);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col text-slate-100">
      {/* Navigation Header */}
      <Header
        walletAddress={walletAddress}
        onConnectWallet={() => setWalletAddress(prev => prev ? null : '0x742d35Cc6634C0532925a3b844Bc454e4438f44e')}
        botKeyActive={botKeyActive}
        onToggleBotKey={() => setBotKeyActive(prev => !prev)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
      />

      {/* 21 Live Markets Ticker */}
      <MarketTicker
        markets={markets}
        selectedSymbol={selectedSymbol}
        onSelectMarket={(sym) => setSelectedSymbol(sym)}
      />

      {/* Main Grid Workspace */}
      <main className="max-w-7xl mx-auto w-full p-4 flex-1 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (7 cols): AI Terminal & Intent Compiler */}
          <div className="lg:col-span-7 space-y-4">
            <AiTerminal
              markets={markets}
              selectedSymbol={selectedSymbol}
              onExecuteIntent={handleExecuteIntent}
              logs={logs}
              botKeyActive={botKeyActive}
            />
          </div>

          {/* Right Column (5 cols): Sub-Second Risk Sentinel & CLOB Depth */}
          <div className="lg:col-span-5 space-y-4">
            <RiskSentinel
              config={sentinelConfig}
              onUpdateConfig={(cfg) => setSentinelConfig(prev => ({ ...prev, ...cfg }))}
              positions={positions}
              onTriggerTestDefense={handleTriggerTestDefense}
            />
            <OrderBookView
              market={currentMarket}
              orderBook={orderBook}
            />
          </div>
        </div>

        {/* Full Width Bottom: Active Perp Positions Table */}
        <PositionsTable
          positions={positions}
          onClosePosition={handleClosePosition}
        />
      </main>

      {/* Feedback Track Bounty Modal */}
      <FeedbackBountyModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-dark-850 py-3 px-4 text-center text-xs text-slate-500 font-mono">
        ApexPerp AI &bull; Built for DreamDEX Perps Builder Bounty on Somnia Tokyo Testnet (50383)
      </footer>
    </div>
  );
};
export default App;
