import test from "node:test";
import assert from "node:assert/strict";

import { buildGlobalRepricingSnapshot } from "../src/utils/globalRepricing.js";

test("global repricing snapshot includes S&P 500 total from current companies", () => {
  const companies = [
    { marketCapChange: 10_000_000_000 },
    { marketCapChange: -3_000_000_000 },
    { marketCapChange: 2_000_000_000 }
  ];

  const snapshot = buildGlobalRepricingSnapshot(companies, "1D");
  const equities = snapshot.assets.find((asset) => asset.id === "sp500");

  assert.equal(equities.change, 9_000_000_000);
  assert.equal(equities.precision, "market-derived");
});

test("global repricing snapshot separates priced assets from slower estimate assets", () => {
  const snapshot = buildGlobalRepricingSnapshot([], "1D");
  const slowerAssets = snapshot.assets.filter((asset) => asset.precision !== "market-derived");

  assert.ok(snapshot.assets.some((asset) => asset.id === "gold"));
  assert.ok(snapshot.assets.some((asset) => asset.id === "crypto"));
  assert.ok(snapshot.assets.some((asset) => asset.id === "real-estate"));
  assert.ok(snapshot.assets.some((asset) => asset.id === "bank-savings"));
  assert.ok(slowerAssets.length >= 2);
});

test("global repricing snapshot avoids cash-flow wording", () => {
  const snapshot = buildGlobalRepricingSnapshot([], "1D");
  const combinedText = [
    snapshot.title,
    snapshot.description,
    ...snapshot.assets.flatMap((asset) => [asset.label, asset.note, asset.precision])
  ].join(" ").toLowerCase();

  assert.equal(combinedText.includes("cash inflow"), false);
  assert.equal(combinedText.includes("cash outflow"), false);
});
