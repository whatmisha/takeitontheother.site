// Region membership follows the generator's sovereign-country IDs.
export const PLANET_REGIONS = {
  us: { label: 'US', longitude: -98, latitude: 39, countries: ['USA'] },
  uk: { label: 'UK', longitude: -2, latitude: 54, countries: ['GBR'] },
  eu: {
    label: 'EU', longitude: 15, latitude: 50,
    // https://european-union.europa.eu/principles-countries-history/eu-countries_en
    countries: ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN',
      'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT',
      'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE']
  }
};
export const REGION_IDS = Object.keys(PLANET_REGIONS);
