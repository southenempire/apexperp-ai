# No perp placeOrderFor / cancelOrderFor / reduceOrderFor writes in the SDK, so linked bots cannot use it
Severity: normal
Area: SDK

## Steps to reproduce
1. In the dreamDEX app, link a bot key to a Somnia Account (wallet, Link a bot, tick Perps). The app grants the bot `placeOrderFor`, `cancelOrderFor` and `reduceOrderFor` on every perp pool. This is the flow the "Link a bot" page documents for perps.
2. With `@somnia-chain/markets-sdk`, look for a perp write that places, cancels or reduces an order for the owner:
   ```ts
   Object.keys(exchange.trader).filter((k) => /For$/.test(k));
   ```
3. Check the exported selectors: `PLACE_ORDER_FOR_SELECTOR`, `CANCEL_ORDER_FOR_SELECTOR` and `REDUCE_ORDER_FOR_SELECTOR`.

Or run `npm run feedback:repro` in this repo (report [06]).

## Expected
The SDK offers the same writes the app grants: `trader.placePerpOrderFor`, `cancelPerpOrderFor` and `reducePerpOrderFor`, taking the owner address. A bot signing with a linked key could then use the SDK end to end, as it can for its own account. All three selectors would be exported.

## Actual
- The only `...For` methods on the trader are `depositVaultNativeFor` and `redeemFor`.
- Only two of the three selectors are exported: `PLACE_ORDER_FOR_SELECTOR` and `CANCEL_ORDER_FOR_SELECTOR`. `REDUCE_ORDER_FOR_SELECTOR` is `undefined`, although the app grants `reduceOrderFor` (`0x364c2587`) in the same link step.
- dreamDEX's own bot kit says as much: `packages/perp-core/src/operator.ts` opens with "The markets SDK has no perp `...For` writes, so the three calls are sent here with viem", and hand-writes the ABI and selectors.

Everyone who builds a bot for a Somnia Account, which is the default dreamDEX account, has to rewrite this. Suggested fix: add the three perp `...For` writes, plus `REDUCE_ORDER_FOR_SELECTOR`.

## Evidence
```
[06] No perp ...For writes in the SDK, and no REDUCE_ORDER_FOR selector
  trader methods ending in "For": [ 'depositVaultNativeFor', 'redeemFor' ]
  PLACE_ORDER_FOR_SELECTOR: 0x80054449
  CANCEL_ORDER_FOR_SELECTOR: 0xe37b444b
  REDUCE_ORDER_FOR_SELECTOR: undefined
```
Workaround in this repo: `agent/linked.ts`, with a test (`scripts/sentinel.test.ts`) that checks the derived selectors against the SDK's two constants.

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account). The repro itself is read-only and uses no wallet.
