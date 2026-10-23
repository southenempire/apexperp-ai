/**
 * Browser connection to dreamDEX perps on Somnia Tokyo testnet. Starts read-only;
 * the wallet hook binds a signer with `exchange.setSigner` when the user connects.
 */

import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';

export { MARGIN_BANK, loadPerps, planReduceOrder, publicClient, type PerpInfo } from '../../agent/markets';

export const INDEXER_URL = 'https://hideki-dev.smk.somnia.host/v1/graphql';
export const WS_RPC_URL = 'wss://api.hideki2.infra.testnet.somnia.network/ws';
export const HTTP_RPC_URL = 'https://api.hideki2.infra.testnet.somnia.network';
export const REPO_URL = 'https://github.com/southenempire/apexperp-ai';
export const PROOF_URL = `${REPO_URL}/blob/main/PROOF.md`;
export const DREAMDEX_URL = 'https://app.testnet.dreamdex.io';

export const chain = hidekiTestnet;

export const exchange = new SomniaMarkets({
  indexerUrl: INDEXER_URL,
  chain: hidekiTestnet,
  wsRpcUrl: WS_RPC_URL,
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
});

/** Default Sentinel thresholds, matching agent/config.ts. */
export const DEFAULT_THRESHOLDS = { reduceBelowHealth: 1.5, flattenBelowHealth: 1.15, reducePercentage: 25 };
export const MAX_SLIPPAGE = 0.02;
export const ORDER_TYPE_MARKET = 2;
