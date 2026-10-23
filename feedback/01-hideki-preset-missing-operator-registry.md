# Perp stop orders fail on Tokyo testnet: Hideki address preset has no operatorPermissionsRegistry
Severity: major
Area: SDK

## Steps to reproduce
1. Create an exchange for Somnia Tokyo testnet with the preset the docs recommend for Hideki:
   ```ts
   import { SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
   import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';
   const exchange = new SomniaMarkets({
     indexerUrl: 'https://hideki-dev.smk.somnia.host/v1/graphql',
     chain: hidekiTestnet,
     wsRpcUrl: 'wss://api.hideki2.infra.testnet.somnia.network/ws',
     addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
     privateKey,
   });
   ```
2. Take any perp market, e.g. ETH (`stopRegistry` from `client.listPerpMarkets()`).
3. Build or place a reduce-only stop without passing `operatorRegistry`:
   ```ts
   await exchange.trader.buildPlacePerpStopOrder({
     registry: eth.stopRegistry, pool: eth.poolAddress,
     isBid: false, quantity: 0n, triggerPrice: 2000n * 10n ** 18n,
     triggerOperator: 1, stopOrderType: 1,
   });
   ```

Or run `npm run feedback:repro` in this repo (report [01]).

## Expected
The stop builds, as it does on Shannon. `PlacePerpStopOrderParams.operatorRegistry` is documented as "Resolved from the live config (addresses.operatorPermissionsRegistry) if omitted", so the Hideki preset should carry that address.

## Actual
```
NotConfiguredError: @somnia-chain/markets-sdk: a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry
```
`SOMNIA_HIDEKI_TESTNET_ADDRESSES.operatorPermissionsRegistry` is `undefined`. The registry exists: `client.getOperatorPermissionsRegistry(ethPool)` returns `0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a`, and passing that explicitly makes the same call succeed.

Every TP/SL, stop-loss and liquidation-guard app on Tokyo hits this on its first stop. Suggested fix: add `operatorPermissionsRegistry: "0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a"` to the Hideki preset, or fall back to `getOperatorPermissionsRegistry(pool)` when the config has none.

## Evidence
Output of `npm run feedback:repro`:
```
[01] Hideki preset has no operatorPermissionsRegistry, so perp stops cannot be built
  preset value: undefined
  build without operatorRegistry -> NotConfiguredError: @somnia-chain/markets-sdk: a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry
  registry the pool actually uses: 0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a
  build with it passed explicitly -> OK
```
Workaround used in production code: `agent/protection.ts` (`stopContext`).

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Read-only repro, no wallet needed.
