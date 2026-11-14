/**
 * Coarse market context: the field crops that are widely grown and traded in
 * a country (ordered roughly by harvested area, from general FAOSTAT
 * knowledge). Used only to estimate "market fit"; it is not price data and
 * must be checked with local buyers.
 */

export const COUNTRY_CROPS: Record<string, string[]> = {
  jp: ["rice", "wheat", "soybean", "barley", "buckwheat", "potato", "sugarbeet", "sweetpotato"],
  kr: ["rice", "soybean", "barley", "maize", "sweetpotato", "potato"],
  cn: ["maize", "rice", "wheat", "soybean", "rapeseed", "potato", "peanut", "cotton", "sweetpotato"],
  tw: ["rice", "maize", "soybean", "sweetpotato", "peanut"],
  in: ["rice", "wheat", "cotton", "soybean", "chickpea", "millet", "maize", "sorghum", "peanut", "rapeseed", "lentil"],
  pk: ["wheat", "rice", "cotton", "maize", "chickpea", "sorghum"],
  bd: ["rice", "wheat", "maize", "potato", "lentil", "rapeseed"],
  np: ["rice", "maize", "wheat", "millet", "lentil", "potato"],
  lk: ["rice", "maize", "cowpea", "peanut"],
  th: ["rice", "cassava", "maize", "soybean", "peanut"],
  vn: ["rice", "maize", "cassava", "sweetpotato", "soybean", "peanut"],
  kh: ["rice", "cassava", "maize", "soybean"],
  la: ["rice", "maize", "cassava"],
  mm: ["rice", "bean", "peanut", "maize", "chickpea", "sesame"],
  ph: ["rice", "maize", "cassava", "sweetpotato", "peanut"],
  id: ["rice", "maize", "cassava", "soybean", "peanut", "sweetpotato"],
  my: ["rice", "cassava", "sweetpotato", "maize"],
  us: ["maize", "soybean", "wheat", "cotton", "alfalfa", "sorghum", "barley", "sunflower", "rice", "peanut", "sugarbeet", "oats"],
  ca: ["wheat", "rapeseed", "barley", "soybean", "maize", "oats", "pea", "lentil", "alfalfa"],
  mx: ["maize", "sorghum", "bean", "wheat", "alfalfa", "soybean", "cotton"],
  gt: ["maize", "bean", "sorghum"],
  hn: ["maize", "bean", "sorghum"],
  cu: ["rice", "maize", "bean", "cassava", "sweetpotato"],
  br: ["soybean", "maize", "cotton", "bean", "rice", "wheat", "cassava", "sorghum", "peanut"],
  ar: ["soybean", "maize", "wheat", "sunflower", "barley", "sorghum", "peanut"],
  uy: ["soybean", "rice", "wheat", "maize", "barley", "sorghum"],
  py: ["soybean", "maize", "wheat", "rice", "cassava"],
  bo: ["soybean", "maize", "wheat", "sorghum", "potato", "rice"],
  co: ["rice", "maize", "potato", "cassava", "bean"],
  ve: ["maize", "rice", "sorghum", "cassava"],
  pe: ["potato", "rice", "maize", "barley", "bean"],
  ec: ["rice", "maize", "potato", "bean"],
  cl: ["wheat", "maize", "oats", "potato", "barley", "rapeseed"],
  ro: ["maize", "wheat", "sunflower", "barley", "rapeseed", "soybean", "potato", "oats"],
  md: ["wheat", "maize", "sunflower", "barley", "rapeseed", "soybean"],
  ua: ["wheat", "maize", "sunflower", "barley", "soybean", "rapeseed", "potato"],
  ru: ["wheat", "barley", "sunflower", "maize", "oats", "soybean", "rapeseed", "potato", "rye"],
  by: ["wheat", "barley", "rye", "rapeseed", "maize", "potato", "oats"],
  kz: ["wheat", "barley", "sunflower", "rapeseed", "oats", "potato"],
  uz: ["cotton", "wheat", "rice", "maize", "potato"],
  fr: ["wheat", "maize", "barley", "rapeseed", "sunflower", "sugarbeet", "potato", "pea", "faba"],
  de: ["wheat", "barley", "rapeseed", "maize", "rye", "sugarbeet", "potato", "oats"],
  pl: ["wheat", "rye", "maize", "barley", "rapeseed", "oats", "potato", "sugarbeet"],
  cz: ["wheat", "barley", "rapeseed", "maize", "sugarbeet", "potato"],
  sk: ["wheat", "maize", "barley", "rapeseed", "sunflower", "sugarbeet"],
  hu: ["maize", "wheat", "sunflower", "barley", "rapeseed", "soybean"],
  at: ["wheat", "maize", "barley", "soybean", "rapeseed", "sugarbeet"],
  bg: ["wheat", "sunflower", "maize", "barley", "rapeseed"],
  rs: ["maize", "wheat", "sunflower", "soybean", "barley", "sugarbeet"],
  hr: ["maize", "wheat", "barley", "soybean", "sunflower"],
  gr: ["wheat", "cotton", "maize", "barley", "chickpea", "alfalfa"],
  it: ["wheat", "maize", "rice", "barley", "soybean", "sunflower", "alfalfa"],
  es: ["barley", "wheat", "sunflower", "maize", "oats", "rice", "chickpea", "alfalfa"],
  pt: ["maize", "wheat", "rice", "oats", "potato"],
  gb: ["wheat", "barley", "rapeseed", "oats", "potato", "sugarbeet", "faba", "pea"],
  ie: ["barley", "wheat", "oats", "potato"],
  nl: ["potato", "wheat", "sugarbeet", "maize", "barley"],
  be: ["wheat", "potato", "sugarbeet", "maize", "barley"],
  dk: ["barley", "wheat", "rapeseed", "rye", "oats"],
  se: ["wheat", "barley", "oats", "rapeseed", "rye"],
  fi: ["barley", "oats", "wheat", "rye", "rapeseed"],
  no: ["barley", "oats", "wheat", "potato"],
  lt: ["wheat", "rapeseed", "barley", "faba", "oats"],
  lv: ["wheat", "rapeseed", "barley", "oats", "faba"],
  ee: ["barley", "wheat", "rapeseed", "oats", "faba"],
  tr: ["wheat", "barley", "maize", "sunflower", "cotton", "chickpea", "lentil", "sugarbeet"],
  ir: ["wheat", "barley", "rice", "maize", "chickpea", "sugarbeet"],
  iq: ["wheat", "barley", "rice", "maize"],
  sy: ["wheat", "barley", "cotton", "lentil", "chickpea"],
  sa: ["wheat", "sorghum", "alfalfa", "barley", "millet"],
  ye: ["sorghum", "millet", "wheat", "maize"],
  af: ["wheat", "maize", "rice", "barley"],
  eg: ["wheat", "maize", "rice", "cotton", "faba", "sugarbeet", "alfalfa"],
  ma: ["wheat", "barley", "faba", "chickpea", "lentil", "maize"],
  dz: ["wheat", "barley", "oats", "potato", "chickpea"],
  tn: ["wheat", "barley", "faba", "chickpea"],
  ng: ["cassava", "sorghum", "maize", "millet", "cowpea", "rice", "peanut", "sweetpotato", "soybean"],
  ne: ["millet", "sorghum", "cowpea", "peanut"],
  ml: ["millet", "sorghum", "maize", "rice", "cotton", "peanut", "cowpea"],
  bf: ["sorghum", "millet", "maize", "cowpea", "cotton", "peanut"],
  sn: ["millet", "peanut", "sorghum", "rice", "maize", "cowpea"],
  td: ["sorghum", "millet", "peanut", "cowpea", "cotton"],
  sd: ["sorghum", "millet", "peanut", "wheat", "cotton", "sesame"],
  gh: ["cassava", "maize", "rice", "peanut", "cowpea", "sorghum", "sweetpotato"],
  ci: ["cassava", "rice", "maize", "cotton", "peanut"],
  cm: ["cassava", "maize", "sorghum", "peanut", "bean", "cotton"],
  et: ["wheat", "maize", "sorghum", "barley", "faba", "chickpea", "lentil", "bean"],
  ke: ["maize", "bean", "sorghum", "wheat", "potato", "cowpea"],
  ug: ["cassava", "maize", "bean", "sweetpotato", "sorghum", "millet"],
  tz: ["maize", "cassava", "rice", "bean", "sorghum", "sweetpotato", "peanut"],
  rw: ["bean", "cassava", "maize", "sweetpotato", "sorghum"],
  mz: ["maize", "cassava", "peanut", "bean", "sorghum", "rice"],
  mw: ["maize", "cassava", "peanut", "bean", "soybean", "sweetpotato"],
  zm: ["maize", "soybean", "cassava", "peanut", "wheat", "cotton"],
  zw: ["maize", "sorghum", "soybean", "cotton", "wheat", "peanut"],
  za: ["maize", "wheat", "soybean", "sunflower", "sorghum", "barley", "rapeseed", "potato"],
  mg: ["rice", "cassava", "maize", "sweetpotato", "bean"],
  ao: ["cassava", "maize", "bean", "sweetpotato", "peanut"],
  cd: ["cassava", "maize", "peanut", "bean", "rice"],
  au: ["wheat", "barley", "rapeseed", "sorghum", "chickpea", "oats", "lentil", "cotton", "faba"],
  nz: ["barley", "wheat", "maize", "potato", "oats"],
};

/** Fallback regions when the country is unknown or not listed. */
interface Region {
  name: string;
  test: (lat: number, lon: number) => boolean;
  crops: string[];
}

export const REGIONS: Region[] = [
  { name: "Europe", test: (la, lo) => la >= 35 && la <= 71 && lo >= -25 && lo <= 45, crops: ["wheat", "barley", "maize", "rapeseed", "sunflower", "potato", "sugarbeet", "oats"] },
  { name: "North Africa & Middle East", test: (la, lo) => la >= 15 && la < 38 && lo >= -18 && lo <= 63, crops: ["wheat", "barley", "chickpea", "lentil", "faba", "sorghum", "alfalfa"] },
  { name: "Sub-Saharan Africa", test: (la, lo) => la >= -35 && la < 15 && lo >= -18 && lo <= 52, crops: ["maize", "cassava", "sorghum", "millet", "cowpea", "peanut", "bean", "rice", "sweetpotato"] },
  { name: "South Asia", test: (la, lo) => la >= 5 && la < 37 && lo > 63 && lo <= 92, crops: ["rice", "wheat", "chickpea", "cotton", "millet", "lentil", "maize"] },
  { name: "East Asia", test: (la, lo) => la >= 20 && la < 55 && lo > 92 && lo <= 150, crops: ["rice", "maize", "wheat", "soybean", "rapeseed", "potato", "sweetpotato"] },
  { name: "Southeast Asia", test: (la, lo) => la >= -11 && la < 20 && lo > 92 && lo <= 155, crops: ["rice", "maize", "cassava", "sweetpotato", "soybean", "peanut"] },
  { name: "Central Asia & Russia", test: (la, lo) => la >= 37 && la <= 75 && lo > 45 && lo <= 180, crops: ["wheat", "barley", "oats", "sunflower", "rapeseed", "potato"] },
  { name: "North America", test: (la, lo) => la >= 24 && la <= 70 && lo >= -170 && lo <= -50, crops: ["maize", "soybean", "wheat", "rapeseed", "alfalfa", "barley", "sorghum"] },
  { name: "Central America & Caribbean", test: (la, lo) => la >= 7 && la < 24 && lo >= -118 && lo <= -59, crops: ["maize", "bean", "sorghum", "rice", "cassava"] },
  { name: "South America", test: (la, lo) => la >= -56 && la < 13 && lo >= -82 && lo <= -34, crops: ["soybean", "maize", "wheat", "rice", "bean", "cassava", "sunflower"] },
  { name: "Oceania", test: (la, lo) => la >= -48 && la < -10 && lo >= 110 && lo <= 180, crops: ["wheat", "barley", "rapeseed", "sorghum", "chickpea", "oats"] },
];

export function marketCrops(countryCode: string | null, lat: number, lon: number) {
  const country = countryCode ? COUNTRY_CROPS[countryCode.toLowerCase()] : undefined;
  const region = REGIONS.find((item) => item.test(lat, lon));
  return {
    country: country ?? null,
    region: region?.crops ?? [],
    regionName: region?.name ?? null,
  };
}

/** 0–100 market-fit estimate for a crop at a location. */
export function marketScore(cropId: string, countryCode: string | null, lat: number, lon: number) {
  const { country, region } = marketCrops(countryCode, lat, lon);
  if (country) {
    const rank = country.indexOf(cropId);
    if (rank >= 0) return Math.round(95 - (rank / Math.max(country.length, 1)) * 20);
  }
  if (region.includes(cropId)) return 65;
  return country ? 35 : 45;
}
