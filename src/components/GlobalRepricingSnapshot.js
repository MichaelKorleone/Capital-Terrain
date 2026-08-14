import React, { useMemo } from "react";
import { formatCurrencyCompact } from "../utils/formatters.js";
import { buildGlobalRepricingSnapshot } from "../utils/globalRepricing.js";

const h = React.createElement;

export function GlobalRepricingSnapshot({ companies, timeSpan }) {
  const snapshot = useMemo(
    () => buildGlobalRepricingSnapshot(companies, timeSpan),
    [companies, timeSpan]
  );
  const maxAbs = Math.max(1, ...snapshot.assets.map((asset) => Math.abs(asset.change)));

  return h(
    "section",
    { className: "global-repricing-panel", "aria-label": "Global repricing snapshot" },
    h(
      "div",
      { className: "chart-header" },
      h(
        "div",
        null,
        h("p", { className: "eyebrow" }, "Cross-Asset Snapshot"),
        h("h2", null, snapshot.title),
        h("p", null, snapshot.description)
      ),
      h(
        "div",
        { className: "global-repricing-summary" },
        h("span", null, "Net visible repricing"),
        h("strong", { className: snapshot.netChange >= 0 ? "positive-text" : "negative-text" }, formatCurrencyCompact(snapshot.netChange)),
        h("span", null, `Largest: ${snapshot.largestAsset.label}`)
      )
    ),
    h(
      "div",
      { className: "global-repricing-list" },
      snapshot.assets.map((asset) => {
        const isPositive = asset.change >= 0;
        const width = `${Math.max(4, (Math.abs(asset.change) / maxAbs) * 100)}%`;
        return h(
          "article",
          { className: "global-asset-row", key: asset.id },
          h(
            "div",
            { className: "global-asset-meta" },
            h("strong", null, asset.label),
            h("span", null, asset.category),
            h("small", null, asset.precision)
          ),
          h(
            "div",
            { className: "global-asset-track" },
            h("div", { className: "global-asset-zero-line", "aria-hidden": "true" }),
            h("div", {
              className: `global-asset-bar ${isPositive ? "positive" : "negative"}`,
              style: {
                width,
                marginLeft: isPositive ? "50%" : `calc(50% - ${width})`
              },
              title: `${asset.label}: ${formatCurrencyCompact(asset.change)}`
            })
          ),
          h(
            "div",
            { className: "global-asset-value" },
            h("strong", { className: isPositive ? "positive-text" : "negative-text" }, formatCurrencyCompact(asset.change)),
            h("span", null, asset.note)
          )
        );
      })
    )
  );
}
