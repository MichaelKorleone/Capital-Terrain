const PERIOD_COLUMNS = {
  "1D": ["price1D", "price_1D", "priceOneDay"],
  "1W": ["price1W", "price_1W", "priceOneWeek"],
  "1M": ["price1M", "price_1M", "priceOneMonth"],
  "1Q": ["price1Q", "price_1Q", "priceOneQuarter"],
  "1Y": ["price1Y", "price_1Y", "priceOneYear"],
  "2Y": ["price2Y", "price_2Y", "priceTwoYear", "priceTwoYears"],
  "3Y": ["price3Y", "price_3Y", "priceThreeYear", "priceThreeYears"],
  "5Y": ["price5Y", "price_5Y", "priceFiveYear", "priceFiveYears"],
  "LONGEST": ["priceLongest", "price_longest", "priceSI", "price_si", "priceSinceInception", "priceInception"]
};

export function parseSnapshotCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));

  return rows
    .slice(1)
    .map((row) => rowToObject(headers, row))
    .filter((row) => row.ticker && row.currentMarketCap && row.currentPrice)
    .map((row) => ({
      ticker: row.ticker,
      companyName: row.companyName || row.ticker,
      sector: row.sector || "Unclassified",
      currentPrice: toNumber(row.currentPrice),
      currentMarketCap: toNumber(row.currentMarketCap),
      volume: toNumber(row.volume),
      dataQuality: buildDataQuality(row),
      periodStartPrices: {
        "1D": firstNumber(row, PERIOD_COLUMNS["1D"]),
        "1W": firstNumber(row, PERIOD_COLUMNS["1W"]),
        "1M": firstNumber(row, PERIOD_COLUMNS["1M"]),
        "1Q": firstNumber(row, PERIOD_COLUMNS["1Q"]),
        "1Y": firstNumber(row, PERIOD_COLUMNS["1Y"]),
        "2Y": firstNumber(row, PERIOD_COLUMNS["2Y"]),
        "3Y": firstNumber(row, PERIOD_COLUMNS["3Y"]),
        "5Y": firstNumber(row, PERIOD_COLUMNS["5Y"]),
        "LONGEST": firstNumber(row, PERIOD_COLUMNS["LONGEST"])
      }
    }));
}

function buildDataQuality(row) {
  const apiInceptionDate = row.apiInceptionDate || row.inceptionDate || row.sinceInceptionDate || "";
  if (!apiInceptionDate) return undefined;
  return {
    confidence: "medium",
    score: 65,
    warnings: ["Since-inception start date came from imported data."],
    shareEstimateMethod: "imported current-share proxy",
    priceSource: "Imported snapshot",
    apiInceptionDate,
    inceptionDateSource: row.inceptionDateSource || "Imported snapshot"
  };
}

export function buildImportedSnapshotCompanies(snapshotRows, timeSpan) {
  return snapshotRows.map((row) => {
    const periodStartPrice = row.periodStartPrices[timeSpan] || row.periodStartPrices["1D"] || row.currentPrice;
    const sharesOutstandingApprox = row.currentPrice ? row.currentMarketCap / row.currentPrice : 0;
    const previousMarketCap = Math.round(sharesOutstandingApprox * periodStartPrice);
    const currentMarketCap = Math.round(row.currentMarketCap);
    const marketCapChange = currentMarketCap - previousMarketCap;
    const percentChange = periodStartPrice
      ? ((row.currentPrice - periodStartPrice) / periodStartPrice) * 100
      : 0;

    return {
      ticker: row.ticker,
      companyName: row.companyName,
      sector: row.sector,
      previousMarketCap,
      currentMarketCap,
      marketCapChange,
      percentChange: Number(percentChange.toFixed(2)),
      volume: Math.round(row.volume || 0),
      dataQuality: row.dataQuality,
      asOfDate: row.asOfDate
    };
  });
}

function rowToObject(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index] || "";
    return object;
  }, {});
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character) => character.toUpperCase())
    .replace(/^[A-Z]/, (character) => character.toLowerCase());
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value || "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(text) {
  const rows = [];
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
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}
