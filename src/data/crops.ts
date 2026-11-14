/**
 * Global crop library used to recommend rotations anywhere on Earth.
 *
 * Requirements are general agronomic ranges in the style of FAO ECOCROP:
 * base / optimal / maximum growing temperatures (monthly mean °C), active
 * growing months, average crop coefficient (Kc, FAO-56) for water need, and
 * tolerances. They are deliberately coarse and must be checked against local
 * varieties and extension advice.
 */

export type CropRole = "cash" | "forage" | "cover";
export type SoilPreference = "any" | "light" | "heavy" | "well-drained";

export interface Crop {
  id: string;
  name: string;
  emoji: string;
  family: string;
  role: CropRole;
  tBase: number;
  tOptLow: number;
  tOptHigh: number;
  tMax: number;
  /** Can sit dormant through cold months after sowing (winter types). */
  overwinter: boolean;
  frostTolerant: boolean;
  /** Active growing months needed. */
  months: number;
  kc: number;
  droughtTol: number;
  heatTol: number;
  /** Needs standing water / very wet soils (paddy rice). */
  paddy?: boolean;
  phMin: number;
  phMax: number;
  soil: SoilPreference;
  nFix: boolean;
  cover: number;
  deepRoot: boolean;
  residue: number;
  biofumigant?: boolean;
  /** Perennial forage that occupies the slot for the whole year. */
  perennial?: boolean;
  note: string;
}

const c = (crop: Crop) => crop;

export const CROPS: Crop[] = [
  // Cereals
  c({ id: "wheat", name: "Wheat", emoji: "🌾", family: "Poaceae", role: "cash", tBase: 3, tOptLow: 12, tOptHigh: 22, tMax: 32, overwinter: true, frostTolerant: true, months: 5, kc: 0.8, droughtTol: 0.5, heatTol: 0.4, phMin: 5.5, phMax: 7.8, soil: "any", nFix: false, cover: 0.6, deepRoot: false, residue: 0.7, note: "Cool-season staple; winter types use autumn–spring moisture." }),
  c({ id: "barley", name: "Barley", emoji: "🌾", family: "Poaceae", role: "cash", tBase: 2, tOptLow: 12, tOptHigh: 20, tMax: 30, overwinter: true, frostTolerant: true, months: 4, kc: 0.75, droughtTol: 0.6, heatTol: 0.4, phMin: 6, phMax: 8.2, soil: "any", nFix: false, cover: 0.55, deepRoot: false, residue: 0.6, note: "Short cool-season cereal, tolerates drier and saline soils better than wheat." }),
  c({ id: "oats", name: "Oats", emoji: "🌾", family: "Poaceae", role: "cash", tBase: 3, tOptLow: 12, tOptHigh: 20, tMax: 29, overwinter: false, frostTolerant: true, months: 4, kc: 0.75, droughtTol: 0.4, heatTol: 0.3, phMin: 5, phMax: 7.5, soil: "any", nFix: false, cover: 0.65, deepRoot: false, residue: 0.6, note: "Spring cereal for food or forage; a good disease break between wheat crops." }),
  c({ id: "rye", name: "Rye", emoji: "🌾", family: "Poaceae", role: "cash", tBase: 1, tOptLow: 8, tOptHigh: 20, tMax: 30, overwinter: true, frostTolerant: true, months: 5, kc: 0.75, droughtTol: 0.7, heatTol: 0.4, phMin: 5, phMax: 7.5, soil: "light", nFix: false, cover: 0.8, deepRoot: true, residue: 0.8, note: "Very hardy cereal for poor, sandy and cold soils." }),
  c({ id: "maize", name: "Maize (corn)", emoji: "🌽", family: "Poaceae", role: "cash", tBase: 10, tOptLow: 20, tOptHigh: 30, tMax: 38, overwinter: false, frostTolerant: false, months: 4, kc: 0.85, droughtTol: 0.4, heatTol: 0.6, phMin: 5.5, phMax: 7.5, soil: "any", nFix: false, cover: 0.35, deepRoot: false, residue: 0.75, note: "High-yield warm-season cereal with a high water and nitrogen demand." }),
  c({ id: "rice", name: "Rice (paddy)", emoji: "🍚", family: "Poaceae", role: "cash", tBase: 12, tOptLow: 22, tOptHigh: 32, tMax: 38, overwinter: false, frostTolerant: false, months: 4, kc: 1.15, droughtTol: 0.1, heatTol: 0.7, paddy: true, phMin: 5, phMax: 7.5, soil: "heavy", nFix: false, cover: 0.4, deepRoot: false, residue: 0.5, note: "Flooded warm-season staple; needs abundant rain or irrigation and water-holding soils." }),
  c({ id: "sorghum", name: "Sorghum", emoji: "🌾", family: "Poaceae", role: "cash", tBase: 10, tOptLow: 24, tOptHigh: 33, tMax: 40, overwinter: false, frostTolerant: false, months: 4, kc: 0.7, droughtTol: 0.85, heatTol: 0.9, phMin: 5.5, phMax: 8.5, soil: "any", nFix: false, cover: 0.35, deepRoot: true, residue: 0.7, note: "Drought- and heat-tolerant grain or forage cereal." }),
  c({ id: "millet", name: "Pearl millet", emoji: "🌾", family: "Poaceae", role: "cash", tBase: 12, tOptLow: 25, tOptHigh: 35, tMax: 42, overwinter: false, frostTolerant: false, months: 3, kc: 0.65, droughtTol: 0.9, heatTol: 0.95, phMin: 5, phMax: 8, soil: "light", nFix: false, cover: 0.3, deepRoot: true, residue: 0.6, note: "The most drought-hardy cereal, suited to hot, sandy, low-rainfall areas." }),
  c({ id: "buckwheat", name: "Buckwheat", emoji: "🌸", family: "Polygonaceae", role: "cash", tBase: 8, tOptLow: 15, tOptHigh: 25, tMax: 32, overwinter: false, frostTolerant: false, months: 3, kc: 0.7, droughtTol: 0.5, heatTol: 0.4, phMin: 5, phMax: 7, soil: "any", nFix: false, cover: 0.7, deepRoot: false, residue: 0.4, note: "Very short season, smothers weeds and mobilises phosphorus." }),

  // Legumes
  c({ id: "soybean", name: "Soybean", emoji: "🫘", family: "Fabaceae", role: "cash", tBase: 10, tOptLow: 20, tOptHigh: 30, tMax: 36, overwinter: false, frostTolerant: false, months: 4, kc: 0.8, droughtTol: 0.45, heatTol: 0.55, phMin: 6, phMax: 7.5, soil: "any", nFix: true, cover: 0.4, deepRoot: false, residue: 0.4, note: "Warm-season legume that fixes nitrogen for the following cereal." }),
  c({ id: "peanut", name: "Peanut (groundnut)", emoji: "🥜", family: "Fabaceae", role: "cash", tBase: 13, tOptLow: 22, tOptHigh: 30, tMax: 37, overwinter: false, frostTolerant: false, months: 4, kc: 0.75, droughtTol: 0.6, heatTol: 0.7, phMin: 5.5, phMax: 7, soil: "light", nFix: true, cover: 0.45, deepRoot: false, residue: 0.4, note: "Warm-season legume for light, well-drained soils." }),
  c({ id: "chickpea", name: "Chickpea", emoji: "🫘", family: "Fabaceae", role: "cash", tBase: 5, tOptLow: 15, tOptHigh: 25, tMax: 32, overwinter: false, frostTolerant: true, months: 4, kc: 0.7, droughtTol: 0.8, heatTol: 0.5, phMin: 6, phMax: 8.5, soil: "well-drained", nFix: true, cover: 0.35, deepRoot: true, residue: 0.3, note: "Drought-tolerant cool-season pulse grown on stored soil moisture." }),
  c({ id: "lentil", name: "Lentil", emoji: "🫘", family: "Fabaceae", role: "cash", tBase: 4, tOptLow: 12, tOptHigh: 24, tMax: 30, overwinter: true, frostTolerant: true, months: 4, kc: 0.7, droughtTol: 0.7, heatTol: 0.4, phMin: 6, phMax: 8, soil: "well-drained", nFix: true, cover: 0.35, deepRoot: false, residue: 0.3, note: "Cool-season pulse for semi-arid areas." }),
  c({ id: "pea", name: "Field pea", emoji: "🫛", family: "Fabaceae", role: "cash", tBase: 4, tOptLow: 12, tOptHigh: 20, tMax: 28, overwinter: true, frostTolerant: true, months: 3, kc: 0.75, droughtTol: 0.5, heatTol: 0.3, phMin: 6, phMax: 7.5, soil: "any", nFix: true, cover: 0.5, deepRoot: false, residue: 0.4, note: "Short cool-season legume, often followed by a cereal or oilseed." }),
  c({ id: "faba", name: "Faba bean", emoji: "🫘", family: "Fabaceae", role: "cash", tBase: 3, tOptLow: 12, tOptHigh: 22, tMax: 28, overwinter: true, frostTolerant: true, months: 5, kc: 0.8, droughtTol: 0.4, heatTol: 0.3, phMin: 6, phMax: 8, soil: "heavy", nFix: true, cover: 0.5, deepRoot: true, residue: 0.5, note: "Strong nitrogen fixer for heavier, moist soils." }),
  c({ id: "bean", name: "Common bean", emoji: "🫘", family: "Fabaceae", role: "cash", tBase: 10, tOptLow: 18, tOptHigh: 26, tMax: 32, overwinter: false, frostTolerant: false, months: 3, kc: 0.75, droughtTol: 0.4, heatTol: 0.4, phMin: 6, phMax: 7.5, soil: "well-drained", nFix: true, cover: 0.35, deepRoot: false, residue: 0.3, note: "Short warm-season pulse." }),
  c({ id: "cowpea", name: "Cowpea", emoji: "🫘", family: "Fabaceae", role: "cash", tBase: 12, tOptLow: 25, tOptHigh: 33, tMax: 40, overwinter: false, frostTolerant: false, months: 3, kc: 0.7, droughtTol: 0.8, heatTol: 0.9, phMin: 5.5, phMax: 7.5, soil: "light", nFix: true, cover: 0.6, deepRoot: true, residue: 0.4, note: "Heat- and drought-hardy legume for grain, forage or cover." }),
  c({ id: "alfalfa", name: "Alfalfa (lucerne)", emoji: "🌿", family: "Fabaceae", role: "forage", tBase: 5, tOptLow: 15, tOptHigh: 28, tMax: 35, overwinter: true, frostTolerant: true, months: 7, kc: 0.95, droughtTol: 0.7, heatTol: 0.6, phMin: 6.5, phMax: 8, soil: "well-drained", nFix: true, cover: 1, deepRoot: true, residue: 0.8, perennial: true, note: "Perennial deep-rooted forage legume; builds soil structure over 2–4 years." }),

  // Oilseeds, fibre, roots
  c({ id: "sunflower", name: "Sunflower", emoji: "🌻", family: "Asteraceae", role: "cash", tBase: 7, tOptLow: 18, tOptHigh: 28, tMax: 36, overwinter: false, frostTolerant: false, months: 4, kc: 0.75, droughtTol: 0.7, heatTol: 0.75, phMin: 6, phMax: 7.8, soil: "any", nFix: false, cover: 0.3, deepRoot: true, residue: 0.5, note: "Deep-rooted, heat-tolerant oilseed." }),
  c({ id: "rapeseed", name: "Rapeseed (canola)", emoji: "🌼", family: "Brassicaceae", role: "cash", tBase: 3, tOptLow: 12, tOptHigh: 22, tMax: 30, overwinter: true, frostTolerant: true, months: 5, kc: 0.8, droughtTol: 0.4, heatTol: 0.3, phMin: 5.5, phMax: 7.5, soil: "any", nFix: false, cover: 0.65, deepRoot: true, residue: 0.5, biofumigant: true, note: "Cool-season oilseed and a strong break crop for cereal diseases." }),
  c({ id: "cotton", name: "Cotton", emoji: "☁️", family: "Malvaceae", role: "cash", tBase: 17, tOptLow: 25, tOptHigh: 32, tMax: 40, overwinter: false, frostTolerant: false, months: 5, kc: 0.8, droughtTol: 0.6, heatTol: 0.85, phMin: 5.5, phMax: 8, soil: "any", nFix: false, cover: 0.3, deepRoot: true, residue: 0.4, note: "Long warm-season fibre crop." }),
  c({ id: "sugarbeet", name: "Sugar beet", emoji: "🍠", family: "Amaranthaceae", role: "cash", tBase: 5, tOptLow: 15, tOptHigh: 24, tMax: 32, overwinter: false, frostTolerant: true, months: 6, kc: 0.85, droughtTol: 0.4, heatTol: 0.3, phMin: 6.5, phMax: 8, soil: "well-drained", nFix: false, cover: 0.45, deepRoot: true, residue: 0.5, note: "Temperate root crop that breaks cereal disease cycles." }),
  c({ id: "potato", name: "Potato", emoji: "🥔", family: "Solanaceae", role: "cash", tBase: 7, tOptLow: 15, tOptHigh: 22, tMax: 30, overwinter: false, frostTolerant: false, months: 4, kc: 0.8, droughtTol: 0.3, heatTol: 0.2, phMin: 5, phMax: 6.5, soil: "light", nFix: false, cover: 0.45, deepRoot: false, residue: 0.3, note: "Cool-season tuber for light soils; sensitive to heat and drought." }),
  c({ id: "cassava", name: "Cassava", emoji: "🥔", family: "Euphorbiaceae", role: "cash", tBase: 16, tOptLow: 24, tOptHigh: 32, tMax: 40, overwinter: false, frostTolerant: false, months: 10, kc: 0.7, droughtTol: 0.8, heatTol: 0.8, phMin: 4.5, phMax: 7.5, soil: "light", nFix: false, cover: 0.45, deepRoot: true, residue: 0.4, note: "Long-season tropical root crop that tolerates poor soils and dry spells." }),
  c({ id: "sweetpotato", name: "Sweet potato", emoji: "🍠", family: "Convolvulaceae", role: "cash", tBase: 15, tOptLow: 22, tOptHigh: 30, tMax: 38, overwinter: false, frostTolerant: false, months: 4, kc: 0.75, droughtTol: 0.6, heatTol: 0.7, phMin: 5, phMax: 6.8, soil: "light", nFix: false, cover: 0.75, deepRoot: false, residue: 0.3, note: "Warm-season root crop with dense ground cover." }),

  // Cover crops
  c({ id: "rye-cover", name: "Cereal rye cover", emoji: "🌱", family: "Poaceae", role: "cover", tBase: 1, tOptLow: 5, tOptHigh: 20, tMax: 30, overwinter: true, frostTolerant: true, months: 3, kc: 0.55, droughtTol: 0.7, heatTol: 0.3, phMin: 5, phMax: 7.5, soil: "any", nFix: false, cover: 1, deepRoot: true, residue: 0.9, note: "Winter-hardy cover that holds soil and catches leftover nitrogen." }),
  c({ id: "vetch", name: "Hairy vetch cover", emoji: "🌱", family: "Fabaceae", role: "cover", tBase: 3, tOptLow: 10, tOptHigh: 22, tMax: 30, overwinter: true, frostTolerant: true, months: 3, kc: 0.6, droughtTol: 0.5, heatTol: 0.3, phMin: 5.5, phMax: 7.5, soil: "any", nFix: true, cover: 0.9, deepRoot: false, residue: 0.6, note: "Winter legume cover that adds nitrogen before a summer crop." }),
  c({ id: "clover", name: "Crimson clover cover", emoji: "🌱", family: "Fabaceae", role: "cover", tBase: 4, tOptLow: 10, tOptHigh: 22, tMax: 30, overwinter: true, frostTolerant: true, months: 3, kc: 0.6, droughtTol: 0.4, heatTol: 0.3, phMin: 5.5, phMax: 7, soil: "any", nFix: true, cover: 0.9, deepRoot: false, residue: 0.5, note: "Legume cover for mild winters; feeds pollinators." }),
  c({ id: "mustard", name: "Mustard / radish cover", emoji: "🌱", family: "Brassicaceae", role: "cover", tBase: 4, tOptLow: 10, tOptHigh: 22, tMax: 30, overwinter: false, frostTolerant: true, months: 2, kc: 0.6, droughtTol: 0.5, heatTol: 0.4, phMin: 5.5, phMax: 8, soil: "any", nFix: false, cover: 0.8, deepRoot: true, residue: 0.5, biofumigant: true, note: "Fast autumn cover; taproots open compacted soil and suppress some soil pests." }),
  c({ id: "sunnhemp", name: "Sunn hemp cover", emoji: "🌱", family: "Fabaceae", role: "cover", tBase: 15, tOptLow: 22, tOptHigh: 32, tMax: 40, overwinter: false, frostTolerant: false, months: 2, kc: 0.65, droughtTol: 0.7, heatTol: 0.9, phMin: 5, phMax: 7.5, soil: "any", nFix: true, cover: 0.9, deepRoot: true, residue: 0.7, note: "Fast tropical legume cover that adds nitrogen and biomass in hot weather." }),
];

export const CROP_BY_ID: Record<string, Crop> = Object.fromEntries(CROPS.map((crop) => [crop.id, crop]));

export const SELECTABLE_CROPS = CROPS.filter((crop) => crop.role !== "cover");
