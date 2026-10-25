/**
 * Every transaction the dapp sends for a wallet, kept in this browser so the trader can
 * paste it into PROOF.md. Same columns as agent/proof.ts, so CLI and dapp rows line up.
 */

import { useCallback, useEffect, useState } from 'react';
import { explorerTx } from '../../agent/explorer';

export interface DappProof {
  timestamp: string;
  kind: 'DAPP_TRIM' | 'DAPP_CLOSE' | 'ARM_TRIM_STOP' | 'ARM_CLOSE_STOP' | 'CANCEL_STOPS';
  account: string;
  market: string;
  side: 'buy' | 'sell';
  quantity: string;
  limitPrice: string;
  txHash: string;
  block: string;
  status: string;
  healthBefore?: number;
}

const KEY = 'apexperp:proof';
const EVENT = 'apexperp:proof-changed';

function read(): DappProof[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function recordDappProof(entry: DappProof) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...read(), entry]));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage blocked: the toast still shows the hash, so nothing is lost for the user.
  }
}

export function proofToMarkdown(rows: DappProof[]): string {
  return rows
    .map((e) => {
      const health = e.healthBefore === undefined ? '' : `${e.healthBefore.toFixed(3)}x`;
      return `| ${e.timestamp} | ${e.kind} | ${e.market} | ${e.side} | ${e.quantity} | ${e.limitPrice} | ${health} | ${e.block} | ${e.status} | [${e.txHash.slice(0, 10)}…${e.txHash.slice(-6)}](${explorerTx(e.txHash)}) |`;
    })
    .join('\n');
}

export function useProofLog(account: string | null) {
  const [rows, setRows] = useState<DappProof[]>(() => read());
  useEffect(() => {
    const sync = () => setRows(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const mine = account ? rows.filter((r) => r.account.toLowerCase() === account.toLowerCase()) : [];
  const clear = useCallback(() => {
    if (!account) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(read().filter((r) => r.account.toLowerCase() !== account.toLowerCase())));
      window.dispatchEvent(new Event(EVENT));
    } catch {}
  }, [account]);
  return { rows: mine, clear };
}
