import test from "node:test";
import assert from "node:assert/strict";

import { buildTickerTapeItems, getTickerTapeDurationSeconds } from "../src/utils/tickerTape.js";

test("ticker tape items keep the selected time span and financial fields", () => {
  const items = buildTickerTapeItems(
    [
      {
        ticker: "MSFT",
        companyName: "Microsoft",
        sector: "Information Technology",
        marketCapChange: 12_000_000_000,
        percentChange: 1.2,
        volume: 24_000_000
      }
    ],
    { timeSpan: "1W", repeat: 1 }
  );

  assert.deepEqual(items[0], {
    key: "MSFT-0",
    ticker: "MSFT",
    companyName: "Microsoft",
    sector: "Information Technology",
    marketCapChange: 12_000_000_000,
    percentChange: 1.2,
    volume: 24_000_000,
    timeSpan: "1W"
  });
});

test("ticker tape orders companies by largest absolute repricing", () => {
  const items = buildTickerTapeItems(
    [
      { ticker: "A", marketCapChange: 2, percentChange: 0.1, volume: 1 },
      { ticker: "B", marketCapChange: -10, percentChange: -0.4, volume: 1 },
      { ticker: "C", marketCapChange: 6, percentChange: 0.2, volume: 1 }
    ],
    { timeSpan: "1D", repeat: 1 }
  );

  assert.deepEqual(items.map((item) => item.ticker), ["B", "C", "A"]);
});

test("ticker tape duplicates the sequence for continuous scrolling", () => {
  const items = buildTickerTapeItems(
    [
      { ticker: "A", marketCapChange: 1, percentChange: 0.1, volume: 1 },
      { ticker: "B", marketCapChange: 2, percentChange: 0.2, volume: 1 }
    ],
    { timeSpan: "1D", repeat: 2 }
  );

  assert.deepEqual(items.map((item) => item.key), ["B-0", "A-0", "B-1", "A-1"]);
});

test("ticker tape duration scales to readable human scanning speed", () => {
  assert.ok(getTickerTapeDurationSeconds(500) >= 700);
  assert.ok(getTickerTapeDurationSeconds(50) < getTickerTapeDurationSeconds(500));
  assert.ok(getTickerTapeDurationSeconds(5) >= 90);
});
