# New explorer: a Tokyo testnet perp trade is labelled with the pool address, not the market, and has no side or account
Severity: normal
Area: app

## Steps to reproduce
1. Open `https://explorer.testnet.somnia.network/tokyo/tx/0x05fa91ea29f12038f7369f38c01babc604cfc1a6061f5ef1b8c3c1c87984e2ec` (a market buy of 15 LIT-PERP, placed through a linked bot for the account `0xa43c…54dc`).
2. Read "What this transaction did". It says: `TRADE`, then `0xdcb0…2a3f · 15 @ 3.0162`.
3. Compare with a mainnet trade on the new explorer, `https://new.explorer.somnia.network/tx/0xb0e0b021157c18ca097ba24eab6f7a8364716db6195314b46f1a6cf6e59ecb1b`. Its card reads `WBTC/USDso · 0.00011 @ 80,250.9`, with the market named.
4. On the Tokyo transaction page, check the "To" and "Method" rows: `To` is the bare address `0xdcb0ad22…2a3f` (no name) and `Method` is the raw selector `0x80054449`.
5. Open the same transaction in the Markets view (see report 11 for the URL that works). It shows `MARKETS TOUCHED: LIT/USDso perp · 0xdcb0…2a3f`, `TRADE buy 3.0162 15 0xa43c…54dc` and the order as "buy, limit 3.0725, size 15, filled 15".

## Expected
The transaction page uses what the explorer already knows from the Markets view: `LIT/USDso perp · 15 @ 3.0162`, and ideally the side and the account the order belongs to. When a linked bot sends the transaction, the page shows the owner the order was placed for (`0xa43c…54dc`), not only the bot's address as `From`.

## Actual
The card shows the pool contract address in place of the market name, with no side and no account. Anyone looking at a perps transaction from the transaction page cannot tell which market it was, whether it was a buy or a sell, or whose position it touched, without opening the Markets view. For a linked-bot order the only account shown on that page is the bot, which is not the account that holds the position.

The `To` contract is unverified, so the method is not decoded, which is a likely reason. The Markets view still resolves the pool to `LIT/USDso perp`, so the name is available.

## Evidence
```
/tokyo/tx/0x05fa91ea…e2ec
  TRADE
  0xdcb0…2a3f · 15 @ 3.0162
  From   0x4166060d459d2713d4a55ed4fa0f516e60ff803c   (the bot)
  To     0xdcb0ad226727b2ce92857f0af5751389d42b2a3f   (unnamed, unverified)
  Method 0x80054449                                   (placeOrderFor)

Markets view, same transaction
  MARKETS TOUCHED  LIT/USDso perp · 0xdcb0…2a3f
  TRADE            buy   3.0162   15   0xa43c…54dc
```
The numbers on the transaction page are right: gas used 2,778,883, gas price 6 gwei and fee 0.016673 STT match `eth_getTransactionReceipt` on the Tokyo RPC exactly (0.016673298 STT).

## Environment
Chrome (Claude desktop built-in browser) on macOS, viewport 1280x900, 28 Oct 2026. Somnia Tokyo testnet (chain 50383), `explorer.testnet.somnia.network`. Pool `0xdcb0ad226727b2ce92857f0af5751389d42b2a3f` (LIT-PERP).
