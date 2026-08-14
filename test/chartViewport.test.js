import test from "node:test";
import assert from "node:assert/strict";

import {
  applyWheelZoom,
  getDynamicMarketCapDomain,
  getExpandedChartWidth,
  getTickerLabelStride,
  getVisibleIndexRange,
  shouldZoomFromWheel
} from "../src/utils/chartViewport.js";

test("vertical wheel gestures zoom the chart and keep the pointer anchored", () => {
  const result = applyWheelZoom({
    zoom: 1,
    deltaY: -120,
    viewportWidth: 1000,
    contentWidth: 1000,
    scrollLeft: 0,
    pointerX: 500
  });

  assert.ok(result.zoom > 1);
  assert.ok(result.contentWidth > 1000);
  assert.ok(result.scrollLeft > 0);
});

test("horizontal wheel gestures are treated as pan gestures", () => {
  assert.equal(shouldZoomFromWheel({ deltaX: 90, deltaY: 8 }), false);
  assert.equal(shouldZoomFromWheel({ deltaX: 80, deltaY: 62 }), false);
  assert.equal(shouldZoomFromWheel({ deltaX: 60, deltaY: 72 }), false);
  assert.equal(shouldZoomFromWheel({ deltaX: 2, deltaY: -60 }), true);
  assert.equal(shouldZoomFromWheel({ deltaX: 30, deltaY: -72 }), true);
});

test("expanded chart width grows enough to make dense bars inspectable", () => {
  const baseWidth = getExpandedChartWidth({
    containerWidth: 1000,
    itemCount: 500,
    zoom: 1
  });
  const zoomedWidth = getExpandedChartWidth({
    containerWidth: 1000,
    itemCount: 500,
    zoom: 4
  });

  assert.equal(baseWidth, 1000);
  assert.ok(zoomedWidth >= 500 * 8);
  assert.ok(zoomedWidth > baseWidth);
});

test("visible index range follows the horizontally scrolled chart window", () => {
  const range = getVisibleIndexRange({
    scrollLeft: 2100,
    viewportWidth: 1000,
    plotOffset: 84,
    plotWidth: 5000,
    itemCount: 500
  });

  assert.ok(range.start >= 190);
  assert.ok(range.start < 210);
  assert.ok(range.end > range.start);
  assert.ok(range.end <= 315);
});

test("dynamic market cap domain scales to the visible companies", () => {
  const companies = [
    { marketCapChange: 100_000_000_000 },
    { marketCapChange: -80_000_000_000 },
    { marketCapChange: 4_000_000_000 },
    { marketCapChange: -2_000_000_000 }
  ];

  const fullDomain = getDynamicMarketCapDomain(companies, { start: 0, end: 4 });
  const rightSideDomain = getDynamicMarketCapDomain(companies, { start: 2, end: 4 });

  assert.ok(Math.abs(fullDomain[0] + 112_000_000_000) < 0.001);
  assert.ok(Math.abs(fullDomain[1] - 112_000_000_000) < 0.001);
  assert.ok(Math.abs(rightSideDomain[0] + 4_480_000_000) < 0.001);
  assert.ok(Math.abs(rightSideDomain[1] - 4_480_000_000) < 0.001);
});

test("ticker labels get denser as the user zooms in", () => {
  assert.ok(getTickerLabelStride({ itemCount: 500, zoom: 1 }) > getTickerLabelStride({ itemCount: 500, zoom: 4 }));
  assert.equal(getTickerLabelStride({ itemCount: 20, zoom: 8 }), 1);
});
