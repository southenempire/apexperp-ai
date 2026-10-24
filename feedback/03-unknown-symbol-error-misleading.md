# "unknown symbol" error says to call loadMarkets() even after it ran, and the app's ETH-PERP name is not accepted
Severity: normal
Area: SDK

## Steps to reproduce
1. `await exchange.loadMarkets()` on Tokyo testnet (30 markets load).
2. `await exchange.fetchTicker('ETH-PERP')`, the name the dreamDEX app shows for the market.

Or run `npm run feedback:repro` (report [03]).

## Expected
Either the app's display name resolves to the market, or the error says the symbol was not found among the loaded markets and suggests the closest match (`ETH/USDso:USDso`).

## Actual
```
InvalidInputError: @somnia-chain/markets-sdk: unknown symbol ETH-PERP — call loadMarkets() first
```
`loadMarkets()` already ran, so the hint sends people to debug the wrong thing. Traders moving from the app to the SDK naturally try `ETH-PERP` first.

## Evidence
```
[03] "unknown symbol" error tells you to call loadMarkets() after it already ran
  markets loaded: 30
  ETH-PERP (the dreamDEX app name) -> InvalidInputError: @somnia-chain/markets-sdk: unknown symbol ETH-PERP — call loadMarkets() first
```

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account). The repro itself is read-only and uses no wallet.
