/**
 * Reproduces every report in feedback/ against Somnia Tokyo testnet (Hideki, 50383).
 * Read-only: no wallet or funds needed.
 *
 *   npm run feedback:repro
 */

import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const WS = 'wss://api.hideki2.infra.testnet.somnia.network/ws';
// Any key works: these repros only build transactions, they never send one.
const KEY = `0x${'22'.repeat(32)}` as const;

const exchange = new SomniaMarkets({ indexerUrl: INDEXER, chain: hidekiTestnet, wsRpcUrl: WS, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey: KEY });
const err = (e: unknown) => `${(e as Error).name}: ${(e as Error).message.split('\n')[0]}`;

async function main() {
  await exchange.loadMarkets();
  const eth = (await exchange.client.listPerpMarkets()).find((m) => m.baseSymbol === 'ETH')!;

  console.log('\n[01] Hideki preset has no operatorPermissionsRegistry, so perp stops cannot be built');
  console.log('  preset value:', (SOMNIA_HIDEKI_TESTNET_ADDRESSES as Record<string, unknown>).operatorPermissionsRegistry);
  const leg = { registry: eth.stopRegistry!, pool: eth.poolAddress, isBid: false, quantity: 0n, triggerPrice: 2000n * 10n ** 18n, triggerOperator: 1 as const, stopOrderType: 1 as const };
  try {
    await exchange.trader.buildPlacePerpStopOrder(leg);
    console.log('  build: OK (fixed)');
  } catch (e) {
    console.log('  build without operatorRegistry ->', err(e));
  }
  const discovered = await exchange.client.getOperatorPermissionsRegistry(eth.poolAddress);
  console.log('  registry the pool actually uses:', discovered);
  await exchange.trader.buildPlacePerpStopOrder({ ...leg, operatorRegistry: discovered! });
  console.log('  build with it passed explicitly -> OK');

  console.log('\n[02] Symbols written in docs/PERPS.md are rejected by the SDK');
  for (const sym of ['ETH/USDSO:USDSO', 'ETH/USDso:USDso']) {
    try {
      await exchange.fetchTicker(sym);
      console.log(`  ${sym} -> OK`);
    } catch (e) {
      console.log(`  ${sym} -> ${err(e)}`);
    }
  }

  console.log('\n[03] "unknown symbol" error tells you to call loadMarkets() after it already ran');
  console.log('  markets loaded:', Object.keys(exchange.markets).length);
  try {
    await exchange.fetchTicker('ETH-PERP');
  } catch (e) {
    console.log('  ETH-PERP (the dreamDEX app name) ->', err(e));
  }

  console.log('\n[04] README testnet setup points at Shannon, but dreamDEX perps run on Hideki (Tokyo)');
  const shannon = new SomniaMarkets({ indexerUrl: 'https://dev.smk.somnia.host/v1/graphql', addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, chain: hidekiTestnet, wsRpcUrl: WS });
  const [hidekiPerps, shannonPerps] = await Promise.all([
    exchange.client.listPerpMarkets(),
    shannon.client.listPerpMarkets().catch((e) => e as Error),
  ]);
  console.log('  perp markets on the Hideki indexer:', hidekiPerps.length);
  console.log('  perp markets on the README indexer (dev.smk):', Array.isArray(shannonPerps) ? shannonPerps.length : err(shannonPerps));

  console.log('\n[05] No reduce-only option on placePerpOrder and no client read for reducing capacity');
  const trader = exchange.trader as unknown as Record<string, unknown>;
  const client = exchange.client as unknown as Record<string, unknown>;
  console.log('  client.getReducingCapacity:', typeof client.getReducingCapacity);
  console.log('  trader.placePerpOrder exists:', typeof trader.placePerpOrder, '(PlacePerpOrderParams has no reduceOnly field)');

  console.log('\n[06] No perp ...For writes in the SDK, and no REDUCE_ORDER_FOR selector');
  const sdk = (await import('@somnia-chain/markets-sdk')) as unknown as Record<string, unknown>;
  console.log('  trader methods ending in "For":', Object.keys(trader).filter((k) => /For$/.test(k)));
  for (const name of ['PLACE_ORDER_FOR_SELECTOR', 'CANCEL_ORDER_FOR_SELECTOR', 'REDUCE_ORDER_FOR_SELECTOR']) console.log(`  ${name}:`, sdk[name]);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
