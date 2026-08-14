import React from "react";
import { formatCurrencyCompact, formatNumberCompact } from "../utils/formatters.js";

const h = React.createElement;

export function StatCards({ companies }) {
  const totalRepricing = companies.reduce((sum, company) => sum + company.marketCapChange, 0);
  const gainers = companies.filter((company) => company.marketCapChange >= 0).length;
  const totalVolume = companies.reduce((sum, company) => sum + company.volume, 0);
  const largestMove = companies.reduce(
    (largest, company) =>
      Math.abs(company.marketCapChange) > Math.abs(largest.marketCapChange) ? company : largest,
    companies[0] || { ticker: "-", marketCapChange: 0 }
  );

  const cards = [
    ["Visible companies", companies.length.toLocaleString()],
    ["Net repricing", formatCurrencyCompact(totalRepricing)],
    ["Positive bars", `${gainers} / ${companies.length}`],
    ["Total volume", formatNumberCompact(totalVolume)],
    ["Largest move", `${largestMove.ticker} ${formatCurrencyCompact(largestMove.marketCapChange)}`]
  ];

  return h(
    "section",
    { className: "stats", "aria-label": "Market summary" },
    cards.map(([label, value]) =>
      h(
        "div",
        { className: "stat-card", key: label },
        h("span", null, label),
        h("strong", null, value)
      )
    )
  );
}
