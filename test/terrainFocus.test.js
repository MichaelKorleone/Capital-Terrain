import test from "node:test";
import assert from "node:assert/strict";

import {
  getFocusPositionForX,
  getSectorFocusTarget,
  getStockFocusTarget,
  shouldClearTerrainSelection
} from "../src/utils/terrainFocus.js";

const layouts = [
  { sector: "Technology", centerX: -18, width: 12 },
  { sector: "Financials", centerX: 4, width: 8 },
  { sector: "Energy", centerX: 19, width: 10 }
];

test("sector focus maps a sector center to the slider position", () => {
  assert.equal(getSectorFocusTarget(layouts, "Financials", 50).focusPosition, 16);
});

test("stock focus maps the selected bar x coordinate to the slider position", () => {
  assert.equal(getStockFocusTarget({ x: -12 }, 60).focusPosition, -40);
});

test("focus positions are clamped to the camera slider limits", () => {
  assert.equal(getFocusPositionForX(100, 40), 100);
  assert.equal(getFocusPositionForX(-100, 40), -100);
});

test("empty non-drag terrain clicks clear selection", () => {
  assert.equal(shouldClearTerrainSelection(null, false), true);
  assert.equal(shouldClearTerrainSelection({ userData: {} }, false), false);
  assert.equal(shouldClearTerrainSelection(null, true), false);
});
