# New explorer: "Open in Markets" on a Tokyo testnet trade goes to a 404, and the working Markets URL carries no chain
Severity: normal
Area: app

## Steps to reproduce
1. Open a real perp trade on the new explorer, on Tokyo testnet (chain 50383):
   `https://explorer.testnet.somnia.network/tokyo/tx/0x05fa91ea29f12038f7369f38c01babc604cfc1a6061f5ef1b8c3c1c87984e2ec`
   The "What this transaction did" card shows TRADE and an **Open in Markets →** link.
2. Click it. It goes to `/tokyo/markets/tx/0x05fa91ea…e2ec` and shows "404 Nothing at this address".
3. Open `/tokyo/markets` and `/tokyo/markets/perps` directly. Both show the same 404.
4. The Markets pages do exist, without the `/tokyo` prefix:
   `https://explorer.testnet.somnia.network/markets/tx/0x05fa91ea29f12038f7369f38c01babc604cfc1a6061f5ef1b8c3c1c87984e2ec`
   This renders the trade correctly when the browser has already picked Tokyo testnet in the chain selector (it is kept in `localStorage` under `somnia-chain`).
5. Clear site data (or open it in a fresh profile) and load the same URL from step 4. The header says **Global 5031**, the footer says "global · chain 5031", and the page stays on "Reading the transaction…" for at least 16 seconds with no result and no error.

On mainnet the same link shape works: `https://new.explorer.somnia.network/markets/tx/0xb0e0b021157c18ca097ba24eab6f7a8364716db6195314b46f1a6cf6e59ecb1b` loads the Markets view for that trade.

## Expected
- The link on a Tokyo testnet trade opens that trade's Markets page.
- A Markets URL for a Tokyo testnet transaction either carries the chain (as `/tokyo/tx/…` does) or, like the main transaction page does ("Not on Global. This transaction is on Tokyo testnet. Open on Tokyo testnet"), says which chain the transaction is on.

## Actual
- The link built from the Tokyo transaction page is the one URL shape that 404s.
- The URL that works depends on a value stored in the browser, not on the link. Anyone who follows a shared link in a fresh browser lands on Global and waits on a spinner. Perps trades only exist on Tokyo testnet, so that is the case a perps user hits first.

## Evidence
```
GET /tokyo/tx/0x05fa91ea…e2ec            -> Transaction page, SUCCESS, TRADE 15 @ 3.0162, link href="/tokyo/markets/tx/0x05fa91ea…e2ec"
GET /tokyo/markets/tx/0x05fa91ea…e2ec    -> 404 Nothing at this address
GET /tokyo/markets                       -> 404 Nothing at this address
GET /tokyo/markets/perps                 -> 404 Nothing at this address
GET /markets/tx/0x05fa91ea…e2ec          -> renders the trade when localStorage somnia-chain = "tokyo-testnet"
                                            (buy, limit 3.0725, size 15, filled 15, owner 0xa43c…54dc, "Filled · crossed on arrival")
GET /markets/tx/0x05fa91ea…e2ec          -> header "Global 5031", stuck on "Reading the transaction…" when localStorage is empty
```
The transaction exists: block 35,210,700, status success, confirmed through the RPC `eth_getTransactionReceipt` on `https://api.hideki2.infra.testnet.somnia.network`.

## Environment
Chrome (Claude desktop built-in browser) on macOS, viewport 1280x900, 28 Oct 2026. Somnia Tokyo testnet (chain 50383), `explorer.testnet.somnia.network`. Transaction placed by a linked bot key for a Somnia Account (`placeOrderFor` on the LIT-PERP pool `0xdcb0ad226727b2ce92857f0af5751389d42b2a3f`).
