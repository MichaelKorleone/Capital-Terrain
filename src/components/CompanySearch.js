import React from "react";
import {
  formatCurrencyCompact,
  formatPercent
} from "../utils/formatters.js";

const h = React.createElement;

export function CompanySearch({
  query,
  suggestions,
  highlightedTicker,
  searchId = "company-search",
  onQueryChange,
  onSelectCompany,
  onClear
}) {
  return h(
    "section",
    { className: "company-search-panel" },
    h(
      "div",
      { className: "company-search-field" },
      h("label", { htmlFor: searchId }, "Find company"),
      h("input", {
        id: searchId,
        type: "search",
        value: query,
        placeholder: "Search ticker or company name",
        autoComplete: "off",
        onChange: (event) => onQueryChange(event.target.value)
      }),
      query &&
        h(
          "button",
          { type: "button", className: "search-clear", onClick: onClear },
          "Clear"
        )
    ),
    query &&
      h(
        "div",
        { className: "company-suggestion-list", role: "listbox" },
        suggestions.length
          ? suggestions.map((company) =>
              h(
                "button",
                {
                  key: company.ticker,
                  type: "button",
                  role: "option",
                  "aria-selected": highlightedTicker === company.ticker,
                  className: highlightedTicker === company.ticker ? "active" : "",
                  onClick: () => onSelectCompany(company)
                },
                h("strong", null, company.ticker),
                h("span", null, company.companyName),
                h(
                  "small",
                  null,
                  `${formatCurrencyCompact(company.marketCapChange)} / ${formatPercent(company.percentChange)}`
                )
              )
            )
          : h("p", null, "No matching companies in the current dataset.")
      )
  );
}
