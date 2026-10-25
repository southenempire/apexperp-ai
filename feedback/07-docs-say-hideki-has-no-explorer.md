# SDK docs and chain definition say Hideki has no block explorer, but dreamDEX documents one that works
Severity: normal
Area: docs

## Steps to reproduce
1. In `@somnia-chain/markets-sdk` 0.32.1, read `docs/reference/networks-and-endpoints.md`. It says: "Block explorers: ... Elwood, Hideki, and local carry no explorer."
2. Check the chain definition:
   ```ts
   import { hidekiTestnet } from '@somnia-chain/markets-sdk/chains';
   hidekiTestnet.blockExplorers; // undefined
   ```
3. Read dreamDEX's "Perps on testnet for developers" page. It lists **Explorer: explorer.testnet.somnia.network/tokyo**.
4. Open `https://explorer.testnet.somnia.network/tokyo/tx/0x6079bcb93848bcae9ef717e61e2aae73c15ac6d201c68a4423481983c12d0435`. It is a real Hideki transaction (status Success, block 31,523,454).

Or run `npm run feedback:repro` in this repo (report [07]).

## Expected
The SDK's `hidekiTestnet` carries `blockExplorers.default` pointing at the Tokyo explorer, as viem chain definitions do, and the SDK docs say the explorer exists.

## Actual
`blockExplorers` is `undefined` and the docs say there is no explorer. Anything that builds transaction links from `chain.blockExplorers` gets nothing. Developers conclude there is no explorer: the reporter did, and wrote it into their own README until the dreamDEX page showed otherwise.

## Evidence
```
[07] SDK chain definition has no explorer, but dreamDEX documents one
  hidekiTestnet.blockExplorers: undefined
  explorer page for a real transaction: https://explorer.testnet.somnia.network/tokyo/tx/0x6079bcb93848bcae9ef717e61e2aae73c15ac6d201c68a4423481983c12d0435
```

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account). The repro itself is read-only and uses no wallet.
