import { SECTOR_ORDER } from "../data/mockCompanies.js";

export function buildSectorTerrainGroups(companies) {
  return SECTOR_ORDER.map((sector, sectorIndex) => {
    const sectorCompanies = companies.filter((company) => company.sector === sector);
    const columns = Math.ceil(Math.sqrt(sectorCompanies.length || 1));

    return {
      sector,
      sectorIndex,
      columns,
      rows: Math.ceil((sectorCompanies.length || 1) / columns),
      companyCount: sectorCompanies.length,
      totalPreviousMarketCap: sectorCompanies.reduce(
        (sum, company) => sum + company.previousMarketCap,
        0
      ),
      totalCurrentMarketCap: sectorCompanies.reduce((sum, company) => sum + company.currentMarketCap, 0),
      netMarketCapChange: sectorCompanies.reduce((sum, company) => sum + company.marketCapChange, 0),
      companies: sectorCompanies.map((company, localIndex) => ({
        ...company,
        terrainCell: {
          sectorIndex,
          localIndex,
          x: localIndex % columns,
          z: Math.floor(localIndex / columns)
        }
      }))
    };
  });
}
