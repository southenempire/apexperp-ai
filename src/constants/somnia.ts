export const SOMNIA_TOKYO_TESTNET = {
  id: 50383,
  name: 'Somnia Tokyo Testnet (Hideki)',
  network: 'hideki',
  nativeCurrency: {
    name: 'Somnia Test Token',
    symbol: 'STT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://api.hideki2.infra.testnet.somnia.network'],
      webSocket: ['wss://api.hideki2.infra.testnet.somnia.network/ws'],
    },
    public: {
      http: ['https://api.hideki2.infra.testnet.somnia.network'],
      webSocket: ['wss://api.hideki2.infra.testnet.somnia.network/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  indexerUrl: 'https://hideki-dev.smk.somnia.host/v1/graphql',
  contracts: {
    operatorRegistry: '0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a',
    marginBank: '0x478769E1177C0773c43A593DCCc4Ad15F15F1394',
  }
} as const;

// All 21 live perp markets verified on Somnia Tokyo Testnet
export const VERIFIED_PERP_MARKETS = [
  {
    symbol: 'BTC-PERP',
    ccxtSymbol: 'BTC/USDso:USDso',
    markPrice: 83094.87,
    indexPrice: 83120.00,
    fundingRate: 129.855,
    fundingRateText: '129.855% (pays shorts)',
    bid: 83244.80,
    ask: 83246.50,
    tickSize: 0.1,
    lotSize: 0.00001,
    minQty: 0.00013,
    initialMarginBps: 500, // 20x
    maxLeverage: 20
  },
  {
    symbol: 'ETH-PERP',
    ccxtSymbol: 'ETH/USDso:USDso',
    markPrice: 2451.03,
    indexPrice: 2451.50,
    fundingRate: -20.487,
    fundingRateText: '-20.487% (pays longs)',
    bid: 2447.72,
    ask: 2447.73,
    tickSize: 0.01,
    lotSize: 0.0001,
    minQty: 0.004,
    initialMarginBps: 500, // 20x
    maxLeverage: 20
  },
  {
    symbol: 'SOL-PERP',
    ccxtSymbol: 'SOL/USDso:USDso',
    markPrice: 106.65,
    indexPrice: 106.70,
    fundingRate: -112.664,
    fundingRateText: '-112.664% (pays longs)',
    bid: 106.47,
    ask: 106.48,
    tickSize: 0.01,
    lotSize: 0.01,
    minQty: 0.1,
    initialMarginBps: 500,
    maxLeverage: 20
  },
  {
    symbol: 'HYPE-PERP',
    ccxtSymbol: 'HYPE/USDso:USDso',
    markPrice: 81.71,
    indexPrice: 81.65,
    fundingRate: -81.564,
    fundingRateText: '-81.564% (pays longs)',
    bid: 81.33,
    ask: 81.34,
    tickSize: 0.01,
    lotSize: 0.01,
    minQty: 0.12,
    initialMarginBps: 500,
    maxLeverage: 20
  },
  {
    symbol: 'XRP-PERP',
    ccxtSymbol: 'XRP/USDso:USDso',
    markPrice: 1.34,
    indexPrice: 1.34,
    fundingRate: -198.155,
    fundingRateText: '-198.155% (pays longs)',
    bid: 1.34,
    ask: 1.34,
    tickSize: 0.0001,
    lotSize: 0.1,
    minQty: 6.9,
    initialMarginBps: 500,
    maxLeverage: 20
  },
  {
    symbol: 'DOGE-PERP',
    ccxtSymbol: 'DOGE/USDso:USDso',
    markPrice: 0.08201,
    indexPrice: 0.08200,
    fundingRate: 10.950,
    fundingRateText: '10.950% (pays shorts)',
    bid: 0.08202,
    ask: 0.08208,
    tickSize: 0.00001,
    lotSize: 10,
    minQty: 120,
    initialMarginBps: 1000,
    maxLeverage: 10
  },
  {
    symbol: 'BNB-PERP',
    ccxtSymbol: 'BNB/USDso:USDso',
    markPrice: 746.31,
    indexPrice: 746.10,
    fundingRate: 10.950,
    fundingRateText: '10.950% (pays shorts)',
    bid: 745.81,
    ask: 745.88,
    tickSize: 0.001,
    lotSize: 0.001,
    minQty: 0.014,
    initialMarginBps: 1000,
    maxLeverage: 10
  },
  {
    symbol: 'NEAR-PERP',
    ccxtSymbol: 'NEAR/USDso:USDso',
    markPrice: 5.22,
    indexPrice: 5.22,
    fundingRate: -96.020,
    fundingRateText: '-96.020% (pays longs)',
    bid: 5.21,
    ask: 5.22,
    tickSize: 0.0001,
    lotSize: 0.1,
    minQty: 5.1,
    initialMarginBps: 1000,
    maxLeverage: 10
  },
  {
    symbol: 'TAO-PERP',
    ccxtSymbol: 'TAO/USDso:USDso',
    markPrice: 274.83,
    indexPrice: 274.80,
    fundingRate: 10.950,
    fundingRateText: '10.950% (pays shorts)',
    bid: 274.57,
    ask: 274.87,
    tickSize: 0.001,
    lotSize: 0.001,
    minQty: 0.044,
    initialMarginBps: 2000,
    maxLeverage: 5
  },
  {
    symbol: '1000PEPE-PERP',
    ccxtSymbol: '1000PEPE/USDso:USDso',
    markPrice: 0.004540,
    indexPrice: 0.004541,
    fundingRate: 10.950,
    fundingRateText: '10.950% (pays shorts)',
    bid: 0.004535,
    ask: 0.004542,
    tickSize: 0.0000001,
    lotSize: 100,
    minQty: 2700,
    initialMarginBps: 2000,
    maxLeverage: 5
  }
];
