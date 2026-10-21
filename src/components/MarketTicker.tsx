import React from 'react';
import { PerpMarketData } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketTickerProps {
  markets: PerpMarketData[];
  selectedSymbol: string;
  onSelectMarket: (symbol: string) => void;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({
  markets,
  selectedSymbol,
  onSelectMarket
}) => {
  return (
    <div className="border-b border-dark-800 bg-dark-900/60 overflow-x-auto py-2 px-4 no-scrollbar">
      <div className="flex items-center space-x-3 min-w-max">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold px-2 py-0.5 rounded bg-dark-850 border border-dark-750">
          Live CLOB (21)
        </span>
        {markets.map((m) => {
          const isSelected = m.symbol === selectedSymbol;
          const isFundingNegative = m.fundingRate < 0; // pays longs
          return (
            <button
              key={m.symbol}
              onClick={() => onSelectMarket(m.symbol)}
              className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-md text-xs font-mono transition cursor-pointer border ${
                isSelected
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-white shadow-sm shadow-cyan-900/30'
                  : 'bg-dark-850/80 border-dark-800/80 text-slate-300 hover:border-dark-700 hover:bg-dark-800'
              }`}
            >
              <span className="font-semibold">{m.symbol.replace('-PERP', '')}</span>
              <span className="text-white font-medium">
                ${m.markPrice >= 1 ? m.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : m.markPrice}
              </span>
              <span
                className={`text-[10px] px-1 py-0.5 rounded flex items-center space-x-0.5 ${
                  isFundingNegative
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                    : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/40'
                }`}
                title={`Funding Rate: ${m.fundingRateText}`}
              >
                {isFundingNegative ? <TrendingUp className="w-2.5 h-2.5 inline" /> : <TrendingDown className="w-2.5 h-2.5 inline" />}
                <span>{m.fundingRate > 0 ? `+${m.fundingRate.toFixed(1)}%` : `${m.fundingRate.toFixed(1)}%`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
