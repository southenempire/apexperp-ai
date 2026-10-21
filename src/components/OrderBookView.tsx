import React from 'react';
import { PerpMarketData, OrderBook } from '../types';

interface OrderBookViewProps {
  market: PerpMarketData;
  orderBook: OrderBook;
}

export const OrderBookView: React.FC<OrderBookViewProps> = ({ market, orderBook }) => {
  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex flex-col h-full shadow-lg font-mono text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-dark-800">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-white tracking-wide">{market.symbol}</span>
          <span className="text-[10px] text-slate-500">CLOB DEPTH</span>
        </div>
        <div className="text-right text-[11px]">
          <span className="text-slate-400">Spread: </span>
          <span className="text-cyan-400 font-bold">${orderBook.spread.toFixed(2)}</span>
          <span className="text-slate-500 ml-1">({orderBook.spreadPercent.toFixed(3)}%)</span>
        </div>
      </div>

      <div className="grid grid-cols-3 text-slate-500 text-[10px] py-2 border-b border-dark-850 uppercase font-semibold">
        <span>Price (USD)</span>
        <span className="text-right">Size (Lots)</span>
        <span className="text-right">Total ($)</span>
      </div>

      {/* Asks (Sell Orders - Red, reverse order) */}
      <div className="space-y-1 py-1 overflow-hidden">
        {orderBook.asks.slice().reverse().map((ask, idx) => (
          <div key={`ask-${idx}`} className="grid grid-cols-3 text-[11px] hover:bg-dark-850/60 py-0.5 rounded px-1">
            <span className="text-rose-400 font-medium">${ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-right text-slate-300">{ask.size.toFixed(4)}</span>
            <span className="text-right text-slate-500">${ask.total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Current Mark / Mid Bar */}
      <div className="my-2 py-1.5 px-3 rounded bg-dark-950 border border-dark-800 flex items-center justify-between">
        <span className="text-slate-400 text-[11px]">Mark Price</span>
        <span className="text-white font-bold text-sm">
          ${market.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] text-emerald-400">LIVE WS</span>
      </div>

      {/* Bids (Buy Orders - Green) */}
      <div className="space-y-1 py-1 overflow-hidden">
        {orderBook.bids.map((bid, idx) => (
          <div key={`bid-${idx}`} className="grid grid-cols-3 text-[11px] hover:bg-dark-850/60 py-0.5 rounded px-1">
            <span className="text-emerald-400 font-medium">${bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-right text-slate-300">{bid.size.toFixed(4)}</span>
            <span className="text-right text-slate-500">${bid.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
