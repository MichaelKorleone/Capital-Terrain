const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const MIN_BAR_SLOT = 2;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_ZOOM_DOMINANCE_RATIO = 1.35;

export function clampZoom(zoom, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM) {
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}

export function shouldZoomFromWheel({ deltaX = 0, deltaY = 0 }) {
  return Math.abs(deltaY) > Math.abs(deltaX) * WHEEL_ZOOM_DOMINANCE_RATIO;
}

export function getExpandedChartWidth({ containerWidth, itemCount, zoom }) {
  const safeContainerWidth = Math.max(320, containerWidth || 0);
  const safeItemCount = Math.max(1, itemCount || 0);
  const safeZoom = clampZoom(zoom);
  const denseWidth = safeItemCount * MIN_BAR_SLOT * safeZoom;
  return Math.ceil(Math.max(safeContainerWidth, safeContainerWidth * safeZoom, denseWidth));
}

export function applyWheelZoom({
  zoom,
  deltaY,
  viewportWidth,
  contentWidth,
  scrollLeft,
  pointerX,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM
}) {
  const nextZoom = clampZoom(zoom * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY), minZoom, maxZoom);
  const nextContentWidth = getExpandedChartWidth({
    containerWidth: viewportWidth,
    itemCount: Math.max(1, contentWidth / MIN_BAR_SLOT),
    zoom: nextZoom
  });
  const anchorRatio = contentWidth > 0 ? (scrollLeft + pointerX) / contentWidth : 0;
  const nextScrollLeft = clampScrollLeft(anchorRatio * nextContentWidth - pointerX, nextContentWidth, viewportWidth);

  return {
    zoom: nextZoom,
    contentWidth: nextContentWidth,
    scrollLeft: nextScrollLeft
  };
}

export function clampScrollLeft(scrollLeft, contentWidth, viewportWidth) {
  const maxScrollLeft = Math.max(0, contentWidth - viewportWidth);
  return Math.min(maxScrollLeft, Math.max(0, scrollLeft));
}

export function getVisibleIndexRange({
  scrollLeft,
  viewportWidth,
  plotOffset = 0,
  plotWidth,
  itemCount,
  overscan = 2
}) {
  const safeItemCount = Math.max(0, itemCount || 0);
  if (!safeItemCount || !plotWidth || plotWidth <= 0) return { start: 0, end: safeItemCount };

  const visibleStart = Math.max(0, scrollLeft - plotOffset);
  const visibleEnd = Math.max(visibleStart, scrollLeft + viewportWidth - plotOffset);
  const rawStart = Math.floor((visibleStart / plotWidth) * safeItemCount);
  const rawEnd = Math.ceil((visibleEnd / plotWidth) * safeItemCount);

  const start = Math.min(safeItemCount - 1, Math.max(0, rawStart - overscan));

  return {
    start,
    end: Math.min(safeItemCount, Math.max(start + 1, rawEnd + overscan))
  };
}

export function getDynamicMarketCapDomain(companies, visibleRange, padding = 1.12) {
  const start = Math.max(0, visibleRange?.start ?? 0);
  const end = Math.max(start + 1, visibleRange?.end ?? companies.length);
  const visibleCompanies = companies.slice(start, end);
  const maxAbs = Math.max(
    1,
    ...visibleCompanies.map((company) => Math.abs(company.marketCapChange || 0))
  );

  return [-maxAbs * padding, maxAbs * padding];
}

export function getTickerLabelStride({ itemCount, zoom }) {
  const safeItemCount = Math.max(1, itemCount || 0);
  const safeZoom = clampZoom(zoom);
  return Math.max(1, Math.ceil(safeItemCount / (28 * safeZoom)));
}
