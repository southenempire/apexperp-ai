# Technical Bug Reports & Protocol Feedback

**Program:** dreamDEX Perps Builder Bounty — Feedback Track  
**Author:** southenempire  
**Target:** `@somnia-chain/markets-sdk` (v0.1.0) & `somnia-chain/dreamdex-bot-kit`  
**Environment:** Somnia Tokyo Testnet (Chain ID: `50383`), Node v25.2.1

---

### Issue 1: Missing `OPERATOR_REGISTRY` Address in Default `SOMNIA_TESTNET_ADDRESSES`

* **Severity:** Major ($40)
* **Component:** `@somnia-chain/markets-sdk/dist/addresses.js`, `placePerpStopOrder`
* **Root Cause:**
  When executing or arming bracket stop orders (`placePerpStopOrder`), the SDK attempts to look up the `operatorRegistry` contract address from the bundled `SOMNIA_TESTNET_ADDRESSES` map. However, the address for Hideki / Tokyo (`0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a`) is absent from this constant.

* **Minimal Reproducible Example (MRE):**
  ```typescript
  import { createExchange } from "@dreamdex-bot-kit/perp-core";
  import { placePerpStopOrder } from "@somnia-chain/markets-sdk";

  // Throws unhandled NotConfiguredError because operatorRegistry is undefined
  await placePerpStopOrder(ctx.exchange, {
    symbol: "ETH-PERP",
    triggerPrice: 2400n,
    direction: "below",
  });
  ```

* **Error Output:**
  ```text
  NotConfiguredError: operatorRegistry is not configured in SOMNIA_TESTNET_ADDRESSES
      at placePerpStopOrder (node_modules/@somnia-chain/markets-sdk/dist/perp/stops.js:42:15)
  ```

* **Recommended Patch:**
  ```diff
  --- a/node_modules/@somnia-chain/markets-sdk/src/addresses.ts
  +++ b/node_modules/@somnia-chain/markets-sdk/src/addresses.ts
  @@ -15,4 +15,5 @@ export const SOMNIA_TESTNET_ADDRESSES = {
     marginBank: "0x15C7e8CE38F021c5b45d098AaD788f63090bF20A",
  +  operatorRegistry: "0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a",
   };
  ```

---

### Issue 2: `loadMarkets()` Silently Absorbs Indexer Network Exceptions and Reports 0 Pools

* **Severity:** Major ($40)
* **Component:** `SomniaMarkets.loadMarkets()` in `@somnia-chain/markets-sdk/dist/unified/exchange.js`
* **Root Cause:**
  In `readMarkets()`, perp discovery begins by querying `this.client.listRegistryMarkets()`. If the GraphQL indexer endpoint (`https://hideki-dev.smk.somnia.host/v1/graphql`) encounters temporary DNS timeouts or HTTP 5xx errors, the error is caught internally on line 385. Rather than escalating the error or triggering direct on-chain RPC discovery against `PerpPoolFactory`, it returns `{ statuses: new Map(), chainOnly: [], failed: [] }` and sets `perpDiscoveryFailure: null`.

* **Minimal Reproducible Example (MRE):**
  ```typescript
  import { SomniaMarkets } from "@somnia-chain/markets-sdk";

  const client = new SomniaMarkets({
    indexerUrl: "https://invalid-subdomain.smk.somnia.host/v1/graphql",
    wsRpcUrl: "wss://api.hideki2.infra.testnet.somnia.network/ws",
  });

  const markets = await client.loadMarkets(true);
  console.log(Object.keys(markets).length); // Prints 0
  console.log(client.perpDiscoveryFailure); // Prints null (no error indicated!)
  ```

* **Impact:**
  Automated bots and risk daemons believe the venue has closed or has no markets, rather than recognizing a network partition. Bots fail silently without attempting backoff reconnection.

* **Recommended Patch:**
  Expose the root cause error in `perpDiscoveryFailure` so consumers can differentiate between "empty market registry" and "indexer unreachable", or provide an automated RPC fallback directly to the beacon proxy.

---

### Issue 3: Inconsistent Symbol Parsing Between App UI ("-PERP") and SDK CCXT Format ("type: swap")

* **Severity:** Minor / Usability ($15)
* **Component:** Market Resolution in `@somnia-chain/markets-sdk`
* **Root Cause:**
  The DreamDEX testnet UI surfaces markets as `BTC-PERP` and `ETH-PERP`. However, the SDK maps these strictly to CCXT format: `BTC/USDso:USDso` with `market.type === "swap"`. Filtering by `type === "perp"` returns an empty set.

* **Impact:**
  New developers building on the SDK expect `type: "perp"` or `display` symbols to be valid arguments to `fetchOrderBook()` or `placeOrder()`, leading to runtime `InvalidInputError: unknown market ref` exceptions.

* **Recommended Patch:**
  Add a canonical mapping layer inside `SomniaMarkets` that resolves both `BTC-PERP` and `BTC/USDso:USDso` interchangeably without requiring third-party normalization wrappers.
