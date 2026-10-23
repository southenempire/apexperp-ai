# apexperp-ai

Algorithmic execution agent and margin risk sentinel for DreamDEX perpetual futures on Somnia Tokyo Testnet.

## Overview

apexperp-ai provides automated trade routing and cross-margin risk mitigation for on-chain central limit order book (CLOB) perpetuals on Somnia.

* **Intent Routing Engine:** Translates structured trading parameters and bracket orders (TP/SL) into deterministic CCXT-compliant orders signed via Somnia session keys.
* **Sub-Second Margin Sentinel:** Monitors cross-margin account equity relative to maintenance margin requirements. Executes automated micro-reductions (25% tranches) when health ratio breaches 1.50x to avoid liquidation penalties.
* **CLOB Telemetry:** Real-time WebSocket connection to Somnia Tokyo testnet tracking mark prices, index prices, order book depth, and funding rate differentials across 21 live markets.

---

## Architecture

```
                  ┌───────────────────────────────┐
                  │    User Interface & Config    │
                  │   (Terminal, Risk Parameters) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                          Core Engine                              │
│                                                                   │
│  ┌────────────────────────────┐    ┌───────────────────────────┐  │
│  │   Intent Compiler          │    │   Margin Risk Sentinel    │  │
│  │   - Bracket Stop Orders    │    │   - Health Factor Monitor │  │
│  │   - Grid Parameterization  │    │   - Sub-second De-risking │  │
│  └─────────────┬──────────────┘    └─────────────┬─────────────┘  │
└────────────────┼─────────────────────────────────┼────────────────┘
                 │                                 │
                 ▼                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Somnia Protocol Integration                     │
│   - @somnia-chain/markets-sdk                                     │
│   - Viem RPC Transport (Chain ID: 50383)                          │
│   - Scoped Operator Bot Keys (EIP-712 / EIP-191)                  │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│               Somnia Tokyo Testnet (Hideki 50383)                 │
│         PerpPoolFactory | MarginBank | OrderBook Registry         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Network Parameters (Somnia Tokyo Testnet)

| Parameter | Value |
| :--- | :--- |
| **Network Name** | Somnia Tokyo Testnet (Hideki) |
| **Chain ID** | `50383` |
| **RPC Endpoint** | `https://api.hideki2.infra.testnet.somnia.network` |
| **WebSocket** | `wss://api.hideki2.infra.testnet.somnia.network/ws` |
| **GraphQL Indexer** | `https://hideki-dev.smk.somnia.host/v1/graphql` |
| **Operator Registry** | `0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a` |
| **MarginBank Proxy** | `0x478769E1177C0773c43A593DCCc4Ad15F15F1394` |

---

## Getting Started

### Prerequisites
* Node.js >= 20.0.0
* npm >= 10.0.0

### Installation
```bash
git clone https://github.com/southenempire/apexperp-ai.git
cd apexperp-ai
npm install
```

### Run the Sentinel (live on Somnia Tokyo testnet)

The Sentinel reads your dreamDEX cross-margin account health on-chain (`equity / maintenance margin` from the MarginBank) and sends **reduce-only IOC market orders** when it drops:

| Health (equity / mm) | Action |
| :--- | :--- |
| `<= 1.50x` | Trim every open position by 25% (lot-aligned, capped at the pool's reducing capacity) |
| `<= 1.15x` | Close every position |

Every transaction it sends is appended to [PROOF.md](./PROOF.md) and `proof/transactions.jsonl` with its hash, block and status.

```bash
cp .env.example .env        # set PRIVATE_KEY to your testnet wallet
npm run open -- ETH long 0.01   # optional: open a real position to guard (add --deposit 50 to fund margin first)
npm run agent:live              # start the Sentinel (set DRY_RUN=1 to log decisions without sending)
npm run test:sentinel           # unit tests for the decision and sizing rules
```

### Verification & Testing

1. **Preflight Doctor:** Validate network connectivity, block height, and indexer state:
```bash
npm run doctor
```

2. **End-to-End Stress Test:** Run the concurrency and latency test suite (20 parallel RPC calls, compiler edge-cases, sentinel trigger benchmark):
```bash
npm run stress-test
```

3. **Start Local Interface:**
```bash
npm run dev
```
Accessible at `http://localhost:3000`.

---

## Protocol Feedback & SDK Bug Reports

See [AUDIT_REPORT.md](./AUDIT_REPORT.md) for detailed, reproducible reports on 3 technical issues identified during integration with `@somnia-chain/markets-sdk`.
