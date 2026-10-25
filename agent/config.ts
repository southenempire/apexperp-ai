/**
 * Sentinel configuration, read from the environment (.env is loaded by `tsx --env-file`).
 */

import { isAddress, type Address, type Hex } from 'viem';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number, got "${raw}"`);
  return value;
}

export interface SentinelEnv {
  /** The signing key. With OWNER_ADDRESS set it is a bot key linked to that account, not the account's own key. */
  privateKey: Hex;
  /** The dreamDEX account to guard when the key is a linked bot (wallet -> Link a bot -> Perps in the app). */
  ownerAddress?: Address;
  /** Exit after the first protective action. Handy for a one-shot proof run. */
  once: boolean;
  indexerUrl: string;
  wsRpcUrl: string;
  /** Trim positions when equity / maintenance margin falls to or below this. */
  reduceBelowHealth: number;
  /** Close every position when equity / maintenance margin falls to or below this. */
  flattenBelowHealth: number;
  /** Share of each position closed by one trim, in percent. */
  reducePercentage: number;
  /** Worst price a protective market order may fill at, as a fraction of mark. */
  maxSlippage: number;
  pollIntervalMs: number;
  /** Wait this long after an action before acting again, so the chain state settles. */
  cooldownMs: number;
  /** Evaluate and log decisions without sending transactions. */
  dryRun: boolean;
}

export function loadEnv(): SentinelEnv {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('PRIVATE_KEY must be set to a 0x-prefixed 32-byte hex key (see .env.example)');
  }

  const owner = process.env.OWNER_ADDRESS;
  if (owner && !isAddress(owner)) throw new Error('OWNER_ADDRESS must be a 0x address');

  const env: SentinelEnv = {
    privateKey: privateKey as Hex,
    ownerAddress: owner ? (owner as Address) : undefined,
    once: process.env.ONCE === '1' || process.env.ONCE === 'true',
    indexerUrl: process.env.INDEXER_URL || 'https://hideki-dev.smk.somnia.host/v1/graphql',
    wsRpcUrl: process.env.WS_RPC_URL || 'wss://api.hideki2.infra.testnet.somnia.network/ws',
    reduceBelowHealth: num('REDUCE_BELOW_HEALTH', 1.5),
    flattenBelowHealth: num('FLATTEN_BELOW_HEALTH', 1.15),
    reducePercentage: num('REDUCE_PERCENTAGE', 25),
    maxSlippage: num('MAX_SLIPPAGE', 0.02),
    pollIntervalMs: num('POLL_INTERVAL_MS', 1000),
    cooldownMs: num('COOLDOWN_MS', 5000),
    dryRun: process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true',
  };

  if (env.flattenBelowHealth >= env.reduceBelowHealth) {
    throw new Error('FLATTEN_BELOW_HEALTH must be lower than REDUCE_BELOW_HEALTH');
  }
  if (env.reducePercentage <= 0 || env.reducePercentage > 100) {
    throw new Error('REDUCE_PERCENTAGE must be in (0, 100]');
  }
  return env;
}
