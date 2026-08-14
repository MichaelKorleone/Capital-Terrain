import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = normalize(process.cwd());
const port = Number(process.env.PORT || 4173);
const host = process.env.PORT ? "0.0.0.0" : process.env.HOST || "127.0.0.1";
const FINANCIALS_URL =
  "https://datahub.io/core/s-and-p-500-companies-financials/_r/-/data/constituents-financials.csv";
const HISTORICAL_COMPONENTS_URL =
  "https://raw.githubusercontent.com/hanshof/sp500_constituents/main/sp_500_historical_components.csv";
const latestSnapshotCache = new Map();
let financialRowsCache = null;
let historicalComponentsCache = null;
let historicalNameMapCache = null;
let historicalDataOverrideCache = null;
const historicalPresetCache = new Map();
const datedSnapshotCache = new Map();

const HISTORICAL_PRESETS = {
  dotcom_bubble: {
    label: "Dot-Com Bubble Build",
    startDate: "1998-10-08",
    endDate: "2000-03-10",
    description: "Internet-era optimism into the Nasdaq peak."
  },
  dotcom_crash: {
    label: "Dot-Com Crash",
    startDate: "2000-03-10",
    endDate: "2002-10-09",
    description: "The long unwind after the dot-com peak."
  },
  gfc_crisis: {
    label: "Global Financial Crisis",
    startDate: "2007-10-09",
    endDate: "2009-03-09",
    description: "Credit-system stress into the S&P 500 crisis low."
  },
  covid_crash: {
    label: "COVID Crash",
    startDate: "2020-02-19",
    endDate: "2020-03-23",
    description: "The fast pandemic repricing from record high to panic low."
  },
  covid_recovery: {
    label: "COVID Recovery",
    startDate: "2020-03-23",
    endDate: "2020-12-31",
    description: "The reopening, stimulus, and software-led recovery."
  },
  ai_boom: {
    label: "AI Repricing Boom",
    startDate: "2022-11-30",
    endDate: "2024-12-31",
    description: "The post-ChatGPT repricing of compute and AI infrastructure."
  }
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if (url.pathname === "/api/latest-snapshot" || url.pathname === "/api/real-snapshot") {
    try {
      const snapshot = await getLatestSnapshot({
        force: url.searchParams.get("force") === "1",
        symbols: parseSymbolsParam(url.searchParams.get("symbols"))
      });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname === "/api/historical-preset") {
    try {
      const presetId = url.searchParams.get("event") || "covid_crash";
      const snapshot = await getHistoricalPresetSnapshot(presetId);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname === "/api/date-snapshot") {
    try {
      const requestedDate = normalizeDateInput(url.searchParams.get("date"));
      const snapshot = await getDatedSnapshot(requestedDate);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = statSync(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`Capital Terrain running at http://${host}:${port}`);
});

async function getLatestSnapshot({ force = false, symbols = [] } = {}) {
  const referenceHistory = await fetchYahooHistory("SPY");
  const referenceMarketDataDate = referenceHistory.latestDate || "unknown";
  const symbolsKey = symbols.length ? symbols.join(",") : "all";
  const internalCacheKey = `${referenceMarketDataDate}:${symbolsKey}`;
  if (!force && latestSnapshotCache.has(internalCacheKey)) {
    return {
      ...latestSnapshotCache.get(internalCacheKey),
      cacheStatus: "hit"
    };
  }

  const financialRows = await getFinancialRows();
  const sectorBySymbol = loadSectorMap();
  const requestedSymbols = new Set(symbols);

  const usableFinancialRows = financialRows.filter(
    (row) => row.Symbol && Number(row.Price) > 0 && Number(row["Market Cap"]) > 0
  ).filter(
    (row) => !requestedSymbols.size || requestedSymbols.has(normalizeSymbol(row.Symbol))
  );

  const historyRows = await mapWithConcurrency(usableFinancialRows, 8, async (row) => {
    const symbol = normalizeSymbol(row.Symbol);
    const history = await fetchYahooHistory(symbol);
    const rawCurrentPrice = Number(row.Price);
    const rawCurrentMarketCap = Number(row["Market Cap"]);
    const hasYahooLatestClose = history.latestPrice > 0;
    const shareProxy = rawCurrentPrice > 0 ? rawCurrentMarketCap / rawCurrentPrice : 0;
    const hasAdjustedPriceMismatch =
      hasYahooLatestClose &&
      rawCurrentPrice > 0 &&
      Math.max(history.latestPrice, rawCurrentPrice) / Math.min(history.latestPrice, rawCurrentPrice) > 1.25;
    const currentPrice = hasYahooLatestClose ? history.latestPrice : rawCurrentPrice;
    const currentMarketCap = hasYahooLatestClose
      ? Math.round(shareProxy * history.latestPrice)
      : rawCurrentMarketCap;
    const dataWarnings = [
      "Market cap uses current-share proxy for historical span comparisons."
    ];
    if (hasYahooLatestClose) {
      dataWarnings.push("Current price uses Yahoo latest close so daily repricing is close-to-close.");
    }
    if (hasAdjustedPriceMismatch) {
      dataWarnings.push(
        "DataHub price and Yahoo chart scale differed; market cap was normalized to Yahoo adjusted price scale."
      );
    }
    return {
      ticker: symbol,
      companyName: row.Name,
      sector: normalizeSector(sectorBySymbol[symbol] || row.Sector, "Unclassified"),
      currentPrice,
      currentMarketCap,
      volume: history.volume || 0,
      asOfDate: history.latestDate || referenceMarketDataDate,
      dataQuality: {
        confidence: hasYahooLatestClose ? "high" : "medium",
        score: hasYahooLatestClose ? 88 : 62,
        warnings: dataWarnings,
        shareEstimateMethod: hasAdjustedPriceMismatch ? "adjusted current market-cap proxy" : "current-share proxy",
        priceSource: "DataHub current financials + Yahoo public chart endpoint",
        apiInceptionDate: history.inceptionDate,
        inceptionDateSource: "Yahoo public chart endpoint earliest available close"
      },
      periodStartPrices: {
        "1D": history.price1D || currentPrice,
        "1W": history.price1W || currentPrice,
        "1M": history.price1M || currentPrice,
        "1Q": history.price1Q || currentPrice,
        "1Y": history.price1Y || currentPrice,
        "2Y": history.price2Y || currentPrice,
        "3Y": history.price3Y || currentPrice,
        "5Y": history.price5Y || currentPrice,
        "LONGEST": history.priceLongest || currentPrice
      }
    };
  });

  const rows = historyRows.filter(Boolean);
  const marketDataDate = mostCommon(rows.map((row) => row.asOfDate)) || referenceMarketDataDate;
  const fetchedAt = new Date().toISOString();
  const snapshot = {
    source: "DataHub S&P 500 financials + Yahoo Finance chart history",
    marketDataDate,
    asOfDate: marketDataDate,
    fetchedAt,
    asOf: fetchedAt,
    cacheKey: marketDataDate,
    cacheStatus: "refreshed",
    requestedSymbols: symbols,
    requestedConstituents: usableFinancialRows.length,
    usableConstituents: rows.length,
    rows
  };
  latestSnapshotCache.set(internalCacheKey, snapshot);
  return snapshot;
}

async function getHistoricalPresetSnapshot(presetId) {
  const preset = HISTORICAL_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown historical preset: ${presetId}`);
  if (historicalPresetCache.has(presetId)) return historicalPresetCache.get(presetId);

  const [financialRows, historicalComponents] = await Promise.all([
    getFinancialRows(),
    getHistoricalComponents()
  ]);
  const sectorBySymbol = loadSectorMap();
  const historicalNameBySymbol = loadHistoricalNameMap();
  const historicalDataOverrides = loadHistoricalDataOverrides();
  const financialBySymbol = new Map(
    financialRows
      .filter((row) => row.Symbol)
      .map((row) => [normalizeSymbol(row.Symbol), row])
  );
  const symbols = findConstituentsForDate(historicalComponents, preset.startDate);

  const rows = await mapWithConcurrency(symbols.slice(0, 520), 10, async (symbol) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const financial = financialBySymbol.get(normalizedSymbol);
    const history = await fetchYahooRange(normalizedSymbol, preset.startDate, preset.endDate);
    if (!history.startPrice || !history.endPrice) return null;

    const currentPrice = Number(financial?.Price || 0);
    const currentMarketCap = Number(financial?.["Market Cap"] || 0);
    const hasCurrentFinancials = currentPrice > 0 && currentMarketCap > 0;
    const sharesOutstandingApprox =
      hasCurrentFinancials
        ? currentMarketCap / currentPrice
        : 1_000_000_000;
    const previousMarketCap = Math.round(sharesOutstandingApprox * history.startPrice);
    const endMarketCap = Math.round(sharesOutstandingApprox * history.endPrice);
    const companyName = resolveCompanyName(normalizedSymbol, financial?.Name, historicalNameBySymbol);
    const dataQuality = scoreHistoricalRow({
      symbol: normalizedSymbol,
      companyName,
      history,
      percentChange: ((history.endPrice - history.startPrice) / history.startPrice) * 100,
      hasCurrentFinancials,
      hasManualName: Boolean(historicalNameBySymbol[normalizedSymbol]),
      override: historicalDataOverrides[normalizedSymbol]
    });

    return {
      ticker: normalizedSymbol,
      companyName,
      sector: normalizeSector(sectorBySymbol[normalizedSymbol] || financial?.Sector, "Historical S&P 500"),
      previousMarketCap,
      currentMarketCap: endMarketCap,
      marketCapChange: endMarketCap - previousMarketCap,
      percentChange: Number((((history.endPrice - history.startPrice) / history.startPrice) * 100).toFixed(2)),
      volume: Math.round(history.volume || 0),
      startPrice: history.startPrice,
      endPrice: history.endPrice,
      dataQuality
    };
  });

  const usableRows = rows.filter(Boolean);
  const confidenceCounts = usableRows.reduce(
    (counts, row) => {
      counts[row.dataQuality.confidence] = (counts[row.dataQuality.confidence] || 0) + 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const snapshot = {
    source:
      "Free prototype: historical S&P 500 constituents + Yahoo Finance historical prices + current-share market-cap estimate",
    presetId,
    ...preset,
    requestedConstituents: symbols.length,
    usableConstituents: usableRows.length,
    confidenceCounts,
    asOf: new Date().toISOString(),
    rows: usableRows
  };
  historicalPresetCache.set(presetId, snapshot);
  return snapshot;
}

async function getDatedSnapshot(requestedDate) {
  const cacheKey = requestedDate;
  if (datedSnapshotCache.has(cacheKey)) return datedSnapshotCache.get(cacheKey);

  const financialRows = await getFinancialRows();
  const sectorBySymbol = loadSectorMap();
  const usableFinancialRows = financialRows.filter(
    (row) => row.Symbol && Number(row.Price) > 0 && Number(row["Market Cap"]) > 0
  );
  const selectedEnd = new Date(`${requestedDate}T23:59:59Z`);

  const rows = await mapWithConcurrency(usableFinancialRows, 8, async (row) => {
    const symbol = normalizeSymbol(row.Symbol);
    const history = await fetchYahooDateWindow(symbol, requestedDate);
    if (!history.points.length) return null;

    const endPoint = pointAtOrBefore(history.points, selectedEnd);
    if (!endPoint?.close) return null;

    const rawCurrentPrice = Number(row.Price);
    const rawCurrentMarketCap = Number(row["Market Cap"]);
    const sharesOutstandingApprox = rawCurrentMarketCap / rawCurrentPrice;
    const currentMarketCap = Math.round(sharesOutstandingApprox * endPoint.close);
    const isExactTradingDate = dateToYmd(endPoint.date) === requestedDate;
    const lookbacks = {
      "1D": previousTradingClose(history.points, endPoint.date),
      "1W": closeAtOrBefore(history.points, shiftDate(endPoint.date, { days: -7 })),
      "1M": closeAtOrBefore(history.points, shiftDate(endPoint.date, { months: -1 })),
      "1Q": closeAtOrBefore(history.points, shiftDate(endPoint.date, { months: -3 })),
      "1Y": closeAtOrBefore(history.points, shiftDate(endPoint.date, { years: -1 })),
      "2Y": closeAtOrBefore(history.points, shiftDate(endPoint.date, { years: -2 })),
      "3Y": closeAtOrBefore(history.points, shiftDate(endPoint.date, { years: -3 })),
      "5Y": closeAtOrBefore(history.points, shiftDate(endPoint.date, { years: -5 })),
      "LONGEST": history.points[0]?.close
    };

    const warnings = [
      "Market cap uses current-share proxy, not historical shares outstanding."
    ];
    if (!isExactTradingDate) {
      warnings.push(`Selected date was not a trading day for this ticker; using ${dateToYmd(endPoint.date)}.`);
    }

    return {
      ticker: symbol,
      companyName: row.Name,
      sector: normalizeSector(sectorBySymbol[symbol] || row.Sector, "Unclassified"),
      currentPrice: endPoint.close,
      currentMarketCap,
      volume: endPoint.volume || 0,
      asOfDate: dateToYmd(endPoint.date),
      dataQuality: {
        confidence: isExactTradingDate ? "high" : "medium",
        score: isExactTradingDate ? 84 : 70,
        warnings,
        shareEstimateMethod: "current-share proxy",
        priceSource: "DataHub current financials + Yahoo public chart endpoint",
        apiInceptionDate: dateToYmd(history.points[0].date),
        inceptionDateSource: "Yahoo public chart endpoint earliest available close"
      },
      periodStartPrices: lookbacks
    };
  });

  const usableRows = rows.filter(Boolean);
  const asOfDate = mostCommon(usableRows.map((row) => row.asOfDate)) || requestedDate;
  const snapshot = {
    source:
      "Free prototype: DataHub current S&P 500 financials + Yahoo Finance historical prices + current-share market-cap estimate",
    requestedDate,
    asOfDate,
    requestedConstituents: usableFinancialRows.length,
    usableConstituents: usableRows.length,
    asOf: new Date().toISOString(),
    rows: usableRows
  };
  datedSnapshotCache.set(cacheKey, snapshot);
  return snapshot;
}

async function getFinancialRows() {
  if (!financialRowsCache) financialRowsCache = await fetchCsv(FINANCIALS_URL);
  return financialRowsCache;
}

async function getHistoricalComponents() {
  if (historicalComponentsCache) return historicalComponentsCache;
  const rows = await fetchCsv(HISTORICAL_COMPONENTS_URL);
  historicalComponentsCache = rows.map((row) => ({
    date: row.date || row.Date || row.asOf || row.AsOf || "",
    symbols: parseSymbolList(row.tickers || row.Tickers || row.symbols || row.Symbols || row.components || row.Components || "")
  })).filter((row) => row.date && row.symbols.length);
  return historicalComponentsCache;
}

function findConstituentsForDate(rows, targetDate) {
  const target = new Date(`${targetDate}T00:00:00Z`);
  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
  let best = sorted[0];
  for (const row of sorted) {
    if (new Date(row.date) <= target) best = row;
    else break;
  }
  return [...new Set(best.symbols.map(normalizeSymbol))];
}

function parseSymbolList(value) {
  return String(value || "")
    .replace(/[\[\]'"]/g, "")
    .split(/[|;,\s]+/)
    .map((symbol) => normalizeSymbol(symbol))
    .filter(Boolean);
}

function parseSymbolsParam(value) {
  return [...new Set(parseSymbolList(value))];
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/\./g, "-");
}

function resolveCompanyName(symbol, financialName, historicalNameBySymbol) {
  const cleanFinancialName = String(financialName || "").trim();
  if (cleanFinancialName && normalizeSymbol(cleanFinancialName) !== symbol) return cleanFinancialName;
  return historicalNameBySymbol[symbol] || cleanFinancialName || symbol;
}

function scoreHistoricalRow(options) {
  const {
    symbol,
    companyName,
    history,
    percentChange,
    hasCurrentFinancials,
    hasManualName,
    override
  } = options;
  const warnings = [];
  let score = 100;
  const volume = Math.round(history.volume || 0);
  const hasTickerOnlyName = normalizeSymbol(companyName) === symbol;
  const extremeMove = Math.abs(percentChange) > 300;
  const veryHighPrice = Math.max(history.startPrice, history.endPrice) > 1000;
  const tinyVolume = volume < 1000;

  if (!hasCurrentFinancials) {
    score -= 38;
    warnings.push("No current financial row; market cap uses a generic 1B-share placeholder.");
  } else {
    warnings.push("Market cap uses current-share proxy, not historical shares outstanding.");
  }

  if (hasManualName) {
    score -= 6;
    warnings.push("Company name supplied by local historical-name lookup.");
  }

  if (hasTickerOnlyName) {
    score -= 28;
    warnings.push("Company identity is unresolved beyond ticker.");
  }

  if (tinyVolume) {
    score -= 24;
    warnings.push("Very low end-date volume in free price source.");
  }

  if (veryHighPrice && tinyVolume) {
    score -= 45;
    warnings.push("Suspicious high historical price with tiny volume; possible stale or remapped ticker.");
  } else if (veryHighPrice) {
    score -= 10;
    warnings.push("Historical price is unusually high; verify split/adjustment handling.");
  }

  if (extremeMove && !hasCurrentFinancials) {
    score -= 22;
    warnings.push("Extreme move on a row without verified market-cap base.");
  } else if (extremeMove) {
    score -= 6;
    warnings.push("Extreme move; useful but worth manual review.");
  }

  if (override) {
    warnings.push(...(override.warnings || []));
    if (override.confidence === "low") score = Math.min(score, 29);
    if (override.confidence === "medium") score = Math.min(score, 69);
    if (override.confidence === "high") score = Math.max(score, 80);
  }

  const confidence = score >= 78 ? "high" : score >= 45 ? "medium" : "low";
  return {
    confidence,
    score: Math.max(0, Math.min(100, Math.round(score))),
    warnings: [...new Set(warnings)].slice(0, 5),
    shareEstimateMethod: hasCurrentFinancials ? "current-share proxy" : "generic 1B-share placeholder",
    priceSource: "Yahoo public chart endpoint"
  };
}

function normalizeSector(sector, fallback = "Unclassified") {
  const broadSectors = new Set([
    "Information Technology",
    "Health Care",
    "Financials",
    "Consumer Discretionary",
    "Communication Services",
    "Industrials",
    "Consumer Staples",
    "Energy",
    "Utilities",
    "Real Estate",
    "Materials"
  ]);
  return broadSectors.has(sector) ? sector : fallback;
}

async function fetchYahooRange(symbol, startDate, endDate) {
  const period1 = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000) - 7 * 86400;
  const period2 = Math.floor(new Date(`${endDate}T00:00:00Z`).getTime() / 1000) + 7 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${period1}&period2=${period2}&interval=1d`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Capital Terrain prototype" }
  });
  if (!response.ok) return {};

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) return {};

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const close = quote.close || [];
  const volume = quote.volume || [];
  const points = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000),
      close: Number(close[index]),
      volume: Number(volume[index] || 0)
    }))
    .filter((point) => Number.isFinite(point.close) && point.close > 0);

  const startPoint = pointAtOrBefore(points, new Date(`${startDate}T23:59:59Z`));
  const endPoint = pointAtOrBefore(points, new Date(`${endDate}T23:59:59Z`));
  return {
    startPrice: startPoint?.close,
    endPrice: endPoint?.close,
    volume: endPoint?.volume || 0
  };
}

async function fetchYahooDateWindow(symbol, requestedDate) {
  const end = new Date(`${requestedDate}T23:59:59Z`);
  const start = new Date("1970-01-01T00:00:00Z");
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000) + 7 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${period1}&period2=${period2}&interval=1d`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Capital Terrain prototype" }
  });
  if (!response.ok) return { points: [] };

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) return { points: [] };

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const close = quote.close || [];
  const volume = quote.volume || [];
  const points = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000),
      close: Number(close[index]),
      volume: Number(volume[index] || 0)
    }))
    .filter((point) => Number.isFinite(point.close) && point.close > 0);

  return { points };
}

function pointAtOrBefore(points, targetDate) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= targetDate) return points[index];
  }
  return points[0];
}

function loadSectorMap() {
  try {
    return JSON.parse(readFileSync(join(root, "templates", "sp500-sector-map.json"), "utf8"));
  } catch {
    return {};
  }
}

function loadHistoricalNameMap() {
  if (historicalNameMapCache) return historicalNameMapCache;
  try {
    historicalNameMapCache = JSON.parse(readFileSync(join(root, "templates", "historical-company-names.json"), "utf8"));
  } catch {
    historicalNameMapCache = {};
  }
  return historicalNameMapCache;
}

function loadHistoricalDataOverrides() {
  if (historicalDataOverrideCache) return historicalDataOverrideCache;
  try {
    historicalDataOverrideCache = JSON.parse(readFileSync(join(root, "templates", "historical-data-overrides.json"), "utf8"));
  } catch {
    historicalDataOverrideCache = {};
  }
  return historicalDataOverrideCache;
}

async function fetchCsv(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Capital Terrain prototype" }
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return parseCsv(await response.text()).map((row) => rowToObject(row));
}

async function fetchYahooHistory(symbol) {
  const yahooSymbol = symbol.replace(/\./g, "-");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?range=max&interval=1d`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Capital Terrain prototype" }
  });
  if (!response.ok) return {};

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) return {};

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const close = quote.close || [];
  const volume = quote.volume || [];
  const points = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000),
      close: Number(close[index]),
      volume: Number(volume[index] || 0)
    }))
    .filter((point) => Number.isFinite(point.close) && point.close > 0);

  if (!points.length) return {};

  const latest = points[points.length - 1];
  return {
    latestPrice: latest.close,
    latestDate: dateToYmd(latest.date),
    volume: latest.volume,
    price1D: points[Math.max(0, points.length - 2)]?.close,
    price1W: closeAtOrBefore(points, shiftDate(latest.date, { days: -7 })),
    price1M: closeAtOrBefore(points, shiftDate(latest.date, { months: -1 })),
    price1Q: closeAtOrBefore(points, shiftDate(latest.date, { months: -3 })),
    price1Y: closeAtOrBefore(points, shiftDate(latest.date, { years: -1 })),
    price2Y: closeAtOrBefore(points, shiftDate(latest.date, { years: -2 })),
    price3Y: closeAtOrBefore(points, shiftDate(latest.date, { years: -3 })),
    price5Y: closeAtOrBefore(points, shiftDate(latest.date, { years: -5 })),
    priceLongest: points[0]?.close,
    inceptionDate: dateToYmd(points[0].date)
  };
}

function closeAtOrBefore(points, targetDate) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= targetDate) return points[index].close;
  }
  return points[0]?.close;
}

function previousTradingClose(points, currentDate) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date < currentDate) return points[index].close;
  }
  return points[0]?.close;
}

function dateToYmd(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDateInput(value) {
  const fallback = new Date().toISOString().slice(0, 10);
  const candidate = String(value || fallback).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : candidate;
}

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function shiftDate(date, { days = 0, months = 0, years = 0 }) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  shifted.setMonth(shifted.getMonth() + months);
  shifted.setFullYear(shifted.getFullYear() + years);
  return shifted;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

function parseCsv(text) {
  const rows = [];
  let headers = null;
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        if (!headers) headers = row;
        else rows.push({ headers, values: row });
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    if (!headers) headers = row;
    else rows.push({ headers, values: row });
  }
  return rows;
}

function rowToObject(row) {
  return row.headers.reduce((object, header, index) => {
    object[header] = row.values[index] || "";
    return object;
  }, {});
}
