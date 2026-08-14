import csv
import json
import pathlib
import urllib.request

import pandas as pd


ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
HEADERS = [
    "ticker",
    "googleTicker",
    "companyName",
    "sector",
    "currentPrice",
    "currentMarketCap",
    "volume",
    "price1D",
    "price1W",
    "price1M",
    "price1Q",
    "price1Y",
    "price2Y",
    "price3Y",
    "price5Y",
    "priceLongest",
]


def google_ticker(symbol):
    return str(symbol).strip()


def formula(attribute, ticker_cell):
    return f'=IFERROR(GOOGLEFINANCE({ticker_cell},"{attribute}"),"")'


def historical_formula(ticker_cell, start_expression):
    return (
        f'=IFERROR(INDEX(GOOGLEFINANCE({ticker_cell},"close",'
        f"{start_expression},TODAY()),2,2),\"\")"
    )


def build_rows():
    request = urllib.request.Request(
        WIKI_URL,
        headers={"User-Agent": "Mozilla/5.0 Capital Terrain prototype"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read()

    table = pd.read_html(html)[0]
    rows = []

    for row_number, (_, row) in enumerate(table.iterrows(), start=2):
        ticker_cell = f"B{row_number}"
        rows.append(
            [
                row["Symbol"],
                google_ticker(row["Symbol"]),
                row["Security"],
                row["GICS Sector"],
                formula("price", ticker_cell),
                formula("marketcap", ticker_cell),
                formula("volume", ticker_cell),
                historical_formula(ticker_cell, "WORKDAY(TODAY(),-1)"),
                historical_formula(ticker_cell, "WORKDAY(TODAY(),-5)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-1)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-3)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-12)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-24)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-36)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-60)"),
                historical_formula(ticker_cell, "DATE(1970,1,1)"),
            ]
        )

    return rows


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(HEADERS)
        writer.writerows(rows)


def write_sector_map(path, table):
    path.parent.mkdir(parents=True, exist_ok=True)
    sector_map = {
        row["Symbol"]: row["GICS Sector"]
        for _, row in table.iterrows()
    }
    path.write_text(json.dumps(sector_map, indent=2, sort_keys=True), encoding="utf-8")


def main():
    request = urllib.request.Request(
        WIKI_URL,
        headers={"User-Agent": "Mozilla/5.0 Capital Terrain prototype"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read()
    table = pd.read_html(html)[0]
    rows = []
    for row_number, (_, row) in enumerate(table.iterrows(), start=2):
        ticker_cell = f"B{row_number}"
        rows.append(
            [
                row["Symbol"],
                google_ticker(row["Symbol"]),
                row["Security"],
                row["GICS Sector"],
                formula("price", ticker_cell),
                formula("marketcap", ticker_cell),
                formula("volume", ticker_cell),
                historical_formula(ticker_cell, "WORKDAY(TODAY(),-1)"),
                historical_formula(ticker_cell, "WORKDAY(TODAY(),-5)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-1)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-3)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-12)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-24)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-36)"),
                historical_formula(ticker_cell, "EDATE(TODAY(),-60)"),
                historical_formula(ticker_cell, "DATE(1970,1,1)"),
            ]
        )

    for target in [
        ROOT / "templates" / "capital-terrain-googlefinance-template.csv",
        PROJECT_ROOT / "outputs" / "capital-terrain" / "templates" / "capital-terrain-googlefinance-template.csv",
    ]:
        write_csv(target, rows)
        print(f"{target}: {len(rows)} rows")
    for target in [
        ROOT / "templates" / "sp500-sector-map.json",
        PROJECT_ROOT / "outputs" / "capital-terrain" / "templates" / "sp500-sector-map.json",
    ]:
        write_sector_map(target, table)
        print(f"{target}: {len(table)} symbols")


if __name__ == "__main__":
    main()
