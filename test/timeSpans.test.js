import test from "node:test";
import assert from "node:assert/strict";

import { TIME_SPANS, loadMarketCapRepricingData } from "../src/services/marketData.js";
import { buildImportedSnapshotCompanies, parseSnapshotCsv } from "../src/utils/csvSnapshot.js";
import { buildGlobalRepricingSnapshot } from "../src/utils/globalRepricing.js";

test("time span controls include 2Y, 3Y, and Longest", () => {
  assert.deepEqual(
    TIME_SPANS.map((span) => span.value),
    ["1D", "1W", "1M", "1Q", "1Y", "2Y", "3Y", "5Y", "LONGEST"]
  );
  assert.equal(TIME_SPANS.find((span) => span.value === "LONGEST").label, "Longest");
  assert.equal(TIME_SPANS.find((span) => span.value === "LONGEST").longLabel, "the longest available API history");
});

test("mock repricing supports new long-horizon spans", () => {
  for (const span of ["2Y", "3Y", "LONGEST"]) {
    const rows = loadMarketCapRepricingData(span);
    assert.ok(rows.length >= 100);
    assert.equal(rows[0].timeSpan, span);
    assert.equal(Number.isFinite(rows[0].marketCapChange), true);
  }
});

test("imported snapshots read new long-horizon price columns", () => {
  const csv = [
    "ticker,companyName,sector,currentPrice,currentMarketCap,volume,price2Y,price3Y,priceLongest",
    "ABC,ABC Corp,Industrials,120,1200000000,5000000,80,60,20"
  ].join("\n");

  const [row] = parseSnapshotCsv(csv);
  const twoYear = buildImportedSnapshotCompanies([row], "2Y")[0];
  const longest = buildImportedSnapshotCompanies([row], "LONGEST")[0];

  assert.equal(twoYear.percentChange, 50);
  assert.equal(longest.percentChange, 500);
});

test("company rows preserve API inception date provenance", () => {
  const csv = [
    "ticker,companyName,sector,currentPrice,currentMarketCap,volume,priceLongest,apiInceptionDate",
    "ABC,ABC Corp,Industrials,120,1200000000,5000000,20,1985-09-10"
  ].join("\n");

  const [row] = parseSnapshotCsv(csv);
  const [company] = buildImportedSnapshotCompanies([row], "LONGEST");

  assert.equal(company.dataQuality.apiInceptionDate, "1985-09-10");
});

test("global repricing accepts Longest multiplier", () => {
  const snapshot = buildGlobalRepricingSnapshot([], "LONGEST");
  assert.equal(snapshot.timeSpan, "LONGEST");
  assert.ok(Math.abs(snapshot.assets.find((asset) => asset.id === "gold").change) > 0);
});
