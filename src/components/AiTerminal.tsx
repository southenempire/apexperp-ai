import React, { useState } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Terminal as TerminalIcon } from 'lucide-react';
import { AiStrategyIntent, PerpMarketData, ExecutionLog } from '../types';
import { AgentEngine } from '../services/agentEngine';

interface AiTerminalProps {
  markets: PerpMarketData[];
  selectedSymbol: string;
  onExecuteIntent: (intent: AiStrategyIntent, isSimulation: boolean) => void;
  logs: ExecutionLog[];
  botKeyActive: boolean;
}

const PRESET_PROMPTS = [
  "Long ETH 3x with $50 collateral, set 3% TP and 1.5% SL",
  "Arm Sentinel Guard on ETH: auto-trim 25% if margin health drops below 1.5x",
  "Harvest funding on BTC-PERP with delta-neutral short (129.8% APR)",
  "Run high-freq 5-tier grid strategy on SOL-PERP with $100 size"
];

export const AiTerminal: React.FC<AiTerminalProps> = ({
  markets,
  selectedSymbol,
  onExecuteIntent,
  logs,
  botKeyActive
}) => {
  const [prompt, setPrompt] = useState('');
  const [compiledIntent, setCompiledIntent] = useState<AiStrategyIntent | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);

  const handleParse = (inputPrompt: string) => {
    if (!inputPrompt.trim()) return;
    const intent = AgentEngine.parseIntent(inputPrompt, markets);
    setCompiledIntent(intent);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    handleParse(prompt);
  };

  const handleExecute = () => {
    if (!compiledIntent) return;
    onExecuteIntent(compiledIntent, isDryRun);
    setPrompt('');
    setCompiledIntent(null);
  };

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex flex-col h-full shadow-lg">
      {/* Terminal Title */}
      <div className="flex items-center justify-between pb-3 border-b border-dark-800">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">
            Autonomous AI Strategy Terminal
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-300">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              className="rounded bg-dark-800 border-dark-700 text-cyan-500 focus:ring-0"
            />
            <span className={isDryRun ? "text-amber-400 font-medium font-mono" : "text-emerald-400 font-medium font-mono"}>
              {isDryRun ? "DRY-RUN (Simulate)" : "LIVE TESTNET (Viem)"}
            </span>
          </label>
        </div>
      </div>

      {/* Preset Badges */}
      <div className="pt-3 pb-2 flex flex-wrap gap-1.5">
        {PRESET_PROMPTS.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => {
              setPrompt(preset);
              handleParse(preset);
            }}
            className="text-[11px] px-2.5 py-1 rounded-md bg-dark-850 hover:bg-dark-800 border border-dark-750 text-slate-300 transition text-left cursor-pointer hover:border-cyan-700/60 flex items-center space-x-1"
          >
            <Sparkles className="w-3 h-3 text-cyan-400 inline shrink-0" />
            <span className="truncate max-w-[280px] sm:max-w-none">{preset}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative mt-2">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (e.target.value.length > 5) handleParse(e.target.value);
          }}
          placeholder="Instruct the agent in natural language (e.g. 'Long ETH 3x with $100 notional, 2% TP, 1% SL')..."
          className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2.5 pl-3 pr-20 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition resize-none font-mono"
        />
        <button
          type="submit"
          disabled={!prompt.trim()}
          className="absolute right-2 top-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white rounded-md text-xs font-medium transition cursor-pointer flex items-center space-x-1 shadow-sm"
        >
          <span>Parse</span>
          <Send className="w-3 h-3" />
        </button>
      </form>

      {/* Compiled Intent Card */}
      {compiledIntent && (
        <div className="mt-3 p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs font-mono space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-cyan-300 font-semibold pb-1.5 border-b border-cyan-800/30">
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Compiled Intent: {compiledIntent.action}</span>
            </span>
            <span className="text-[10px] bg-cyan-900/60 px-2 py-0.5 rounded text-cyan-200">
              Confidence: 96%
            </span>
          </div>

          <p className="text-slate-300 font-sans text-xs">{compiledIntent.reasoning}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="bg-dark-950/60 p-2 rounded border border-dark-800">
              <span className="text-slate-500 block">Symbol</span>
              <span className="font-bold text-white">{compiledIntent.symbol}</span>
            </div>
            <div className="bg-dark-950/60 p-2 rounded border border-dark-800">
              <span className="text-slate-500 block">Direction</span>
              <span className={compiledIntent.side === 'long' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {compiledIntent.side?.toUpperCase()} ({compiledIntent.leverage}x)
              </span>
            </div>
            <div className="bg-dark-950/60 p-2 rounded border border-dark-800">
              <span className="text-slate-500 block">Notional Value</span>
              <span className="text-white font-bold">${compiledIntent.notionalUsd} USDso</span>
            </div>
            <div className="bg-dark-950/60 p-2 rounded border border-dark-800">
              <span className="text-slate-500 block">Bracket Guard</span>
              <span className="text-white">TP +{compiledIntent.takeProfitPct}% | SL -{compiledIntent.stopLossPct}%</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleExecute}
              className={`px-4 py-2 rounded-md font-semibold text-xs flex items-center space-x-2 transition cursor-pointer shadow-md ${
                isDryRun
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              <span>{isDryRun ? "Simulate Execution (Dry-Run)" : "Execute on Somnia Tokyo"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Execution Log / Telemetry Console */}
      <div className="mt-3 flex-1 flex flex-col min-h-[160px] max-h-[220px] bg-dark-950 rounded-lg border border-dark-800 p-2.5 overflow-hidden">
        <div className="flex items-center space-x-2 pb-1.5 border-b border-dark-850 text-slate-400 text-[11px] font-mono">
          <TerminalIcon className="w-3.5 h-3.5 text-cyan-500" />
          <span>Execution Telemetry Feed</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 text-[11px] font-mono">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-4 text-center">
              Agent standing by. Enter a prompt above or trigger Sentinel protection.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                <span className={`px-1 rounded text-[10px] shrink-0 ${
                  log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                  log.status === 'SIMULATED' ? 'bg-amber-950 text-amber-400 border border-amber-800/40' :
                  'bg-cyan-950 text-cyan-400 border border-cyan-800/40'
                }`}>
                  {log.status}
                </span>
                <span className="text-slate-300 break-words flex-1">
                  {log.message}
                  {log.txHash && (
                    <a
                      href={`https://shannon-explorer.somnia.network/tx/${log.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-cyan-400 underline hover:text-cyan-300 font-semibold"
                    >
                      (tx: {log.txHash.slice(0, 10)}...)
                    </a>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
