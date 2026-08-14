import React from "react";

const h = React.createElement;

const sortOptions = [
  { value: "absolute", label: "Largest gain/loss" },
  { value: "sector", label: "Sector" },
  { value: "volume", label: "Volume" }
];

export function DashboardControls({
  sector,
  sectors,
  sortMode,
  timeSpan,
  timeSpans,
  onSectorChange,
  onSortModeChange,
  onTimeSpanChange
}) {
  return h(
    "section",
    { className: "controls", "aria-label": "Chart controls" },
    h(
      "div",
      { className: "control-group" },
      h("span", null, "Time span"),
      h(
        "div",
        { className: "segmented time-span", role: "group", "aria-label": "Time span" },
        timeSpans.map((option) =>
          h(
            "button",
            {
              key: option.value,
              type: "button",
              className: option.value === timeSpan ? "active" : "",
              onClick: () => onTimeSpanChange(option.value)
            },
            option.label
          )
        )
      )
    ),
    h(
      "label",
      { className: "field" },
      h("span", null, "Sector"),
      h(
        "select",
        {
          value: sector,
          onChange: (event) => onSectorChange(event.target.value)
        },
        sectors.map((sectorName) =>
          h("option", { key: sectorName, value: sectorName }, sectorName)
        )
      )
    ),
    h(
      "div",
      { className: "segmented", role: "group", "aria-label": "Sort mode" },
      sortOptions.map((option) =>
        h(
          "button",
          {
            key: option.value,
            type: "button",
            className: option.value === sortMode ? "active" : "",
            onClick: () => onSortModeChange(option.value)
          },
          option.label
        )
      )
    )
  );
}
