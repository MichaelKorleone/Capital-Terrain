import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumberCompact,
  formatPercent
} from "../utils/formatters.js";
import {
  applyWheelZoom,
  getDynamicMarketCapDomain,
  getExpandedChartWidth,
  getTickerLabelStride,
  getVisibleIndexRange,
  shouldZoomFromWheel
} from "../utils/chartViewport.js";

const h = React.createElement;

export function MarketCapChart({ companies, highlightedTicker = "" }) {
  const containerRef = useRef(null);
  const scrollerRef = useRef(null);
  const dragRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [size, setSize] = useState({ width: 1000, height: 560 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [viewport, setViewport] = useState({ scrollLeft: 0, width: 1000 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width);
      const height = Math.max(440, Math.min(680, width * 0.58));
      setSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    syncViewport();
  }, [size.width]);

  const margin = { top: 22, right: 28, bottom: 86, left: 84 };
  const svgWidth = getExpandedChartWidth({
    containerWidth: size.width,
    itemCount: companies.length,
    zoom
  });
  const innerWidth = Math.max(1, svgWidth - margin.left - margin.right);
  const innerHeight = Math.max(1, size.height - margin.top - margin.bottom);
  const visibleRange = useMemo(
    () =>
      getVisibleIndexRange({
        scrollLeft: viewport.scrollLeft,
        viewportWidth: viewport.width,
        plotOffset: margin.left,
        plotWidth: innerWidth,
        itemCount: companies.length
      }),
    [companies.length, innerWidth, margin.left, viewport.scrollLeft, viewport.width]
  );
  const domain = useMemo(() => getDynamicMarketCapDomain(companies, visibleRange), [companies, visibleRange]);

  const xScale = d3
    .scaleBand()
    .domain(companies.map((company) => company.ticker))
    .range([0, innerWidth])
    .paddingInner(companies.length > 180 ? 0.08 : 0.18)
    .paddingOuter(0.02);

  const yScale = d3.scaleLinear().domain(domain).range([innerHeight, 0]).nice();
  const zeroY = yScale(0);
  const ticks = yScale.ticks(6);
  const labelStride = getTickerLabelStride({ itemCount: companies.length, zoom });

  function syncViewport() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setViewport({
      scrollLeft: scroller.scrollLeft,
      width: scroller.clientWidth || size.width
    });
  }

  function handleWheel(event) {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (!shouldZoomFromWheel({ deltaX: event.deltaX, deltaY: event.deltaY })) {
      scroller.scrollLeft += event.deltaX;
      syncViewport();
      return;
    }

    event.preventDefault();
    const rect = scroller.getBoundingClientRect();
    const result = applyWheelZoom({
      zoom,
      deltaY: event.deltaY,
      viewportWidth: scroller.clientWidth,
      contentWidth: svgWidth,
      scrollLeft: scroller.scrollLeft,
      pointerX: event.clientX - rect.left
    });

    setZoom(result.zoom);
    window.requestAnimationFrame(() => {
      if (scrollerRef.current) {
        scrollerRef.current.scrollLeft = result.scrollLeft;
        syncViewport();
      }
    });
  }

  function handlePointerDown(event) {
    if (event.button !== 0 || !scrollerRef.current) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scrollerRef.current.scrollLeft
    };
    setIsDragging(true);
    setTooltip(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current || !scrollerRef.current) return;
    const deltaX = event.clientX - dragRef.current.startX;
    scrollerRef.current.scrollLeft = dragRef.current.startScrollLeft - deltaX;
    syncViewport();
  }

  function endDrag(event) {
    if (!dragRef.current) return;
    if (event.currentTarget.hasPointerCapture?.(dragRef.current.pointerId)) {
      event.currentTarget.releasePointerCapture(dragRef.current.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  function resetZoom() {
    setZoom(1);
    window.requestAnimationFrame(() => {
      if (scrollerRef.current) {
        scrollerRef.current.scrollLeft = 0;
        syncViewport();
      }
    });
  }

  return h(
    "section",
    { className: "chart-panel" },
    h(
      "div",
      { className: "chart-header" },
      h(
        "div",
        null,
        h("h2", null, "Daily market capitalization change"),
        h(
          "p",
          null,
          "Formula: current market cap minus period-start market cap. Values are sorted and filtered using the controls above."
        )
      ),
      h(
        "div",
        { className: "legend" },
        h("span", { className: "legend-item positive" }, "Positive repricing"),
        h("span", { className: "legend-item negative" }, "Negative repricing"),
        h("span", { className: "chart-zoom-readout" }, `Zoom ${zoom.toFixed(1)}x`),
        h("button", { className: "chart-reset-button", type: "button", onClick: resetZoom }, "Reset")
      )
    ),
    h(
      "div",
      { className: "chart-wrap", ref: containerRef },
      h(
        "svg",
        {
          className: "chart-y-axis-overlay",
          width: margin.left,
          height: size.height,
          "aria-hidden": "true"
        },
        h(
          "g",
          { transform: `translate(0,${margin.top})` },
          ticks.map((tick) =>
            h(
              "text",
              {
                key: tick,
                x: margin.left - 12,
                y: yScale(tick) + 4,
                textAnchor: "end"
              },
              formatCurrencyCompact(tick)
            )
          ),
          h("line", {
            className: "zero-line",
            x1: margin.left - 18,
            x2: margin.left,
            y1: zeroY,
            y2: zeroY
          })
        )
      ),
      h(
        "div",
        {
          className: `chart-scroll-window${isDragging ? " dragging" : ""}`,
          ref: scrollerRef,
          onScroll: syncViewport,
          onWheel: handleWheel,
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onPointerLeave: endDrag
        },
        h(
          "svg",
          {
            width: svgWidth,
            height: size.height,
            role: "img",
            "aria-label": "Bar chart of daily market capitalization repricing by S&P 500 company"
          },
          h(
            "g",
            { transform: `translate(${margin.left},${margin.top})` },
            h(
              "g",
              { className: "grid-lines" },
              ticks.map((tick) =>
                h("line", {
                  key: tick,
                  x1: 0,
                  x2: innerWidth,
                  y1: yScale(tick),
                  y2: yScale(tick)
                })
              )
            ),
            h("line", {
              className: "zero-line",
              x1: 0,
              x2: innerWidth,
              y1: zeroY,
              y2: zeroY
            }),
            h(
              "g",
              { className: "bars" },
              companies.map((company) => {
                const x = xScale(company.ticker) || 0;
                const y = company.marketCapChange >= 0 ? yScale(company.marketCapChange) : zeroY;
                const height = Math.abs(yScale(company.marketCapChange) - zeroY);
                const barWidth = Math.max(0.45, xScale.bandwidth());
                const isHighlighted = highlightedTicker === company.ticker;
                const isDimmed = highlightedTicker && !isHighlighted;

                return h("rect", {
                  key: company.ticker,
                  className: [
                    "bar",
                    company.marketCapChange >= 0 ? "positive" : "negative",
                    isHighlighted ? "highlighted" : "",
                    isDimmed ? "dimmed" : ""
                  ].filter(Boolean).join(" "),
                  x,
                  y,
                  width: barWidth,
                  height: Math.max(1, height),
                  rx: Math.min(3, barWidth / 2),
                  onMouseEnter: (event) => setTooltip(buildTooltip(company, event)),
                  onMouseMove: (event) => setTooltip(buildTooltip(company, event)),
                  onMouseLeave: () => setTooltip(null)
                });
              })
            ),
            h(
              "g",
              { className: "x-axis-labels" },
              companies.map((company, index) => {
                if (index % labelStride !== 0) return null;
                return h(
                  "text",
                  {
                    key: company.ticker,
                    x: (xScale(company.ticker) || 0) + xScale.bandwidth() / 2,
                    y: innerHeight + 24,
                    textAnchor: "end",
                    transform: `rotate(-55 ${(xScale(company.ticker) || 0) + xScale.bandwidth() / 2} ${innerHeight + 24})`
                  },
                  company.ticker
                );
              })
            )
          )
        )
      ),
      tooltip &&
        h(
          "div",
          {
            className: "tooltip",
            style: {
              left: tooltip.left,
              top: tooltip.top
            }
          },
          h("strong", null, `${tooltip.company.ticker} - ${tooltip.company.companyName}`),
          h("span", null, tooltip.company.sector),
          h("span", null, `Market cap change: ${formatCurrency(tooltip.company.marketCapChange)}`),
          h("span", null, `Percent change: ${formatPercent(tooltip.company.percentChange)}`),
          h("span", null, `Volume: ${formatNumberCompact(tooltip.company.volume)}`),
          tooltip.company.dataQuality?.apiInceptionDate &&
            h("span", null, `API inception/start date: ${tooltip.company.dataQuality.apiInceptionDate}`)
        )
    )
  );
}

function buildTooltip(company, event) {
  const rect = event.currentTarget.closest(".chart-wrap").getBoundingClientRect();
  return {
    company,
    left: Math.min(event.clientX - rect.left + 16, rect.width - 280),
    top: Math.max(event.clientY - rect.top - 18, 12)
  };
}
