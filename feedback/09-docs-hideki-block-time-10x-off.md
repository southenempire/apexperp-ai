# SDK chain definition and docs say Hideki has 10 ms blocks (~100 blocks/s), but the chain produces about 10 blocks/s
Severity: normal
Area: docs

## Steps to reproduce
1. In `@somnia-chain/markets-sdk` 0.32.1, read the JSDoc on `hidekiTestnet` (`src/chains/definitions/hidekiTestnet.ts`). It says blocks land "every **10 ms** (~100 blocks/s) instead of Shannon's 100 ms", and `hidekiTestnet.blockTime` is `10`.
2. Count blocks against the wall clock:
   ```ts
   const a = await client.getBlockNumber();
   await new Promise((r) => setTimeout(r, 10_000));
   const b = await client.getBlockNumber(); // b - a
   ```
3. Check history with block timestamps: `getBlock(n).timestamp` for `n` and `n - 20_000`.

Or run `npm run feedback:repro` in this repo (report [09]).

## Expected
About 100 blocks per second, so `b - a` is about 1,000 after 10 seconds, and 20,000 blocks span about 200 seconds.

## Actual
About 10 blocks per second, one block every 100 ms, which is the figure the same docs give for Shannon. 20,000 blocks span 2,001 seconds of block timestamps.

This matters in practice: viem uses `blockTime` to size its polling and waiting, and developers size latency budgets, `eth_getLogs` windows and "wait N blocks" logic from it. The reporter repeated the 10 ms figure in their own README before measuring.

## Evidence
```
[09] Hideki block time: the SDK says 10 ms (~100 blocks/s), what does the chain do?
  hidekiTestnet.blockTime (ms): 10
  live: 104 blocks in 10.4 s = 10.0 blocks/s (about 100 ms per block)
  history: 20,000 blocks span 2001 s of block timestamps = 10.0 blocks/s
```
Measured twice more while diagnosing: 165 blocks in 16.4 s, and 50,000 blocks over 5,002 s. Both give 10.0 blocks/s.

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383), observed 2026-10-25. Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account). The repro itself is read-only and uses no wallet.
