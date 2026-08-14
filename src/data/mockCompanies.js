export const SECTOR_ORDER = [
  "Information Technology",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Communication Services",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials"
];

const companySeeds = [
  ["AAPL", "Apple Inc.", "Information Technology", 3160],
  ["MSFT", "Microsoft Corporation", "Information Technology", 3040],
  ["NVDA", "NVIDIA Corporation", "Information Technology", 2860],
  ["AMZN", "Amazon.com Inc.", "Consumer Discretionary", 1940],
  ["GOOGL", "Alphabet Inc. Class A", "Communication Services", 1840],
  ["META", "Meta Platforms Inc.", "Communication Services", 1260],
  ["BRK.B", "Berkshire Hathaway Inc.", "Financials", 890],
  ["LLY", "Eli Lilly and Company", "Health Care", 780],
  ["AVGO", "Broadcom Inc.", "Information Technology", 720],
  ["JPM", "JPMorgan Chase & Co.", "Financials", 610],
  ["TSLA", "Tesla Inc.", "Consumer Discretionary", 580],
  ["XOM", "Exxon Mobil Corporation", "Energy", 520],
  ["UNH", "UnitedHealth Group Incorporated", "Health Care", 500],
  ["V", "Visa Inc.", "Financials", 480],
  ["MA", "Mastercard Incorporated", "Financials", 430],
  ["PG", "Procter & Gamble Company", "Consumer Staples", 390],
  ["JNJ", "Johnson & Johnson", "Health Care", 375],
  ["COST", "Costco Wholesale Corporation", "Consumer Staples", 360],
  ["HD", "Home Depot Inc.", "Consumer Discretionary", 340],
  ["MRK", "Merck & Co. Inc.", "Health Care", 325],
  ["ABBV", "AbbVie Inc.", "Health Care", 320],
  ["WMT", "Walmart Inc.", "Consumer Staples", 315],
  ["BAC", "Bank of America Corporation", "Financials", 300],
  ["NFLX", "Netflix Inc.", "Communication Services", 295],
  ["CRM", "Salesforce Inc.", "Information Technology", 275],
  ["KO", "Coca-Cola Company", "Consumer Staples", 268],
  ["AMD", "Advanced Micro Devices Inc.", "Information Technology", 260],
  ["PEP", "PepsiCo Inc.", "Consumer Staples", 250],
  ["ADBE", "Adobe Inc.", "Information Technology", 246],
  ["ORCL", "Oracle Corporation", "Information Technology", 240],
  ["CSCO", "Cisco Systems Inc.", "Information Technology", 238],
  ["WFC", "Wells Fargo & Company", "Financials", 232],
  ["ACN", "Accenture plc", "Information Technology", 226],
  ["LIN", "Linde plc", "Materials", 220],
  ["MCD", "McDonald's Corporation", "Consumer Discretionary", 214],
  ["TMO", "Thermo Fisher Scientific Inc.", "Health Care", 208],
  ["ABT", "Abbott Laboratories", "Health Care", 204],
  ["DIS", "Walt Disney Company", "Communication Services", 200],
  ["INTU", "Intuit Inc.", "Information Technology", 196],
  ["QCOM", "QUALCOMM Incorporated", "Information Technology", 192],
  ["TXN", "Texas Instruments Incorporated", "Information Technology", 188],
  ["VZ", "Verizon Communications Inc.", "Communication Services", 184],
  ["AMGN", "Amgen Inc.", "Health Care", 180],
  ["DHR", "Danaher Corporation", "Health Care", 176],
  ["NEE", "NextEra Energy Inc.", "Utilities", 172],
  ["PFE", "Pfizer Inc.", "Health Care", 168],
  ["PM", "Philip Morris International Inc.", "Consumer Staples", 164],
  ["IBM", "International Business Machines Corporation", "Information Technology", 160],
  ["GE", "GE Aerospace", "Industrials", 156],
  ["CAT", "Caterpillar Inc.", "Industrials", 152],
  ["GS", "Goldman Sachs Group Inc.", "Financials", 148],
  ["RTX", "RTX Corporation", "Industrials", 144],
  ["NOW", "ServiceNow Inc.", "Information Technology", 140],
  ["ISRG", "Intuitive Surgical Inc.", "Health Care", 136],
  ["UBER", "Uber Technologies Inc.", "Industrials", 132],
  ["SPGI", "S&P Global Inc.", "Financials", 128],
  ["LOW", "Lowe's Companies Inc.", "Consumer Discretionary", 124],
  ["BKNG", "Booking Holdings Inc.", "Consumer Discretionary", 120],
  ["AMAT", "Applied Materials Inc.", "Information Technology", 118],
  ["HON", "Honeywell International Inc.", "Industrials", 116],
  ["UNP", "Union Pacific Corporation", "Industrials", 114],
  ["COP", "ConocoPhillips", "Energy", 112],
  ["AXP", "American Express Company", "Financials", 110],
  ["T", "AT&T Inc.", "Communication Services", 108],
  ["LMT", "Lockheed Martin Corporation", "Industrials", 106],
  ["ELV", "Elevance Health Inc.", "Health Care", 104],
  ["TJX", "TJX Companies Inc.", "Consumer Discretionary", 102],
  ["SYK", "Stryker Corporation", "Health Care", 100],
  ["VRTX", "Vertex Pharmaceuticals Inc.", "Health Care", 98],
  ["PANW", "Palo Alto Networks Inc.", "Information Technology", 96],
  ["BLK", "BlackRock Inc.", "Financials", 94],
  ["DE", "Deere & Company", "Industrials", 92],
  ["MDT", "Medtronic plc", "Health Care", 90],
  ["SBUX", "Starbucks Corporation", "Consumer Discretionary", 88],
  ["ADI", "Analog Devices Inc.", "Information Technology", 86],
  ["PLD", "Prologis Inc.", "Real Estate", 84],
  ["CB", "Chubb Limited", "Financials", 82],
  ["MMC", "Marsh & McLennan Companies Inc.", "Financials", 80],
  ["BMY", "Bristol-Myers Squibb Company", "Health Care", 78],
  ["GILD", "Gilead Sciences Inc.", "Health Care", 76],
  ["REGN", "Regeneron Pharmaceuticals Inc.", "Health Care", 74],
  ["ADP", "Automatic Data Processing Inc.", "Industrials", 72],
  ["CI", "Cigna Group", "Health Care", 70],
  ["MU", "Micron Technology Inc.", "Information Technology", 68],
  ["SO", "Southern Company", "Utilities", 66],
  ["SCHW", "Charles Schwab Corporation", "Financials", 64],
  ["UPS", "United Parcel Service Inc.", "Industrials", 62],
  ["BSX", "Boston Scientific Corporation", "Health Care", 60],
  ["ZTS", "Zoetis Inc.", "Health Care", 58],
  ["C", "Citigroup Inc.", "Financials", 56],
  ["ETN", "Eaton Corporation plc", "Industrials", 54],
  ["KLAC", "KLA Corporation", "Information Technology", 52],
  ["PGR", "Progressive Corporation", "Financials", 50],
  ["DUK", "Duke Energy Corporation", "Utilities", 48],
  ["NKE", "Nike Inc.", "Consumer Discretionary", 46],
  ["BA", "Boeing Company", "Industrials", 44],
  ["MDLZ", "Mondelez International Inc.", "Consumer Staples", 42],
  ["ICE", "Intercontinental Exchange Inc.", "Financials", 40],
  ["EQIX", "Equinix Inc.", "Real Estate", 38],
  ["SHW", "Sherwin-Williams Company", "Materials", 36],
  ["APD", "Air Products and Chemicals Inc.", "Materials", 34],
  ["CL", "Colgate-Palmolive Company", "Consumer Staples", 32],
  ["ITW", "Illinois Tool Works Inc.", "Industrials", 30],
  ["WM", "Waste Management Inc.", "Industrials", 29],
  ["HCA", "HCA Healthcare Inc.", "Health Care", 28],
  ["MCO", "Moody's Corporation", "Financials", 27],
  ["AON", "Aon plc", "Financials", 26],
  ["EOG", "EOG Resources Inc.", "Energy", 25],
  ["SLB", "Schlumberger Limited", "Energy", 24],
  ["FDX", "FedEx Corporation", "Industrials", 23],
  ["MAR", "Marriott International Inc.", "Consumer Discretionary", 22],
  ["CDNS", "Cadence Design Systems Inc.", "Information Technology", 21],
  ["SNPS", "Synopsys Inc.", "Information Technology", 20],
  ["ORLY", "O'Reilly Automotive Inc.", "Consumer Discretionary", 19],
  ["GD", "General Dynamics Corporation", "Industrials", 18],
  ["CME", "CME Group Inc.", "Financials", 17],
  ["PSA", "Public Storage", "Real Estate", 16],
  ["AEP", "American Electric Power Company Inc.", "Utilities", 15],
  ["MPC", "Marathon Petroleum Corporation", "Energy", 14],
  ["TGT", "Target Corporation", "Consumer Staples", 13],
  ["FCX", "Freeport-McMoRan Inc.", "Materials", 12],
  ["NEM", "Newmont Corporation", "Materials", 11]
];

const sectorTargets = {
  "Information Technology": 72,
  "Health Care": 62,
  Financials: 68,
  "Consumer Discretionary": 54,
  "Communication Services": 28,
  Industrials: 70,
  "Consumer Staples": 35,
  Energy: 24,
  Utilities: 30,
  "Real Estate": 31,
  Materials: 26
};

const sectorTickerPrefixes = {
  "Information Technology": "TCH",
  "Health Care": "HLT",
  Financials: "FIN",
  "Consumer Discretionary": "CYC",
  "Communication Services": "COM",
  Industrials: "IND",
  "Consumer Staples": "STP",
  Energy: "ENR",
  Utilities: "UTL",
  "Real Estate": "RE",
  Materials: "MAT"
};

const sectorNameParts = {
  "Information Technology": ["Cloud", "Silicon", "Data", "Cyber", "Platform", "Systems"],
  "Health Care": ["Bio", "Therapeutics", "Diagnostics", "MedTech", "Care", "Labs"],
  Financials: ["Trust", "Capital", "Markets", "Bancorp", "Holdings", "Exchange"],
  "Consumer Discretionary": ["Retail", "Motors", "Travel", "Apparel", "Leisure", "Marketplace"],
  "Communication Services": ["Media", "Networks", "Streaming", "Telecom", "Content", "Connect"],
  Industrials: ["Aerospace", "Logistics", "Automation", "Machinery", "Rail", "Engineering"],
  "Consumer Staples": ["Foods", "Household", "Beverage", "Grocery", "Nutrition", "Essentials"],
  Energy: ["Resources", "Midstream", "Drilling", "Petroleum", "Solar", "Power"],
  Utilities: ["Electric", "Grid", "Water", "Gas", "Renewables", "Infrastructure"],
  "Real Estate": ["Properties", "Storage", "Towers", "Logistics REIT", "Residential", "Centers"],
  Materials: ["Chemicals", "Metals", "Packaging", "Aggregates", "Mining", "Coatings"]
};

function generateSyntheticSeeds(targetCount) {
  const existingBySector = companySeeds.reduce((counts, [, , sector]) => {
    counts[sector] = (counts[sector] || 0) + 1;
    return counts;
  }, {});

  const generated = [];

  for (const sector of SECTOR_ORDER) {
    const needed = Math.max(0, sectorTargets[sector] - (existingBySector[sector] || 0));
    const prefix = sectorTickerPrefixes[sector];
    const parts = sectorNameParts[sector];

    for (let index = 0; index < needed && generated.length < targetCount; index += 1) {
      const ticker = `${prefix}${String(index + 1).padStart(2, "0")}`;
      const companyName = `${parts[index % parts.length]} ${sector.split(" ")[0]} ${index + 1} Corp.`;
      const sizeCurve = 9 + ((index * 17 + sector.length * 3) % 44);
      const previousMarketCapBillions = Number((sizeCurve * (1 - index / (needed + 90))).toFixed(2));
      generated.push([ticker, companyName, sector, Math.max(4.2, previousMarketCapBillions)]);
    }
  }

  return generated;
}

const allCompanySeeds = [...companySeeds, ...generateSyntheticSeeds(500 - companySeeds.length)];

export const MOCK_SP500_COMPANIES = allCompanySeeds.map(
  ([ticker, companyName, sector, previousMarketCapBillions], index) => {
    const previousMarketCap = previousMarketCapBillions * 1_000_000_000;
    const sign = index % 5 === 0 || index % 7 === 0 ? -1 : 1;
    const magnitude = 0.18 + ((index * 37) % 390) / 100;
    const percentChange = Number((sign * magnitude).toFixed(2));
    const currentMarketCap = Math.round(previousMarketCap * (1 + percentChange / 100));
    const volume = Math.round((12_000_000 + ((index * 9_713_411) % 94_000_000)) * (index < 18 ? 1.7 : 1));

    return {
      ticker,
      companyName,
      sector,
      previousMarketCap,
      currentMarketCap,
      marketCapChange: currentMarketCap - previousMarketCap,
      percentChange,
      volume
    };
  }
);
