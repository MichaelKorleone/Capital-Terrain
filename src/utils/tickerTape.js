export function buildTickerTapeItems(companies, { timeSpan = "1D", repeat = 2 } = {}) {
  const orderedCompanies = [...companies].sort(
    (a, b) => Math.abs(b.marketCapChange || 0) - Math.abs(a.marketCapChange || 0)
  );
  const repeatCount = Math.max(1, repeat);

  return Array.from({ length: repeatCount }, (_, repeatIndex) =>
    orderedCompanies.map((company) => ({
      key: `${company.ticker}-${repeatIndex}`,
      ticker: company.ticker,
      companyName: company.companyName,
      sector: company.sector,
      marketCapChange: company.marketCapChange,
      percentChange: company.percentChange,
      volume: company.volume,
      ...(company.dataQuality ? { dataQuality: company.dataQuality } : {}),
      timeSpan
    }))
  ).flat();
}

export function getTickerTapeDurationSeconds(companyCount) {
  const readableSeconds = Math.max(1, companyCount || 0) * 1.55;
  return Math.round(Math.min(900, Math.max(90, readableSeconds)));
}
