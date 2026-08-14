import { MOCK_SP500_COMPANIES } from "../data/mockCompanies.js";

export const TIME_SPANS = [
  { value: "1D", label: "1D", longLabel: "1 day", volatility: 1 },
  { value: "1W", label: "1W", longLabel: "1 week", volatility: 2.35 },
  { value: "1M", label: "1M", longLabel: "1 month", volatility: 4.4 },
  { value: "1Q", label: "1Q", longLabel: "1 quarter", volatility: 7.4 },
  { value: "1Y", label: "1Y", longLabel: "1 year", volatility: 14.5 },
  { value: "2Y", label: "2Y", longLabel: "2 years", volatility: 21 },
  { value: "3Y", label: "3Y", longLabel: "3 years", volatility: 27 },
  { value: "5Y", label: "5Y", longLabel: "5 years", volatility: 36 },
  { value: "LONGEST", label: "Longest", longLabel: "the longest available API history", volatility: 52 }
];

export function loadMarketCapRepricingData(timeSpan = "1D") {
  const span = TIME_SPANS.find((option) => option.value === timeSpan) || TIME_SPANS[0];

  if (span.value === "1D") return MOCK_SP500_COMPANIES;

  return MOCK_SP500_COMPANIES.map((company, index) => {
    const periodPercentChange = buildPeriodPercentChange(company, index, span.volatility);
    const currentMarketCap = company.currentMarketCap;
    const previousMarketCap = Math.round(currentMarketCap / (1 + periodPercentChange / 100));

    return {
      ...company,
      previousMarketCap,
      currentMarketCap,
      marketCapChange: currentMarketCap - previousMarketCap,
      percentChange: Number(periodPercentChange.toFixed(2)),
      timeSpan: span.value
    };
  });
}

// Future API integration point:
// Replace loadMarketCapRepricingData with an async fetcher that receives current
// market cap plus period-start market cap for the selected span from a market
// data provider. Keep the returned object shape identical so charts can switch
// between 1D through the longest available history without changing visualization components.

function buildPeriodPercentChange(company, index, volatility) {
  const sectorBias = sectorTrendBias(company.sector);
  const sizeDampener = Math.max(0.42, 1.08 - company.currentMarketCap / 3_600_000_000_000);
  const cycle = Math.sin(index * 0.67 + volatility) * 0.62 + Math.cos(index * 0.19) * 0.38;
  const megaCapMomentum = index < 24 ? 0.62 : 0;
  const direction = index % 11 === 0 || index % 17 === 0 ? -1 : 1;
  return (sectorBias + cycle * volatility * sizeDampener + megaCapMomentum) * direction;
}

function sectorTrendBias(sector) {
  const bias = {
    "Information Technology": 7.2,
    "Health Care": 2.6,
    Financials: 3.4,
    "Consumer Discretionary": 1.8,
    "Communication Services": 4.4,
    Industrials: 2.1,
    "Consumer Staples": -1.4,
    Energy: 3.1,
    Utilities: -0.7,
    "Real Estate": -2.6,
    Materials: 0.9
  };

  return bias[sector] || 0;
}
