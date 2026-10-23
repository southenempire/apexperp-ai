/**
 * Append-only record of every transaction the agent sends, so each one can be
 * checked against the chain. Hideki has no public explorer: verify a hash with
 * `eth_getTransactionReceipt` on https://api.hideki2.infra.testnet.somnia.network.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSONL = resolve(ROOT, 'proof/transactions.jsonl');
const MARKDOWN = resolve(ROOT, 'PROOF.md');

export interface ProofEntry {
  timestamp: string;
  kind: 'SENTINEL_REDUCE' | 'SENTINEL_FLATTEN' | 'OPEN_POSITION';
  market: string;
  side: 'buy' | 'sell';
  quantity: string;
  limitPrice: string;
  txHash: string;
  block: string;
  status: string;
  healthBefore?: number;
  note?: string;
}

export function recordProof(entry: ProofEntry): void {
  mkdirSync(dirname(JSONL), { recursive: true });
  appendFileSync(JSONL, JSON.stringify(entry) + '\n');

  if (!existsSync(MARKDOWN)) {
    writeFileSync(
      MARKDOWN,
      [
        '# On-chain proof',
        '',
        'Every transaction ApexPerp sent on Somnia Tokyo testnet (Hideki, chain 50383), appended automatically.',
        'Verify any hash with `eth_getTransactionReceipt` against `https://api.hideki2.infra.testnet.somnia.network`.',
        '',
        '| Time (UTC) | Action | Market | Side | Qty | Limit | Health before | Block | Status | Tx hash |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        '',
      ].join('\n'),
    );
  }
  const health = entry.healthBefore === undefined ? '' : `${entry.healthBefore.toFixed(3)}x`;
  appendFileSync(
    MARKDOWN,
    `| ${entry.timestamp} | ${entry.kind} | ${entry.market} | ${entry.side} | ${entry.quantity} | ${entry.limitPrice} | ${health} | ${entry.block} | ${entry.status} | \`${entry.txHash}\` |\n`,
  );
}
