# No reduce-only option for perp orders and no SDK read for reducing capacity
Severity: normal
Area: SDK

## Steps to reproduce
1. Try to send a reduce-only market order with `trader.placePerpOrder(...)`. `PlacePerpOrderParams` has no `reduceOnly` field.
2. Try to find how much an opposite order can reduce without opening exposure. The PerpPool has `getReducingCapacity(address)`, and the SDK uses it inside `previewPerpOrderMargin`, but `client` exposes no method for it.

Or run `npm run feedback:repro` (report [05]).

## Expected
Risk tools (stop-losses, liquidation guards, de-leveraging bots) can send an order that is guaranteed to only shrink a position, the way `PerpStopOrderRegistry` already supports `intent: "reduceOnly"` for stops.

## Actual
A bot has to hand-write the PerpPool ABI to read `getReducingCapacity`, clamp the quantity itself, and hope nothing changes before the order lands. If a resting order or a fill changes the position in between, the "reduce" can flip it into new exposure.

Suggested: a `reduceOnly` flag on `placePerpOrder` (clamped or rejected on-chain), and `client.getReducingCapacity({ pool, account })`.

## Evidence
```
[05] No reduce-only option on placePerpOrder and no client read for reducing capacity
  client.getReducingCapacity: undefined
  trader.placePerpOrder exists: function (PlacePerpOrderParams has no reduceOnly field)
```
Workaround in this repo: `agent/markets.ts` (`reducingCapacityAbi`, `planReduceOrder`).

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Read-only repro.
