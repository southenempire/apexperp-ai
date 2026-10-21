import React from 'react';
import { Shield, ShieldAlert, Zap, AlertTriangle, RefreshCw, Gauge } from 'lucide-react';
import { SentinelConfig, Position } from '../types';

interface RiskSentinelProps {
  config: SentinelConfig;
  onUpdateConfig: (newConfig: Partial<SentinelConfig>) => void;
  positions: Position[];
  onTriggerTestDefense: () => void;
}

export const RiskSentinel: React.FC<RiskSentinelProps> = ({
  config,
  onUpdateConfig,
  positions,
  onTriggerTestDefense
}) => {
  // Aggregate account health (lowest health ratio across all positions)
  const minHealth = positions.length > 0
    ? Math.min(...positions.map((p) => p.healthRatio))
    : 2.85;

  const isCritical = minHealth <= config.flattenBelowHealth;
  const isWarning = minHealth <= config.reduceBelowHealth && !isCritical;
  const isSafe = !isCritical && !isWarning;

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-dark-800">
          <div className="flex items-center space-x-2">
            <div className={`p-1.5 rounded-md ${
              isCritical ? 'bg-rose-950 text-rose-400 border border-rose-800' :
              isWarning ? 'bg-amber-950 text-amber-400 border border-amber-800' :
              'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Sub-Second Risk Sentinel
              </h2>
              <span className="text-[10px] text-slate-400">
                Somnia High-Speed Liquidation Guard
              </span>
            </div>
          </div>

          {/* Toggle */}
          <button
            onClick={() => onUpdateConfig({ autoDeRiskEnabled: !config.autoDeRiskEnabled })}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold transition cursor-pointer border ${
              config.autoDeRiskEnabled
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                : 'bg-dark-850 border-dark-700 text-slate-500 hover:text-slate-300'
            }`}
          >
            {config.autoDeRiskEnabled ? 'SENTINEL ACTIVE' : 'DISARMED'}
          </button>
        </div>

        {/* Real-time Health Ratio Gauge Card */}
        <div className="mt-4 p-3 rounded-lg bg-dark-950 border border-dark-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cross-Margin Health Ratio</span>
            </span>
            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              isCritical ? 'bg-rose-950 text-rose-300 border border-rose-800' :
              isWarning ? 'bg-amber-950 text-amber-300 border border-amber-800' :
              'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}>
              {isCritical ? 'CRITICAL RISK' : isWarning ? 'CAUTION' : 'SAFE'}
            </span>
          </div>

          <div className="flex items-baseline space-x-2 my-2">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-white">
              {minHealth === Infinity ? '∞' : `${minHealth.toFixed(2)}x`}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              (Liquidation Line: 1.00x)
            </span>
          </div>

          {/* Progress Bar Visualizer */}
          <div className="w-full bg-dark-800 rounded-full h-2.5 overflow-hidden flex border border-dark-700/50">
            <div
              className={`h-full transition-all duration-300 ${
                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, (minHealth / 3.0) * 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>1.0x (Liquidate)</span>
            <span>1.5x (Safety Trim)</span>
            <span>3.0x+ (Secure)</span>
          </div>
        </div>

        {/* Trigger Controls & Parameters */}
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between bg-dark-950/60 px-3 py-2 rounded border border-dark-800">
            <div>
              <span className="text-slate-300 font-medium block">Auto-Trim Trigger</span>
              <span className="text-[10px] text-slate-500">Voluntarily closes 25% of position</span>
            </div>
            <span className="font-mono text-cyan-400 font-bold text-xs bg-dark-900 px-2 py-1 rounded border border-dark-750">
              &lt; {config.reduceBelowHealth}x
            </span>
          </div>

          <div className="flex items-center justify-between bg-dark-950/60 px-3 py-2 rounded border border-dark-800">
            <div>
              <span className="text-slate-300 font-medium block">Emergency Flatten Trigger</span>
              <span className="text-[10px] text-slate-500">Closes 100% before liquidation penalty</span>
            </div>
            <span className="font-mono text-rose-400 font-bold text-xs bg-dark-900 px-2 py-1 rounded border border-dark-750">
              &lt; {config.flattenBelowHealth}x
            </span>
          </div>

          <div className="flex items-center justify-between bg-dark-950/60 px-3 py-2 rounded border border-dark-800">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300 font-medium">Somnia Sub-Second Advantage</span>
            </div>
            <span className="font-mono text-emerald-400 font-bold text-xs">
              ~{config.reactionTimeMs}ms execution
            </span>
          </div>
        </div>
      </div>

      {/* Test Sentinel Action Button */}
      <div className="pt-4 border-t border-dark-800 mt-4">
        <button
          onClick={onTriggerTestDefense}
          className="w-full py-2 px-3 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer shadow-sm hover:border-cyan-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Simulate Sudden Volatility &amp; Sentinel Defense</span>
        </button>
      </div>
    </div>
  );
};
