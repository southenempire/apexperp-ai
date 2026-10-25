# Docs say paper USDso cannot open six markets, but the SDK reads and a simulated order allow them
Severity: normal
Area: docs

## Steps to reproduce
1. Read dreamDEX's "Perps on testnet for traders" and "Margin and liquidations" pages. They say paper USDso (the Perps Arena credit voucher) can open or increase positions only in allowlisted markets, and the traders page lists **1000PEPE, LIT, PUMP, VVV, ZEC and ZRO** as not usable.
2. Take an account that holds the voucher and has no positions (the reporter's, `creditFloor` 1,000 USDso) and read it:
   - `client.getPerpLeverage({ marginBank, pool, account })` gives `voucherMarketAllowed`.
   - `client.previewPerpOrderMargin({ pool, marginBank, account, isBid: true, quantity, price })` gives `voucherBlocked`.
   - `eth_call` a small `placeOrder` from the account (msg.sender is the account) on each pool.

Or run `npm run feedback:repro` in this repo (report [08]).

## Expected
The listed markets are blocked for a voucher account (`voucherMarketAllowed: false`, `voucherBlocked: true`, or the order reverts), or the docs are updated to match the chain.

## Actual
All three reads say the markets are allowed, including the six the docs name. `voucherMarketAllowed` is `true` on all 21 pools, `voucherBlocked` is `false`, and a simulated buy on LIT-PERP, ZEC-PERP and ZRO-PERP succeeds with no revert.

Caveat, so this is not overstated: only reads and `eth_call` simulations were used. A real order on those markets was not sent, so if the restriction is enforced somewhere a simulation does not reach (for example at fill time), these reads would not show it. Either way the docs and the SDK disagree.

## Evidence
```
[08] Paper USDso allowlist: docs say six markets are blocked, what does the chain say?
  ETH-PERP      voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
  LIT-PERP      voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
  ZEC-PERP      voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
  ZRO-PERP      voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
  PUMP-PERP     voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
  VVV-PERP      voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
  1000PEPE-PERP voucherMarketAllowed: true  voucherBlocked: false  eth_call: accepted
```

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account, holds the voucher). Observed 2026-10-24. The repro is read-only.
