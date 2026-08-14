import React, { useEffect, useMemo, useState } from "react";
import { formatCurrencyCompact } from "../utils/formatters.js";
import { TerrainMap3DImproved } from "./TerrainMap3DImproved.js";

const h = React.createElement;

const HISTORICAL_PRESETS = [
  {
    id: "dotcom_bubble",
    label: "Dot-Com Build",
    range: "1998-10-08 to 2000-03-10",
    tone: "boom"
  },
  {
    id: "dotcom_crash",
    label: "Dot-Com Crash",
    range: "2000-03-10 to 2002-10-09",
    tone: "bust"
  },
  {
    id: "gfc_crisis",
    label: "GFC Crisis",
    range: "2007-10-09 to 2009-03-09",
    tone: "bust"
  },
  {
    id: "covid_crash",
    label: "COVID Crash",
    range: "2020-02-19 to 2020-03-23",
    tone: "bust"
  },
  {
    id: "covid_recovery",
    label: "COVID Recovery",
    range: "2020-03-23 to 2020-12-31",
    tone: "boom"
  },
  {
    id: "ai_boom",
    label: "AI Boom",
    range: "2022-11-30 to 2024-12-31",
    tone: "boom"
  }
];

export function HistoricalPresetTerrain() {
  const [activePresetId, setActivePresetId] = useState("covid_crash");
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showUnreliable, setShowUnreliable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");

    fetch(`/api/historical-preset?event=${encodeURIComponent(activePresetId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load historical preset");
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
  }, [activePresetId]);

  const allCompanies = snapshot?.rows || [];
  const companies = useMemo(
    () =>
      showUnreliable
        ? allCompanies
        : allCompanies.filter((company) => company.dataQuality?.confidence !== "low"),
    [allCompanies, showUnreliable]
  );
  const totals = useMemo(() => {
    const netChange = companies.reduce((sum, company) => sum + company.marketCapChange, 0);
    const gainers = companies.filter((company) => company.marketCapChange > 0).length;
    const losers = companies.filter((company) => company.marketCapChange < 0).length;
    return { netChange, gainers, losers };
  }, [companies]);
  const confidenceCounts = snapshot?.confidenceCounts || { high: 0, medium: 0, low: 0 };
  const hiddenLowCount = showUnreliable ? 0 : confidenceCounts.low || 0;

  return h(
    "section",
    { className: "historical-preset-section" },
    h(
      "div",
      { className: "historical-preset-header" },
      h(
        "div",
        null,
        h("p", { className: "eyebrow" }, "Historical presets"),
        h("h2", null, "Market City time machine"),
        h(
          "p",
          null,
          "Preset boom and bust windows rebuild the terrain from historical S&P 500 membership and price movement. This first free-data version estimates market cap from available share-count proxies."
        )
      ),
      h(
        "div",
        { className: "historical-preset-status" },
        status === "loading" && h("span", null, "Building historical terrain..."),
        status === "ready" &&
          h(
            React.Fragment,
            null,
            h("strong", null, formatCurrencyCompact(totals.netChange)),
            h("span", null, `${totals.gainers} gainers / ${totals.losers} decliners`),
            hiddenLowCount > 0 && h("span", null, `${hiddenLowCount} low-confidence rows hidden`)
          ),
        status === "error" && h("span", null, error)
      )
    ),
    snapshot &&
      h(
        "div",
        { className: "historical-confidence-bar" },
        h(
          "div",
          { className: "confidence-pills" },
          h("span", { className: "confidence-pill high" }, `High ${confidenceCounts.high || 0}`),
          h("span", { className: "confidence-pill medium" }, `Medium ${confidenceCounts.medium || 0}`),
          h("span", { className: "confidence-pill low" }, `Low ${confidenceCounts.low || 0}`)
        ),
        h(
          "label",
          { className: "historical-toggle" },
          h("input", {
            type: "checkbox",
            checked: showUnreliable,
            onChange: (event) => setShowUnreliable(event.target.checked)
          }),
          h("span", null, "Show low-confidence rows")
        )
      ),
    h(
      "div",
      { className: "historical-preset-buttons" },
      HISTORICAL_PRESETS.map((preset) =>
        h(
          "button",
          {
            key: preset.id,
            type: "button",
            className: `${activePresetId === preset.id ? "active" : ""} ${preset.tone}`,
            onClick: () => setActivePresetId(preset.id)
          },
          h("strong", null, preset.label),
          h("span", null, preset.range)
        )
      )
    ),
    snapshot &&
      h(
        TerrainMap3DImproved,
        {
          companies,
          title: `${snapshot.label} Market City`,
          description: `${snapshot.startDate} to ${snapshot.endDate}. ${snapshot.description}`,
          showTimeControls: false
        },
        h(
          "div",
          { className: "historical-data-note" },
          h(
            "span",
            null,
            `${companies.length} shown from ${snapshot.usableConstituents} price-resolved rows and ${snapshot.requestedConstituents} historical constituents.`
          ),
          h(
            "span",
            null,
            "Default view hides low-confidence rows with unresolved identity, suspect price scale, tiny volume, or generic share placeholders."
          )
        )
      )
  );
}
