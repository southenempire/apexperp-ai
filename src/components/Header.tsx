import React from 'react';
import { Activity, ShieldCheck, Key, Zap, ExternalLink } from 'lucide-react';

interface HeaderProps {
  walletAddress: string | null;
  onConnectWallet: () => void;
  botKeyActive: boolean;
  onToggleBotKey: () => void;
  onOpenFeedback: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  walletAddress,
  onConnectWallet,
  botKeyActive,
  onToggleBotKey,
  onOpenFeedback
}) => {
  return (
    <header className="border-b border-dark-800 bg-dark-900/90 backdrop-blur sticky top-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                ApexPerp AI
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider font-semibold rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                SOMNIA PERPS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Autonomous AI Agent & Sub-Second Risk Sentinel on DreamDEX
            </p>
          </div>
        </div>

        {/* Network & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
          {/* Somnia Tokyo Network Status */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-dark-850 border border-dark-700/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium hidden md:inline">Somnia Tokyo (Hideki)</span>
            <span className="font-mono text-cyan-400 font-semibold">50383</span>
            <span className="text-slate-500 hidden lg:inline">| ~320ms</span>
          </div>

          {/* Feedback Track Bounty Pill */}
          <button
            onClick={onOpenFeedback}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
            title="DoraHacks Feedback Track Audit Reports"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium hidden sm:inline">Feedback Track ($1.5k)</span>
          </button>

          {/* Bot Key / Session Key Toggle */}
          <button
            onClick={onToggleBotKey}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border transition cursor-pointer ${
              botKeyActive
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : 'bg-dark-850 border-dark-700 text-slate-300 hover:bg-dark-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span className="font-medium">{botKeyActive ? 'Bot Key Linked' : 'Link Bot Key'}</span>
          </button>

          {/* Wallet Connect */}
          <button
            onClick={onConnectWallet}
            className="px-4 py-1.5 rounded-md font-medium bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white shadow-md shadow-cyan-900/40 transition cursor-pointer font-mono"
          >
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </header>
  );
};
