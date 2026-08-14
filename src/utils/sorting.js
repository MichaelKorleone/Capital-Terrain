export function sortCompanies(companies, sortMode) {
  const copy = [...companies];

  if (sortMode === "sector") {
    return copy.sort(
      (a, b) =>
        a.sector.localeCompare(b.sector) ||
        Math.abs(b.marketCapChange) - Math.abs(a.marketCapChange)
    );
  }

  if (sortMode === "volume") {
    return copy.sort((a, b) => b.volume - a.volume);
  }

  return copy.sort((a, b) => Math.abs(b.marketCapChange) - Math.abs(a.marketCapChange));
}
