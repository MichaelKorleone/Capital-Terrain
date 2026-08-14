import React, { useRef, useState } from "react";
import { parseSnapshotCsv } from "../utils/csvSnapshot.js";

const h = React.createElement;

export function DataSourcePanel({
  dataSource,
  importedCount,
  sourceNote,
  snapshotMeta,
  isExternallyLoading = false,
  onSnapshotLoaded,
  onUseMock,
  onLoadRealSnapshot
}) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("");
  const [isLoadingRealSnapshot, setIsLoadingRealSnapshot] = useState(false);

  async function loadFile(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseSnapshotCsv(text);
      if (!rows.length) {
        setStatus("No valid rows found. Check that currentPrice and currentMarketCap are populated.");
        return;
      }
      onSnapshotLoaded(rows, file.name);
      setStatus(`${rows.length.toLocaleString()} real snapshot rows loaded from ${file.name}.`);
    } catch (error) {
      setStatus(`Could not load CSV: ${error.message}`);
    }
  }

async function loadRealSnapshot() {
    setIsLoadingRealSnapshot(true);
    setStatus("Refreshing latest S&P 500 snapshot and historical closes. This can take a minute.");
    try {
      const snapshot = await onLoadRealSnapshot({ force: true });
      setStatus(buildStatusText(snapshot));
    } catch (error) {
      setStatus(`Could not refresh latest snapshot: ${error.message}`);
    } finally {
      setIsLoadingRealSnapshot(false);
    }
  }

  return h(
    "section",
    { className: "data-source-panel", "aria-label": "Data source" },
    h(
      "div",
      null,
      h("span", null, "Data source"),
      h(
        "strong",
        null,
        dataSource === "imported"
          ? `Latest snapshot (${importedCount.toLocaleString()} rows)`
          : "Mock market data"
      ),
      snapshotMeta &&
        h(
          "div",
          { className: "snapshot-meta-grid" },
          h("span", null, "Market data as of"),
          h("strong", null, snapshotMeta.marketDataDate || snapshotMeta.asOfDate || "Unknown"),
          h("span", null, "Fetched at"),
          h("strong", null, formatDateTime(snapshotMeta.fetchedAt || snapshotMeta.asOf)),
          h("span", null, "Cache"),
          h("strong", null, snapshotMeta.cacheStatus === "hit" ? "Today cached" : "Fresh refresh")
        )
    ),
    h(
      "div",
      { className: "data-source-actions" },
      h(
        "button",
        {
          type: "button",
          className: "reset-button",
          disabled: isLoadingRealSnapshot || isExternallyLoading,
          onClick: loadRealSnapshot
        },
        isLoadingRealSnapshot || isExternallyLoading ? "Loading latest data..." : "Refresh latest data"
      ),
      h(
        "button",
        {
          type: "button",
          className: "reset-button",
          onClick: () => inputRef.current?.click()
        },
        "Import snapshot CSV"
      ),
      h(
        "a",
        {
          className: "reset-button link-button",
          href: "./templates/capital-terrain-googlefinance-template.csv",
          download: "capital-terrain-googlefinance-template.csv"
        },
        "Download GoogleFinance template"
      ),
      h(
        "button",
        {
          type: "button",
          className: "reset-button",
          onClick: onUseMock
        },
        "Use mock data"
      ),
      h("input", {
        ref: inputRef,
        type: "file",
        accept: ".csv,text/csv",
        className: "visually-hidden",
        onChange: loadFile
      })
    ),
    h(
      "p",
      null,
      status ||
        sourceNote ||
        "Load real snapshot fetches open S&P 500 financials and Yahoo chart history through the local server. CSV import remains available as a manual fallback."
    )
  );
}

function buildStatusText(snapshot) {
  const marketDate = snapshot.marketDataDate || snapshot.asOfDate || "unknown date";
  const fetchedAt = formatDateTime(snapshot.fetchedAt || snapshot.asOf);
  const cacheText = snapshot.cacheStatus === "hit" ? "served from cache" : "freshly refreshed";
  return `${snapshot.rows.length.toLocaleString()} latest rows loaded. Market data as of ${marketDate}; fetched ${fetchedAt}; ${cacheText}.`;
}

function formatDateTime(value) {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
