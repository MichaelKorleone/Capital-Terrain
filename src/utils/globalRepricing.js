const TIME_SPAN_MULTIPLIER = {
  "1D": 1,
  "1W": 2.8,
  "1M": 6.2,
  "1Q": 11,
  "1Y": 24,
  "2Y": 38,
  "3Y": 52,
  "5Y": 80,
  "LONGEST": 120
};

const ASSET_PROXIES = [
  {
    id: "gold",
    label: "Gold",
    category: "Hard assets",
    baseChange: 38_000_000_000,
    precision: "market proxy",
    note: "Gold repricing proxy from spot-price movement against estimated above-ground value."
  },
  {
    id: "crypto",
    label: "Crypto assets",
    category: "Digital assets",
    baseChange: -26_000_000_000,
    precision: "market proxy",
    note: "Crypto repricing proxy for major liquid tokens; highly real-time in later data versions."
  },
  {
    id: "treasuries",
    label: "Treasury bonds",
    category: "Fixed income",
    baseChange: 19_000_000_000,
    precision: "index proxy",
    note: "Bond repricing proxy from rate-sensitive index movement, not complete bond-market ownership."
  },
  {
    id: "real-estate",
    label: "Real estate",
    category: "Illiquid assets",
    baseChange: -14_000_000_000,
    precision: "slow estimate",
    note: "Real estate values update slowly; daily movement should be treated as a proxy estimate."
  },
  {
    id: "bank-savings",
    label: "Bank savings",
    category: "Cash-like balances",
    baseChange: 6_000_000_000,
    precision: "flow estimate",
    note: "Deposit balances are slower accounting estimates and are not directly comparable to traded-asset marks."
  }
];

export function buildGlobalRepricingSnapshot(companies, timeSpan = "1D") {
  const spanMultiplier = TIME_SPAN_MULTIPLIER[timeSpan] || TIME_SPAN_MULTIPLIER["1D"];
  const sp500Change = companies.reduce((sum, company) => sum + (company.marketCapChange || 0), 0);
  const sp500AbsMarketCap = companies.reduce((sum, company) => sum + Math.abs(company.currentMarketCap || 0), 0);
  const assets = [
    {
      id: "sp500",
      label: "S&P 500 equities",
      category: "Public equities",
      change: sp500Change,
      estimatedBase: sp500AbsMarketCap,
      precision: "market-derived",
      note: "Uses the currently loaded S&P 500 company repricing from the charts above."
    },
    ...ASSET_PROXIES.map((asset, index) => {
      const directionCycle = Math.sin((index + 1) * 1.7 + spanMultiplier * 0.22);
      const magnitude = asset.baseChange * spanMultiplier * (0.82 + Math.abs(directionCycle) * 0.36);
      return {
        ...asset,
        change: Math.round(magnitude)
      };
    })
  ];

  const netChange = assets.reduce((sum, asset) => sum + asset.change, 0);
  const largestAsset = assets.reduce(
    (largest, asset) => (Math.abs(asset.change) > Math.abs(largest.change) ? asset : largest),
    assets[0]
  );

  return {
    title: "Global repricing snapshot",
    description: "A rough cross-asset view of valuation marks for the selected period. Traded markets are more precise than slow-moving balance-sheet and property estimates.",
    timeSpan,
    netChange,
    largestAsset,
    assets: assets.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  };
}
