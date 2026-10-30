<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-dark.svg">
    <img src="public/brand/logo-light.svg" alt="ApexPerp" height="48">
  </picture>
</p>

<p align="center"><b>Get trimmed, not liquidated.</b><br>A liquidation guard for dreamDEX perps on Somnia.</p>

<p align="center">
  <a href="https://southenempire.github.io/apexperp-ai/">Live app</a> ·
  <a href="https://youtu.be/WgbSrbndSgo">Demo video</a> ·
  <a href="PROOF.md">On-chain proof</a> ·
  <a href="feedback/">SDK feedback</a>
</p>

![ApexPerp](public/brand/og-image.png)

## What it does

Perps traders lose whole positions to liquidation because a wick hits while they're asleep, busy, or just not watching. ApexPerp fixes that in three layers:

1. **See how close you are.** Connect a wallet (or paste any address) and get your real account health from the dreamDEX MarginBank: equity over the maintenance margin you must keep. For every position you see the exact mark price where it would get trimmed, closed, or liquidated. It works with dreamDEX **Somnia Accounts**: connect the wallet that owns yours and ApexPerp trades through the account.
2. **Protect it on-chain, in one click.** ApexPerp places two reduce-only stop orders per position on dreamDEX's `PerpStopOrderRegistry`: one that sells 25% at the trim price, one that closes everything at the close price. **Somnia Reactivity** fires them when the mark crosses the line. No bot, no server, no key handed over, and they keep working with your laptop shut.
3. **Optionally, run the Sentinel.** A small agent that watches whole-account health every second and sends reduce-only market orders below your thresholds. It applies the same rule as `perp-guard` in dreamDEX's bot kit (see below), so treat it as the optional extra.

Everything it sends can only shrink a position. It never opens or flips one.

**Setup scanner (`#/scan`).** Lists the Turtle Soup and CRT setups that just formed across all 21 markets (15m, 1h and 4h candles), with entry, stop, target and reward over risk, and can ping you in the browser when a new one forms. Each setup type carries an **edge check**: every setup is replayed on the candles after it and compared with random entries that share its direction and stop and target distances, so it says plainly whether the setup beat chance. On about 33 days of 1h candles neither does, and the page says so. Session and reward-over-risk filters recalculate the check, so you can test your own version of a setup.

## Who it's for

- **dreamDEX traders** running leverage who don't want one wick to wipe out their margin.
- **Perps Arena players**, where getting liquidated knocks you off the board.
- **Bot builders**, who get a tested, reusable reduce-only and stop-order layer (`agent/`).

## How this fits with dreamDEX's own tools

- **The bot kit's [`perp-guard`](https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/perp-guard)** trims on the same health ratio, from a bot that has to keep running. ApexPerp's Sentinel is the same idea and doesn't claim to improve on it.
- **A linked bot key can't arm stops** for your account (per dreamDEX's [Link a bot](https://app.testnet.dreamdex.io/docs/trading/common/link-a-bot) page); only the account can. So a bot only protects you while it's running.
- **ApexPerp arms the stops from the account**, so the exchange holds them and Somnia Reactivity fires them with nothing running. And instead of asking you to type a price, it **solves it from your account's health**: the mark where the cross-margin account hits your trim line and your close line, for each position.
- **The app's own TP/SL** lets you set a price by hand. ApexPerp picks the prices that match your margin, arms the trim and close pair in one click, and shows every position's trim, close and liquidation prices before you do.

## Proof it works

Every transaction ApexPerp sends is logged with its hash, block and status in [PROOF.md](PROOF.md). Every hash links to the [Somnia Tokyo explorer](https://explorer.testnet.somnia.network/tokyo).

## Run it

Requires Node 20+.

```bash
git clone https://github.com/southenempire/apexperp-ai.git
cd apexperp-ai
npm install
npm run dev            # the dapp on http://localhost:3000
```

**Somnia Account (the default dreamDEX account).** The dapp trades through it with the browser wallet that owns it. To run the Sentinel for it, use a **linked bot key**, which can place orders for your account but can never withdraw:

```bash
npm run botkey -- 0xYourDreamDexAccount   # makes a new bot key, saves it to .env, prints its address
# in the dreamDEX app: wallet, Link a bot, tick Perps, paste the bot address, Add bot (and give it a little STT for gas)
npm run doctor                            # confirms the link and the gas
DRY_RUN=1 npm run agent:live              # watch it decide; drop DRY_RUN to let it trim
```

**Plain wallet account**, with a funded Somnia Tokyo testnet wallet (join the Perps Arena on [dreamDEX](https://app.testnet.dreamdex.io) for paper USDso). Use a **testnet-only key**, never one that holds real funds:

```bash
cp .env.example .env              # set PRIVATE_KEY
npm run doctor                    # checks RPC, indexer, mark prices and your wallet
npm run open -- ETH long 0.01     # open a test position
npm run protect                   # arm on-chain trim + close stops for every position
npm run protect -- --list         # see your stops (--cancel removes them, fees refunded)
npm run agent:live                # run the Sentinel (DRY_RUN=1 to log without sending, ONCE=1 to stop after one action)
```

| Setting | Default | Meaning |
| :--- | :--- | :--- |
| `REDUCE_BELOW_HEALTH` | `1.5` | Trim when equity / maintenance margin falls to this |
| `FLATTEN_BELOW_HEALTH` | `1.15` | Close everything at this |
| `REDUCE_PERCENTAGE` | `25` | How much one trim sells |
| `MAX_SLIPPAGE` | `0.02` | Worst fill for a Sentinel market order |

## How it's built

```
src/                     React dapp (Vite + Tailwind)
  pages/Landing.tsx      landing page with the drag-the-price breaker demo
  pages/Dashboard.tsx    health, positions, on-chain stops, trades, markets
  pages/Scanner.tsx      setup scanner with the edge check
  lib/wallet.tsx         injected wallet, switches/adds Somnia Tokyo, binds the SDK signer
  lib/hooks.ts           live reads from the chain and indexer
  lib/scan.ts            candle history for every perp market
agent/                   shared trading logic (used by the dapp and the CLI)
  protection.ts          trigger-price solve, stop planning, arm / list / cancel stops
  sentinel.ts            health ratio, decisions, reduce-only sizing (pure, unit-tested)
  linked.ts              linked-bot mode: placeOrderFor for a Somnia Account
  setups.ts, edge.ts     Turtle Soup and CRT detectors, and the random-baseline edge check
  markets.ts             connection, market discovery, reduce-only order planning
  runner.ts              the always-on Sentinel
scripts/                 doctor, open-position, protect, tests, brand assets
feedback/                SDK and docs reports for the feedback track, with a repro script
```

- **Trigger prices** solve `equity(p) = k × maintenance(p)` for each market by scaling the SDK's own `perpLiquidationPrice`, so they match the protocol's liquidation math exactly (k = 1 is liquidation).
- **Stops** are placed with `trader.placePerpStopOrder` as reduce-only MARKET stops. The trim leg has a fixed size; the close leg uses quantity `0`, which the registry resolves to the whole position when it fires.
- **Somnia primitives:** perp stops are triggered through Somnia Reactivity (prepaid per stop, refunded on cancel). Tokyo produces about ten blocks a second (measured: the SDK docs say 100, see feedback 09), so the Sentinel's one-second loop sees every few blocks.

Tests: `npm test` runs two suites. `test:sentinel` covers the health maths, decisions, reduce-only sizing, trigger-price solving, stop planning for longs and shorts, telling stop-losses from take-profits, and the linked-bot selectors. `test:setups` covers the setup detectors, the trade rule, the filters, and that the edge check finds no edge on a random walk.

## Feedback track

Twelve reproducible reports in [`feedback/`](feedback/), one per file in the bounty template. Reports 01 to 10 reproduce, read-only, with the command below; 11 and 12 are explorer pages and their steps are in the files:

```bash
npm run feedback:repro
```

| # | Severity | Issue |
| :--- | :--- | :--- |
| 01 | major | Perp stop orders fail on Tokyo: the Hideki address preset has no `operatorPermissionsRegistry` |
| 02 | normal | `docs/PERPS.md` lists perp symbols the SDK rejects, and says only BTC and ETH are live |
| 03 | normal | "unknown symbol" error says to call `loadMarkets()` after it already ran |
| 04 | normal | README testnet setup connects to Shannon, not Tokyo where the perps are |
| 05 | normal | No reduce-only option for perp orders and no SDK read for reducing capacity |
| 06 | normal | No perp `placeOrderFor` / `cancelOrderFor` / `reduceOrderFor` writes, so linked bots can't use the SDK |
| 07 | normal | SDK docs and `hidekiTestnet` say Hideki has no explorer, but dreamDEX documents one that works |
| 08 | normal | Docs say paper USDso can't open six markets; the SDK reads and a simulated order allow them |
| 09 | normal | The chain definition says Hideki has 10 ms blocks (~100/s); the chain makes about 10 blocks a second |
| 10 | normal | `eth_getLogs` rejects ranges over 1,000 blocks (about 100 s), with a non-standard error and no mention in the docs |
| 11 | normal | New explorer: "Open in Markets" on a Tokyo testnet trade goes to a 404, and the working Markets URL carries no chain |
| 12 | normal | New explorer: a Tokyo testnet perp trade is labelled with the pool address, not the market, and has no side or account |

## X posts

- [Launch thread on X](https://x.com/Southen13/status/2114959892414869592)
- [The setup scanner and its edge check](https://x.com/Southen13/status/2115351335390351783)
- [Demo video clip](https://x.com/Southen13/status/2116275144272367691)

## Network

| | |
| :--- | :--- |
| Network | Somnia Tokyo testnet (Hideki) |
| Chain ID | `50383` |
| RPC | `https://api.hideki2.infra.testnet.somnia.network` |
| Indexer | `https://hideki-dev.smk.somnia.host/v1/graphql` |
| MarginBank | `0x478769E1177C0773c43A593DCCc4Ad15F15F1394` |
| Operator permissions registry | `0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a` |

Built for the [dreamDEX Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty/detail).
