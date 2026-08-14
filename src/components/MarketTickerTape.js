import React, { useMemo, useState } from "react";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumberCompact,
  formatPercent
} from "../utils/formatters.js";
import { buildTickerTapeItems, getTickerTapeDurationSeconds } from "../utils/tickerTape.js";

const h = React.createElement;

export function MarketTickerTape({ companies, timeSpan }) {
  const [tooltip, setTooltip] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const tickerItems = useMemo(
    () => buildTickerTapeItems(companies, { timeSpan, repeat: 2 }),
    [companies, timeSpan]
  );
  const durationSeconds = useMemo(
    () => getTickerTapeDurationSeconds(companies.length),
    [companies.length]
  );

  if (!tickerItems.length) return null;

  return h(
    "aside",
    {
      className: `market-ticker-tape${isPaused ? " paused" : ""}`,
      "aria-label": "Financial news style market cap ticker",
      onMouseEnter: () => setIsPaused(true),
      onMouseLeave: () => {
        setIsPaused(false);
        setTooltip(null);
      }
    },
    h(
      "div",
      { className: "market-ticker-label" },
      h("strong", null, timeSpan === "LONGEST" ? "Longest" : timeSpan),
      h("span", null, "Market cap repricing")
    ),
    h(
      "div",
      { className: "market-ticker-window" },
      h(
        "div",
        {
          className: "market-ticker-track",
          style: { animationDuration: `${durationSeconds}s` }
        },
        tickerItems.map((item) =>
          h(
            "button",
            {
              className: `market-ticker-item ${item.marketCapChange >= 0 ? "positive" : "negative"}`,
              key: item.key,
              type: "button",
              onMouseEnter: (event) => {
                setIsPaused(true);
                setTooltip(buildTickerTooltip(item, event));
              },
              onMouseMove: (event) => {
                setIsPaused(true);
                setTooltip(buildTickerTooltip(item, event));
              },
              onMouseLeave: () => setTooltip(null)
            },
            h("strong", null, item.ticker),
            h("span", null, formatCurrencyCompact(item.marketCapChange)),
            h("span", null, formatPercent(item.percentChange))
          )
        )
      )
    ),
    tooltip &&
      h(
        "div",
        {
          className: "market-ticker-tooltip",
          style: {
            left: tooltip.left,
            bottom: tooltip.bottom
          }
        },
        h("strong", null, `${tooltip.item.ticker} - ${tooltip.item.companyName}`),
        h("span", null, tooltip.item.sector),
        h("span", null, `Market cap change: ${formatCurrency(tooltip.item.marketCapChange)}`),
        h("span", null, `Percent change: ${formatPercent(tooltip.item.percentChange)}`),
        h("span", null, `Volume: ${formatNumberCompact(tooltip.item.volume)}`),
        tooltip.item.dataQuality?.apiInceptionDate &&
          h("span", null, `API inception/start date: ${tooltip.item.dataQuality.apiInceptionDate}`),
        h("span", null, `Time span: ${tooltip.item.timeSpan === "LONGEST" ? "Longest" : tooltip.item.timeSpan}`)
      )
  );
}

function buildTickerTooltip(item, event) {
  const width = 288;
  return {
    item,
    left: Math.min(Math.max(18, event.clientX + 14), window.innerWidth - width - 18),
    bottom: Math.max(82, window.innerHeight - event.clientY + 14)
  };
}
