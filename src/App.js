import React, { useEffect, useMemo, useRef, useState } from "react";
import { CompanySearch } from "./components/CompanySearch.js";
import { DashboardControls } from "./components/DashboardControls.js";
import { DataSourcePanel } from "./components/DataSourcePanel.js";
import { DatedTerrainField } from "./components/DatedTerrainField.js";
import { GlobalRepricingSnapshot } from "./components/GlobalRepricingSnapshot.js";
import { HistoricalPresetTerrain } from "./components/HistoricalPresetTerrain.js";
import { MarketCapChart } from "./components/MarketCapChart.js";
import { MarketTickerTape } from "./components/MarketTickerTape.js";
import { StatCards } from "./components/StatCards.js";
import { TerrainMap3DImproved } from "./components/TerrainMap3DImproved.js";
import { TIME_SPANS, loadMarketCapRepricingData } from "./services/marketData.js";
import { buildImportedSnapshotCompanies } from "./utils/csvSnapshot.js";
import { buildSectorTerrainGroups } from "./utils/sectorTerrain.js";
import { sortCompanies } from "./utils/sorting.js";

const h = React.createElement;

async function fetchLatestSnapshot({ force = false } = {}) {
  const response = await fetch(`/api/latest-snapshot${force ? "?force=1" : ""}`);
  const snapshot = await response.json();
  if (!response.ok) throw new Error(snapshot.error || "Snapshot request failed");
  return snapshot;
}

function buildSnapshotNote(snapshot) {
  const cacheText = snapshot.cacheStatus === "hit" ? "served from today's cache" : "freshly refreshed";
  return [
    `${snapshot.rows.length.toLocaleString()} latest snapshot rows loaded`,
    `market data as of ${snapshot.marketDataDate || snapshot.asOfDate}`,
    `fetched ${formatDateTime(snapshot.fetchedAt || snapshot.asOf)}`,
    cacheText,
    `source: ${snapshot.source}`
  ].join(". ");
}

function formatDateTime(value) {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function App() {
  const [sector, setSector] = useState("All sectors");
  const [sortMode, setSortMode] = useState("absolute");
  const [timeSpan, setTimeSpan] = useState("1D");
  const [importedSnapshotRows, setImportedSnapshotRows] = useState([]);
  const [dataSource, setDataSource] = useState("mock");
  const [sourceNote, setSourceNote] = useState("Auto-loading the latest real snapshot for the main charts.");
  const [snapshotMeta, setSnapshotMeta] = useState(null);
  const [isAutoLoadingRealSnapshot, setIsAutoLoadingRealSnapshot] = useState(true);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [selectedCompanyTicker, setSelectedCompanyTicker] = useState("");
  const userSelectedSourceRef = useRef(false);
  const activeTimeSpan = TIME_SPANS.find((option) => option.value === timeSpan) || TIME_SPANS[0];
  const companies = useMemo(() => {
    if (dataSource === "imported" && importedSnapshotRows.length) {
      return buildImportedSnapshotCompanies(importedSnapshotRows, timeSpan);
    }
    return loadMarketCapRepricingData(timeSpan);
  }, [dataSource, importedSnapshotRows, timeSpan]);
  const sectorTerrainGroups = useMemo(() => buildSectorTerrainGroups(companies), [companies]);

  const sectors = useMemo(
    () => [
      "All sectors",
      ...sectorTerrainGroups
        .filter((group) => group.companyCount > 0)
        .map((group) => group.sector)
    ],
    [sectorTerrainGroups]
  );

  const visibleCompanies = useMemo(() => {
    const filtered =
      sector === "All sectors"
        ? companies
        : companies.filter((company) => company.sector === sector);

    return sortCompanies(filtered, sortMode);
  }, [companies, sector, sortMode]);

  const companySuggestions = useMemo(
    () => buildCompanySuggestions(companies, companySearchQuery),
    [companies, companySearchQuery]
  );

  const highlightedTicker =
    selectedCompanyTicker || (companySearchQuery.trim() ? companySuggestions[0]?.ticker || "" : "");

  useEffect(() => {
    if (!selectedCompanyTicker) return;
    if (!companies.some((company) => company.ticker === selectedCompanyTicker)) {
      setSelectedCompanyTicker("");
    }
  }, [companies, selectedCompanyTicker]);

  async function loadRealSnapshot({ force = false } = {}) {
    const snapshot = await fetchLatestSnapshot({ force });
    setImportedSnapshotRows(snapshot.rows);
    setDataSource("imported");
    setSector("All sectors");
    setSnapshotMeta(snapshot);
    setSourceNote(buildSnapshotNote(snapshot));
    return snapshot;
  }

  useEffect(() => {
    let cancelled = false;
    setIsAutoLoadingRealSnapshot(true);
    setSourceNote("Auto-loading the latest real snapshot for the main charts.");

    fetchLatestSnapshot()
      .then((snapshot) => {
        if (cancelled || userSelectedSourceRef.current) return;
        setImportedSnapshotRows(snapshot.rows);
        setDataSource("imported");
        setSector("All sectors");
        setSnapshotMeta(snapshot);
        setSourceNote(buildSnapshotNote(snapshot));
      })
      .catch((error) => {
        if (cancelled || userSelectedSourceRef.current) return;
        setSourceNote(`Could not auto-load latest snapshot, so mock data is still shown: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setIsAutoLoadingRealSnapshot(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return h(
    "main",
    { className: "app-shell" },
    h(
      "section",
      { className: "dashboard" },
      h(
        "header",
        { className: "hero" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Capital Terrain"),
          h("h1", null, "S&P 500 Daily Market Cap Repricing Map"),
          h(
            "p",
            { className: "subtitle" },
            "This chart shows valuation repricing, not literal cash inflow/outflow."
          )
        ),
        h(
          "div",
          { className: "concept-note" },
          `Each bar compares current market capitalization with the period-start market capitalization for ${activeTimeSpan.longLabel}. Sector groups are prepared for the next terrain-map prototype.`
        )
      ),
      h(DataSourcePanel, {
        dataSource,
        importedCount: importedSnapshotRows.length,
        sourceNote,
        snapshotMeta,
        isExternallyLoading: isAutoLoadingRealSnapshot,
        onSnapshotLoaded: (rows) => {
          userSelectedSourceRef.current = true;
          setImportedSnapshotRows(rows);
          setDataSource("imported");
          setSector("All sectors");
          setSnapshotMeta(null);
          setSourceNote(`${rows.length.toLocaleString()} snapshot rows loaded from CSV.`);
        },
        onLoadRealSnapshot: async ({ force = false } = {}) => {
          userSelectedSourceRef.current = true;
          return loadRealSnapshot({ force });
        },
        onUseMock: () => {
          userSelectedSourceRef.current = true;
          setDataSource("mock");
          setSector("All sectors");
          setSnapshotMeta(null);
          setSourceNote("Mock market data selected manually.");
        }
      }),
      h(StatCards, { companies: visibleCompanies }),
      h(DashboardControls, {
        sector,
        sectors,
        sortMode,
        timeSpan,
        timeSpans: TIME_SPANS,
        onSectorChange: setSector,
        onSortModeChange: setSortMode,
        onTimeSpanChange: setTimeSpan
      }),
      h(CompanySearch, {
        query: companySearchQuery,
        suggestions: companySuggestions,
        highlightedTicker,
        onQueryChange: (value) => {
          setCompanySearchQuery(value);
          setSelectedCompanyTicker("");
        },
        onSelectCompany: (company) => {
          setCompanySearchQuery(company.ticker);
          setSelectedCompanyTicker(company.ticker);
          setSector("All sectors");
        },
        onClear: () => {
          setCompanySearchQuery("");
          setSelectedCompanyTicker("");
        }
      }),
      h(MarketCapChart, { companies: visibleCompanies, highlightedTicker }),
      h(GlobalRepricingSnapshot, { companies, timeSpan }),
      h(TerrainMap3DImproved, {
        companies,
        highlightedTicker,
        timeSpan,
        timeSpans: TIME_SPANS,
        onTimeSpanChange: setTimeSpan
      }),
      h(DatedTerrainField, { highlightedTicker }),
      h(HistoricalPresetTerrain)
    ),
    h(MarketTickerTape, { companies, timeSpan })
  );
}

function buildCompanySuggestions(companies, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return companies
    .map((company) => {
      const ticker = company.ticker.toLowerCase();
      const name = company.companyName.toLowerCase();
      let score = 0;
      if (ticker === normalizedQuery) score = 100;
      else if (ticker.startsWith(normalizedQuery)) score = 90;
      else if (name.startsWith(normalizedQuery)) score = 70;
      else if (ticker.includes(normalizedQuery)) score = 55;
      else if (name.includes(normalizedQuery)) score = 45;
      return { company, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.abs(b.company.marketCapChange) - Math.abs(a.company.marketCapChange);
    })
    .slice(0, 10)
    .map((item) => item.company);
}
