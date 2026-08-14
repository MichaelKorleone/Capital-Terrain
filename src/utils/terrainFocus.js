export function getFocusPositionForX(x, fieldWidth) {
  if (!Number.isFinite(x) || !Number.isFinite(fieldWidth) || fieldWidth <= 0) return 0;
  return Math.round(clamp((x / (fieldWidth / 2)) * 100, -100, 100));
}

export function getSectorFocusTarget(layouts, sector, fieldWidth) {
  const layout = layouts.find((item) => item.sector === sector);
  if (!layout) return { focusPosition: 0, centerX: 0 };
  return {
    focusPosition: getFocusPositionForX(layout.centerX, fieldWidth),
    centerX: layout.centerX
  };
}

export function getStockFocusTarget(position, fieldWidth) {
  const x = Number(position?.x || 0);
  return {
    focusPosition: getFocusPositionForX(x, fieldWidth),
    centerX: x
  };
}

export function shouldClearTerrainSelection(hitObject, dragMoved = false) {
  return !dragMoved && !hitObject;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
