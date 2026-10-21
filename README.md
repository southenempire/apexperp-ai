# ⚡ ApexPerp AI
### Autonomous AI Strategy Agent & Sub-Second Risk Sentinel on DreamDEX (Somnia Tokyo Testnet)

Built for the **dreamDEX Perps Builder Bounty** on DoraHacks.

![ApexPerp Terminal](https://img.shields.io/badge/Somnia-Tokyo%2050383-0ea5e9?style=for-the-badge&logo=ethereum)
![DreamDEX CLOB](https://img.shields.io/badge/DreamDEX-Perps%20CLOB-emerald?style=for-the-badge)
![Latency](https://img.shields.io/badge/Reaction%20Time-~320ms-amber?style=for-the-badge)

---

## 🚀 Overview

**ApexPerp AI** is an institutional-grade trading terminal and autonomous agent engineered specifically to leverage **Somnia's sub-second throughput** on **DreamDEX**, the fully on-chain Central Limit Order Book (CLOB).

While traditional AMM perps on Ethereum/L2s suffer from multi-second block latency and high liquidation cascades, ApexPerp AI combines:
1. **Natural Language AI Intent Compiler:** Converts conversational English trading strategies into deterministic, bracket-protected limit/market orders executed via Somnia Bot Session Keys.
2. **Sub-Second Risk Sentinel (<350ms):** 24/7 cross-margin guardian that monitors account health factor. If health falls below safety levels (e.g. `< 1.50x`), Sentinel automatically executes micro-tranches (-25%) or hedges to prevent costly on-chain liquidation penalties.
3. **Live 21-Market CLOB Visualizer:** Real-time WebSocket streaming of marks, funding rates (e.g. BTC-PERP +129.8% vs XRP-PERP -198.1%), and depth charts.
4. **Funding Rate Arbitrageur:** Detects extreme funding rate disparities across the 21 live testnet markets and executes delta-neutral yield harvesting positions.

---

## 🏛 Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    User Trader Interface                      │
│     (Natural Language Intent • Risk Gauge • CLOB Depth)       │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                       ApexPerp Agent                          │
│  ┌─────────────────────────┐   ┌───────────────────────────┐  │
│  │   AI Intent Compiler    │   │  Sub-Second Risk Sentinel │  │
│  │ (TP/SL Brackets & Grid) │   │  (Health Factor < 1.50x)  │  │
│  └────────────┬────────────┘   └─────────────┬─────────────┘  │
└───────────────┼──────────────────────────────┼────────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────────────────────────────────────────┐
│                  Somnia Markets SDK Client                    │
│   • @somnia-chain/markets-sdk                                 │
│   • EIP-712 Session / Bot Keys (Scoped Execution)             │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│              Somnia Tokyo Testnet (Chain ID: 50383)           │
│     DreamDEX Perp Pools • MarginBank • CLOB Orderbooks        │
└───────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quickstart

### 1. Clone & Install
```bash
git clone https://github.com/southenempire/apexperp-ai.git
cd apexperp-ai
npm install
```

### 2. Run Testnet Preflight Doctor
Verifies your connection to Somnia Tokyo Testnet (Chain ID 50383) and DreamDEX indexer:
```bash
npm run doctor
```

### 3. Generate On-Chain Trade Proof
```bash
npm run testnet:ping
```

### 4. Launch the Web Terminal
```bash
npm run dev
```
Open `http://localhost:3000` to interact with the live AI terminal, Sentinel health visualizer, and CLOB depth.

---

## 📋 Tested & Verified Testnet Network Details
* **Network:** Somnia Tokyo Testnet (Hideki)
* **Chain ID:** `50383`
* **RPC Endpoint:** `https://api.hideki2.infra.testnet.somnia.network`
* **Indexer:** `https://hideki-dev.smk.somnia.host/v1/graphql`
* **Operator Registry:** `0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a`
* **Margin Bank:** `0x15C7e8CE38F021c5b45d098AaD788f63090bF20A`

---

## 🔍 Feedback Track Bounty Audits
See [AUDIT_REPORT.md](./AUDIT_REPORT.md) for 3 major/critical issues documented during development for the DoraHacks Feedback Track.
