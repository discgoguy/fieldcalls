// ISO 3166-1 alpha-3 country code → continent, backing the CRM map's continent
// filter (company.country / lead.customer_country are stored as alpha-3). Grouped
// by continent for readability; a flat lookup is derived below. Central America
// and the Caribbean fold into North America; Russia/Cyprus per common convention.

export const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const;

export type Continent = (typeof CONTINENTS)[number];

const BY_CONTINENT: Record<Continent, string[]> = {
  'North America': [
    'CAN', 'USA', 'MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN',
    'CUB', 'DOM', 'HTI', 'JAM', 'BHS', 'BRB', 'TTO', 'GRD', 'LCA', 'VCT',
    'ATG', 'DMA', 'KNA', 'PRI', 'GRL', 'BMU',
  ],
  'South America': [
    'ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR',
    'URY', 'VEN', 'GUF', 'FLK',
  ],
  Europe: [
    'ALB', 'AND', 'AUT', 'BLR', 'BEL', 'BIH', 'BGR', 'HRV', 'CZE', 'DNK',
    'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ITA', 'LVA',
    'LIE', 'LTU', 'LUX', 'MLT', 'MDA', 'MCO', 'MNE', 'NLD', 'MKD', 'NOR',
    'POL', 'PRT', 'ROU', 'RUS', 'SMR', 'SRB', 'SVK', 'SVN', 'ESP', 'SWE',
    'CHE', 'UKR', 'GBR', 'VAT', 'GIB', 'IMN', 'FRO', 'JEY', 'GGY',
  ],
  Asia: [
    'AFG', 'ARM', 'AZE', 'BHR', 'BGD', 'BTN', 'BRN', 'KHM', 'CHN', 'CYP',
    'GEO', 'IND', 'IDN', 'IRN', 'IRQ', 'ISR', 'JPN', 'JOR', 'KAZ', 'KWT',
    'KGZ', 'LAO', 'LBN', 'MYS', 'MDV', 'MNG', 'MMR', 'NPL', 'PRK', 'OMN',
    'PAK', 'PSE', 'PHL', 'QAT', 'SAU', 'SGP', 'KOR', 'LKA', 'SYR', 'TWN',
    'TJK', 'THA', 'TLS', 'TUR', 'TKM', 'ARE', 'UZB', 'VNM', 'YEM', 'HKG',
    'MAC',
  ],
  Africa: [
    'DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CPV', 'CMR', 'CAF', 'TCD',
    'COM', 'COG', 'COD', 'CIV', 'DJI', 'EGY', 'GNQ', 'ERI', 'SWZ', 'ETH',
    'GAB', 'GMB', 'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY', 'MDG',
    'MWI', 'MLI', 'MRT', 'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA',
    'STP', 'SEN', 'SYC', 'SLE', 'SOM', 'ZAF', 'SSD', 'SDN', 'TZA', 'TGO',
    'TUN', 'UGA', 'ZMB', 'ZWE', 'ESH',
  ],
  Oceania: [
    'AUS', 'NZL', 'FJI', 'PNG', 'SLB', 'VUT', 'NCL', 'PYF', 'WSM', 'TON',
    'KIR', 'FSM', 'MHL', 'PLW', 'NRU', 'TUV', 'GUM', 'ASM', 'COK', 'NIU',
  ],
};

const CONTINENT_BY_A3: Record<string, Continent> = {};
for (const continent of CONTINENTS) {
  for (const code of BY_CONTINENT[continent]) CONTINENT_BY_A3[code] = continent;
}

/** Continent for an ISO alpha-3 country code; null for unknown/empty input. */
export function continentForCountry(code: string | null | undefined): Continent | null {
  if (!code) return null;
  return CONTINENT_BY_A3[code.trim().toUpperCase()] ?? null;
}
