import React from 'react';
import { Position } from '../types';
import { ArrowUpRight, ArrowDownRight, XCircle } from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  onClosePosition: (id: string) => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({ positions, onClosePosition }) => {
  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-dark-800">
        <h2 className="text-sm font-semibold text-white tracking-wide flex items-center space-x-2">
          <span>Active Perp Positions</span>
          <span className="text-[10px] bg-dark-800 px-2 py-0.5 rounded text-cyan-400 font-mono">
            {positions.length}
          </span>
        </h2>
        <span className="text-xs text-slate-500 font-mono">
          Settlement Asset: USDso (Cross-Margin)
        </span>
      </div>

      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-dark-800 text-slate-500 uppercase text-[10px]">
              <th className="py-2 px-3">Market</th>
              <th className="py-2 px-3">Size / Notional</th>
              <th className="py-2 px-3">Entry Price</th>
              <th className="py-2 px-3">Mark Price</th>
              <th className="py-2 px-3">Est. Liq Price</th>
              <th className="py-2 px-3">Margin Health</th>
              <th className="py-2 px-3">Unrealized PnL</th>
              <th className="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-850">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500 italic">
                  No active positions open. Use the AI Terminal to open a strategy or hedge.
                </td>
              </tr>
            ) : (
              positions.map((pos) => {
                const isProfitable = pos.unrealizedPnl >= 0;
                return (
                  <tr key={pos.id} className="hover:bg-dark-850/50 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          pos.side === 'long'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                        }`}>
                          {pos.side.toUpperCase()} {pos.leverage}x
                        </span>
                        <span className="text-white font-medium">{pos.symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-white font-medium">${pos.notionalUsd.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">{pos.size} contracts</div>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-white font-semibold">
                      ${pos.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-rose-400 font-medium">
                      ${pos.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        pos.healthRatio <= 1.2 ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        pos.healthRatio <= 1.6 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {pos.healthRatio.toFixed(2)}x
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className={`flex items-center font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                        <span>{isProfitable ? `+$${pos.unrealizedPnl.toFixed(2)}` : `-$${Math.abs(pos.unrealizedPnl).toFixed(2)}`}</span>
                        <span className="text-[10px] ml-1">({pos.pnlPercentage.toFixed(2)}%)</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onClosePosition(pos.id)}
                        className="px-2.5 py-1 rounded bg-dark-800 hover:bg-rose-950 hover:text-rose-400 border border-dark-700 hover:border-rose-800 text-slate-300 text-[11px] transition cursor-pointer flex items-center space-x-1 ml-auto"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Close</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
