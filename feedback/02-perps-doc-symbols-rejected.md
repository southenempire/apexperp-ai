# docs/PERPS.md lists perp symbols the SDK rejects, and says only BTC and ETH are live
Severity: normal
Area: docs

## Steps to reproduce
1. Open `docs/PERPS.md` in `@somnia-chain/markets-sdk` 0.32.1. Line 3 reads: "Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`".
2. Use that symbol on Tokyo testnet after `loadMarkets()`:
   ```ts
   await exchange.loadMarkets();
   await exchange.fetchTicker('ETH/USDSO:USDSO');
   ```
3. Count perp markets: `(await exchange.client.listPerpMarkets()).length`.

Or run `npm run feedback:repro` (report [02]).

## Expected
The documented symbol works, and the page reflects the markets that are live.

## Actual
- `ETH/USDSO:USDSO` throws `InvalidInputError: unknown symbol ETH/USDSO:USDSO — call loadMarkets() first`. Symbols are case-sensitive and the real one is `ETH/USDso:USDso`.
- Tokyo testnet has 21 live perp markets, not two.

A developer copying from the perps guide gets an error on their first call. Suggested fix: write symbols as `ETH/USDso:USDso`, say they are case-sensitive, and list markets per network (or point to `listPerpMarkets()`).

## Evidence
```
[02] Symbols written in docs/PERPS.md are rejected by the SDK
  ETH/USDSO:USDSO -> InvalidInputError: @somnia-chain/markets-sdk: unknown symbol ETH/USDSO:USDSO — call loadMarkets() first
  ETH/USDso:USDso -> OK
```
`listPerpMarkets()` on the Hideki indexer returns 21 rows (ZRO, LIT, VVV, 1000PEPE, PUMP, ZEC, TAO, WLD, NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH, BTC).

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Read-only repro.
