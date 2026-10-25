# eth_getLogs on the Hideki RPC rejects ranges over 1,000 blocks (about 100 seconds), with a non-standard error and no mention in the docs
Severity: normal
Area: API

## Steps to reproduce
1. Call `eth_getLogs` on `https://api.hideki2.infra.testnet.somnia.network` for the MarginBank (`0x478769E1177C0773c43A593DCCc4Ad15F15F1394`) over a range ending at the head block:
   - the last 100 blocks, the last 1,000 blocks, the last 1,001 blocks, and the last 5,000 blocks.
2. Read the response for the 5,000-block range.

Or run `npm run feedback:repro` in this repo (report [10]).

## Expected
Either larger ranges work, or the limit is documented on "Perps on testnet for developers" and the error uses the usual code for a range or result limit (`-32005`, per EIP-1474). Hideki produces about 10 blocks a second, so 1,000 blocks is only about 100 seconds of chain time.

## Actual
Ranges up to 1,000 blocks (1,001 blocks inclusive) work. Anything wider fails with:
```
error -1: block range exceeds 1000
```
The code `-1` is not a standard JSON-RPC code, and the developer page lists no `eth_getLogs` limit. Scanning an hour of events takes about 36 requests, and a client that does not know the limit gets an opaque `RPC Request failed` from viem.

The reporter hit this while checking whether a bot link had been recorded: four-thousand-block scans all failed until the 1,000-block cap was found by trial.

## Evidence
```
[10] eth_getLogs block range limit on the Hideki RPC
  last 100 blocks (10 s of chain time): ok, 473 logs
  last 1000 blocks (100 s of chain time): ok, 4726 logs
  last 1001 blocks (100 s of chain time): ok, 4729 logs
  last 5000 blocks (500 s of chain time): error -1: block range exceeds 1000
```

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383), observed 2026-10-25. Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account). The repro itself is read-only and uses no wallet.
