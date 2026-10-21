import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, AlertCircle } from 'lucide-react';

interface FeedbackBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BOUNTY_REPORTS = [
  {
    id: 'BUG-01',
    severity: 'MAJOR / CRITICAL ($40)',
    title: 'Missing OPERATOR_REGISTRY in SOMNIA_TESTNET_ADDRESSES Causes Unhandled Revert on Stop Orders',
    details: `In @somnia-chain/markets-sdk, SOMNIA_TESTNET_ADDRESSES does not bundle the OperatorPermissionsRegistry contract address.
When developers invoke placePerpStopOrder, the SDK throws an unhandled NotConfiguredError unless explicitly supplied with 0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a manually.
Recommendation: Bundle OPERATOR_REGISTRY directly in default exported address constants for Tokyo (Hideki) testnet.`
  },
  {
    id: 'BUG-02',
    severity: 'MAJOR ($40)',
    title: 'Silent Containment Failure on Indexer Unavailability Drops All Perp Pools to 0',
    details: `In SomniaMarkets.loadMarkets(), perp pool discovery is coupled to indexerRows from GraphQL (listRegistryMarkets).
If the GraphQL endpoint encounters temporary latency or DNS failure, discoverPerpPools fails and silently returns an empty market array with perpDiscoveryFailure: null.
Recommendation: Implement an on-chain fallback using the PerpPoolFactory beacon proxy directly so automated trading bots continue functioning during indexer downtime.`
  },
  {
    id: 'BUG-03',
    severity: 'USABILITY ($15)',
    title: 'CCXT vs Front-End Market Symbol Discrepancy (type="swap" vs "perp")',
    details: `The web application displays markets as "BTC-PERP", but the underlying SDK normalizes perps strictly as ccxt swaps ("BTC/USDso:USDso" with type="swap").
Developers filtering market list by type === "perp" receive an empty set without any warning or helper conversion method.
Recommendation: Provide a displayName() helper and accept both "-PERP" and CCXT swap symbols natively in all SDK verb methods.`
  }
];

export const FeedbackBountyModal: React.FC<FeedbackBountyModalProps> = ({ isOpen, onClose }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-750 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white text-base">
              DreamDEX Feedback Track Submissions ($1,500 Pool)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-dark-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          <p className="text-slate-300">
            DoraHacks awards <span className="text-amber-400 font-bold">$40</span> for each accepted major/critical bug report and <span className="text-amber-400 font-bold">$15</span> for minor items. You can submit these directly on DoraHacks under the <strong>Feedback Track</strong>:
          </p>

          {BOUNTY_REPORTS.map((report) => (
            <div key={report.id} className="p-3.5 rounded-lg bg-dark-950 border border-dark-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40 text-[10px] font-bold">
                  {report.severity}
                </span>
                <button
                  onClick={() => copyToClipboard(report.id, `${report.title}\n\n${report.details}`)}
                  className="px-2.5 py-1 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-300 text-[11px] flex items-center space-x-1 cursor-pointer transition"
                >
                  {copiedId === report.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === report.id ? 'Copied!' : 'Copy Report'}</span>
                </button>
              </div>

              <h4 className="font-semibold text-white text-xs">{report.title}</h4>
              <pre className="text-[11px] font-mono text-slate-300 bg-dark-900 p-2.5 rounded border border-dark-850 whitespace-pre-wrap">
                {report.details}
              </pre>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-dark-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-md text-xs font-semibold cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
