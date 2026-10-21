# DreamDEX Perps SDK & Infrastructure Bug & Audit Report
**Submitted for:** dreamDEX Perps Builder Bounty — Feedback Track ($1,500 Prize Pool)  
**Reporter:** southenempire  
**Target:** `@somnia-chain/markets-sdk` and `somnia-chain/dreamdex-bot-kit` on Somnia Tokyo Testnet (Hideki, Chain ID: 50383)

---

### Issue 1: Missing `OPERATOR_REGISTRY` in `SOMNIA_TESTNET_ADDRESSES` Causes Unhandled Revert on Stop Orders
* **Severity:** Major / Critical ($40)
* **Affected Component:** `@somnia-chain/markets-sdk/dist/addresses.js`, `placePerpStopOrder`
* **Description:**
  When executing or arming bracket stop orders (e.g. Stop-Loss and Take-Profit) via `placePerpStopOrder()`, the method attempts to resolve the `OperatorPermissionsRegistry` address from `SOMNIA_TESTNET_ADDRESSES`. However, this contract address (`0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a` on Hideki / Tokyo) is omitted from the bundled address mappings.
* **Reproduction Steps:**
  1. Call `placePerpStopOrder()` using default SDK configuration with `SOMNIA_TESTNET_ADDRESSES`.
  2. The call throws an unhandled `NotConfiguredError`.
* **Impact:** Any trading bot using bracket stops or stop-loss protection crashes unless developers hunt down the undeclared address and manually override the parameter.
* **Proposed Fix:**
  Add the `operatorRegistry` key to `SOMNIA_TESTNET_ADDRESSES` in `addresses.ts` so developers can arm stop orders out-of-the-box.

---

### Issue 2: Silent Containment Failure on Indexer Unavailability Drops All Perp Pools to 0
* **Severity:** Major ($40)
* **Affected Component:** `SomniaMarkets.loadMarkets()` in `@somnia-chain/markets-sdk/dist/unified/exchange.js`
* **Description:**
  In `readMarkets()`, perp pool discovery is coupled to `listRegistryMarkets()`. When the GraphQL endpoint encounters temporary network latency, DNS resolution failure, or indexer sync delay, `discoverPerpPools()` catches the error internally and returns an empty list (`{ statuses: new Map(), chainOnly: [], failed: [] }`) while setting `perpDiscoveryFailure: null`.
* **Reproduction Steps:**
  1. Initialize `SomniaMarkets` with a non-resolving indexer host or during an indexer outage.
  2. Call `await exchange.loadMarkets(true)`.
  3. The promise resolves successfully, returning an empty dictionary (`{}`) with 0 markets and `perpDiscoveryFailure` set to `null`.
* **Impact:** Automated bots assume there are no live markets rather than recognizing that discovery failed, preventing automated reconnection or retry loops.
* **Proposed Fix:**
  Fall back to direct RPC calls on the `PerpPoolFactory` beacon proxy when the GraphQL indexer is unreachable, or populate `perpDiscoveryFailure` with the underlying connection error rather than absorbing it.

---

### Issue 3: Market Type Symbol Discrepancy (type="swap" vs app UI "-PERP")
* **Severity:** Minor / Usability ($15)
* **Affected Component:** Symbol Resolution in `@somnia-chain/markets-sdk`
* **Description:**
  The DreamDEX frontend and docs list markets with standard ticker notation (e.g. `BTC-PERP`, `ETH-PERP`). However, `SomniaMarkets.loadMarkets()` maps perp futures internally as CCXT `swap` objects (`BTC/USDso:USDso`, `type: "swap"`).
* **Impact:** Developers attempting to filter `loadMarkets()` by `m.type === "perp"` receive empty arrays without an actionable error message.
* **Proposed Fix:**
  Export a unified `displayName()` helper from `@somnia-chain/markets-sdk` and accept both `-PERP` and CCXT notation across all order placement verbs.
