import React, { useEffect, useMemo, useState } from "react";
import { TIME_SPANS } from "../services/marketData.js";
import { buildImportedSnapshotCompanies } from "../utils/csvSnapshot.js";
import { formatCurrencyCompact } from "../utils/formatters.js";
import { TerrainMap3DImproved } from "./TerrainMap3DImproved.js";

const h = React.createElement;

function todayYmd() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatedTerrainField({ highlightedTicker = "" }) {
  const [asOfDate, setAsOfDate] = useState(todayYmd);
  const [pendingDate, setPendingDate] = useState(todayYmd);
  const [timeSpan, setTimeSpan] = useState("1D");
  const activeTimeSpan = TIME_SPANS.find((option) => option.value === timeSpan) || TIME_SPANS[0];
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");

    fetch(`/api/date-snapshot?date=${encodeURIComponent(asOfDate)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load dated snapshot");
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setSnapshot(payload);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [asOfDate]);

  const companies = useMemo(
    () => buildImportedSnapshotCompanies(snapshot?.rows || [], timeSpan),
    [snapshot, timeSpan]
  );
  const totals = useMemo(() => {
    const netChange = companies.reduce((sum, company) => sum + company.marketCapChange, 0);
    const gainers = companies.filter((company) => company.marketCapChange > 0).length;
    const losers = companies.filter((company) => company.marketCapChange < 0).length;
    return { netChange, gainers, losers };
  }, [companies]);

  return h(
    "section",
    { className: "dated-terrain-section" },
    h(
      "div",
      { className: "dated-terrain-header" },
      h(
        "div",
        null,
        h("p", { className: "eyebrow" }, "As-of date terrain"),
        h("h2", null, "Market cap terrain date traveler"),
        h(
          "p",
          null,
          "Pick a date, then view 1D through the longest available history from that historical point using the current S&P 500 universe and free historical price data."
        )
      ),
      h(
        "form",
        {
          className: "dated-terrain-controls",
          onSubmit: (event) => {
            event.preventDefault();
            if (pendingDate) setAsOfDate(pendingDate);
          }
        },
        h(
          "label",
          null,
          h("span", null, "As-of date"),
          h("input", {
            type: "date",
            value: pendingDate,
            max: todayYmd(),
            onChange: (event) => setPendingDate(event.target.value)
          })
        ),
        h(
          "button",
          {
            className: "reset-button",
            type: "submit",
            disabled: status === "loading"
          },
          status === "loading" ? "Loading..." : "Load date"
        )
      )
    ),
    h(
      "div",
      { className: "dated-terrain-status" },
      status === "loading" &&
        h(
          "span",
          null,
          "Building dated terrain from free Yahoo chart history. First load can take a little while because it resolves hundreds of tickers."
        ),
      status === "error" && h("span", null, error),
      status === "ready" &&
        h(
          React.Fragment,
          null,
          h("strong", null, formatCurrencyCompact(totals.netChange)),
          h("span", null, `${totals.gainers} gainers / ${totals.losers} decliners`),
          h(
            "span",
            null,
            `${companies.length} shown from ${snapshot.usableConstituents} price-resolved current S&P constituents`
          ),
          h(
            "span",
            null,
            `Requested ${snapshot.requestedDate}; market data as of ${snapshot.asOfDate}`
          )
        )
    ),
    snapshot &&
      h(
        TerrainMap3DImproved,
        {
          companies,
          highlightedTicker,
          timeSpan,
          timeSpans: TIME_SPANS,
          onTimeSpanChange: setTimeSpan,
          title: "3D market cap terrain field (dated)",
          description: `Current S&P 500 universe repriced as of ${snapshot.asOfDate}, with ${activeTimeSpan.label} and longer lookback controls. This remains a valuation-repricing view, not cash movement.`
        },
        h(
          "div",
          { className: "historical-data-note" },
          h(
            "span",
            null,
            "This panel estimates historical market cap using today's share-count proxy, so it is best for visual exploration rather than audited historical fundamentals."
          ),
          h(
            "span",
            null,
            "The server caches each selected date after the first build during this local session."
          )
        )
      )
  );
}
