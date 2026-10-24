# README "for testnet" setup connects to Shannon, where the dreamDEX perps bounty markets are not
Severity: normal
Area: docs

## Steps to reproduce
1. Follow the SDK README, "Create an exchange": "For testnet, swap all four: `https://dev.smk.somnia.host/v1/graphql`, `somniaShannon`, `wss://api.infra.testnet.somnia.network/ws`, and `SOMNIA_TESTNET_ADDRESSES`."
2. Compare with where dreamDEX perps run for this bounty: Somnia Tokyo testnet, which is Hideki (chain 50383), indexed at `https://hideki-dev.smk.somnia.host/v1/graphql` with `SOMNIA_HIDEKI_TESTNET_ADDRESSES`.

Or run `npm run feedback:repro` (report [04]).

## Expected
The README names the network the dreamDEX perps app uses, or shows both testnets and says which one has the perps arena.

## Actual
The README only shows Shannon. The `dev.smk` indexer only indexes chain 50312, so following it means you never see the Tokyo markets. The Hideki values are only in `docs/reference/networks-and-endpoints.md`.

## Evidence
```
[04] README testnet setup points at Shannon, but dreamDEX perps run on Hideki (Tokyo)
  perp markets on the Hideki indexer: 21
  perp markets on the README indexer (dev.smk): NotConfiguredError: ... (https://dev.smk.somnia.host/v1/graphql indexes chains [50312])
```

## Environment
@somnia-chain/markets-sdk 0.32.1, Node v25.2.1, Somnia Tokyo testnet (Hideki, chain 50383). Reporter wallet: 0xA43C17c299148fb394c95572211b88c2365954dC (Somnia Account). The repro itself is read-only and uses no wallet.
