/**
 * Additional live sources (all tested from a browser):
 *
 * - Copernicus ERA5-Land soil moisture (CDS reanalysis) via the Open-Meteo
 *   historical API: an independent check on NASA POWER, in m³/m³ (2018 onwards,
 *   to keep the request light for Open-Meteo's free rate limit).
 * - CMIP6 HighResMIP climate projections (as close to RCP8.5 as CMIP6 allows),
 *   downscaled with ERA5-Land, via the Open-Meteo climate API.
 * - Copernicus Data Space STAC catalogue: recent cloud-free Sentinel-2 passes.
 * - USGS Water Data OGC API: groundwater-level trends from nearby wells (US).
 * - USDA NASS Quick Stats and OpenET through the local dev proxy (they need
 *   API keys and block browser calls, so the key stays on the server side).
 */

import type { PlaceResult } from "./nasaData";

async function getJson<T>(url: string, timeoutMs = 30000, init: RequestInit = {}, retried = false): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    // Open-Meteo rate-limits bursts (HTTP 429); one delayed retry usually succeeds.
    if (response.status === 429 && !retried) {
      clearTimeout(timer);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return getJson<T>(url, timeoutMs, init, true);
    }
    if (response.status === 429) throw new Error("Rate limit reached at the data service; try again in a minute");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const round = (value: number, digits = 0) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Error used when a source needs configuration (API key / proxy) rather than having failed. */
export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConfiguredError";
  }
}

/* ------------------------------------------------------------------ */
/* ERA5-Land soil moisture (Copernicus CDS via Open-Meteo)             */
/* ------------------------------------------------------------------ */

export interface Era5Result {
  rootZone: number | null; // m3/m3, 28–100 cm, last 12 months
  rootZoneAnomaly: number | null; // % vs earlier 12-month windows
  surface: number | null; // m3/m3, 0–7 cm
  end: string;
}

interface OpenMeteoDaily {
  daily?: Record<string, (number | null)[]> & { time?: string[] };
}

export async function fetchEra5Land(latitude: number, longitude: number): Promise<Era5Result> {
  const end = isoDay(new Date(Date.now() - 7 * 86400000));
  const json = await getJson<OpenMeteoDaily>(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&start_date=2018-01-01&end_date=${end}&daily=soil_moisture_0_to_7cm_mean,soil_moisture_28_to_100cm_mean&models=era5_land`,
    40000,
  );
  const time = json.daily?.time ?? [];
  const root = (json.daily?.soil_moisture_28_to_100cm_mean ?? []) as (number | null)[];
  const top = (json.daily?.soil_moisture_0_to_7cm_mean ?? []) as (number | null)[];
  let last = root.length - 1;
  while (last >= 0 && root[last] === null) last -= 1;
  if (last < 365) throw new Error("ERA5-Land has no soil moisture here (water, ice or urban cell)");

  const windowMean = (values: (number | null)[], to: number) =>
    mean(values.slice(Math.max(to - 364, 0), to + 1).filter((v): v is number => v !== null));
  const current = windowMean(root, last);
  const previous: number[] = [];
  for (let to = last - 365; to - 364 >= 0; to -= 365) {
    const value = windowMean(root, to);
    if (value !== null) previous.push(value);
  }
  const baseline = mean(previous);
  return {
    rootZone: current !== null ? round(current, 3) : null,
    rootZoneAnomaly: current !== null && baseline ? round(((current - baseline) / baseline) * 100) : null,
    surface: (() => {
      const value = windowMean(top, last);
      return value !== null ? round(value, 3) : null;
    })(),
    end: time[last] ?? end,
  };
}

/* ------------------------------------------------------------------ */
/* CMIP6 projections (HighResMIP via Open-Meteo)                        */
/* ------------------------------------------------------------------ */

export const CMIP6_MODELS = ["EC_Earth3P_HR", "MPI_ESM1_2_XR", "MRI_AGCM3_2_S"] as const;

export interface ProjectionResult {
  baseline: string;
  future: string;
  models: string[];
  deltaT: number; // °C, ensemble mean
  deltaTRange: [number, number];
  rainPct: number; // %, ensemble mean
  rainPctRange: [number, number];
  hotDaysBaseline: number; // days ≥ 32 °C per year
  hotDaysFuture: number;
  monthlyDeltaT: number[];
  monthlyRainPct: number[];
}

interface PeriodStats {
  meanT: number;
  annualRain: number;
  hotDays: number;
  monthT: number[];
  monthRain: number[];
}

function periodStats(time: string[], tmean: (number | null)[], tmax: (number | null)[], rain: (number | null)[]): PeriodStats {
  const years = new Set(time.map((d) => d.slice(0, 4))).size || 1;
  const monthT: number[][] = Array.from({ length: 12 }, () => []);
  const monthRain = Array(12).fill(0);
  let hot = 0;
  let totalRain = 0;
  const allT: number[] = [];
  time.forEach((day, i) => {
    const m = +day.slice(5, 7) - 1;
    if (tmean[i] !== null) {
      monthT[m].push(tmean[i] as number);
      allT.push(tmean[i] as number);
    }
    if (rain[i] !== null) {
      monthRain[m] += rain[i] as number;
      totalRain += rain[i] as number;
    }
    if (tmax[i] !== null && (tmax[i] as number) >= 32) hot += 1;
  });
  return {
    meanT: mean(allT) ?? 0,
    annualRain: totalRain / years,
    hotDays: hot / years,
    monthT: monthT.map((values) => mean(values) ?? 0),
    monthRain: monthRain.map((value) => value / years),
  };
}

export async function fetchClimateProjection(latitude: number, longitude: number): Promise<ProjectionResult> {
  const base = (start: string, end: string) =>
    `https://climate-api.open-meteo.com/v1/climate?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&start_date=${start}&end_date=${end}&models=${CMIP6_MODELS.join(",")}&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum`;
  const [past, future] = await Promise.all([
    getJson<OpenMeteoDaily>(base("1995-01-01", "2014-12-31"), 60000),
    getJson<OpenMeteoDaily>(base("2041-01-01", "2050-12-31"), 60000),
  ]);

  const perModel = CMIP6_MODELS.map((model) => {
    const stats = (json: OpenMeteoDaily) => {
      const d = json.daily ?? {};
      const time = (d.time ?? []) as string[];
      return periodStats(
        time,
        (d[`temperature_2m_mean_${model}`] ?? []) as (number | null)[],
        (d[`temperature_2m_max_${model}`] ?? []) as (number | null)[],
        (d[`precipitation_sum_${model}`] ?? []) as (number | null)[],
      );
    };
    const a = stats(past);
    const b = stats(future);
    if (!a.annualRain || !b.annualRain) return null;
    return {
      model,
      deltaT: b.meanT - a.meanT,
      rainPct: (b.annualRain / a.annualRain - 1) * 100,
      hotA: a.hotDays,
      hotB: b.hotDays,
      monthDT: b.monthT.map((t, m) => t - a.monthT[m]),
      monthRain: b.monthRain.map((r, m) => (a.monthRain[m] > 1 ? (r / a.monthRain[m] - 1) * 100 : 0)),
    };
  }).filter((m): m is NonNullable<typeof m> => m !== null);

  if (!perModel.length) throw new Error("No climate projection available for this location");
  const avg = (pick: (m: (typeof perModel)[number]) => number) => mean(perModel.map(pick)) ?? 0;
  const range = (pick: (m: (typeof perModel)[number]) => number): [number, number] => [
    round(Math.min(...perModel.map(pick)), 1),
    round(Math.max(...perModel.map(pick)), 1),
  ];

  return {
    baseline: "1995–2014",
    future: "2041–2050",
    models: perModel.map((m) => m.model.replace(/_/g, "-")),
    deltaT: round(avg((m) => m.deltaT), 1),
    deltaTRange: range((m) => m.deltaT),
    rainPct: round(avg((m) => m.rainPct)),
    rainPctRange: range((m) => m.rainPct),
    hotDaysBaseline: Math.round(avg((m) => m.hotA)),
    hotDaysFuture: Math.round(avg((m) => m.hotB)),
    monthlyDeltaT: Array.from({ length: 12 }, (_, i) => round(avg((m) => m.monthDT[i]), 1)),
    monthlyRainPct: Array.from({ length: 12 }, (_, i) => round(avg((m) => m.monthRain[i]))),
  };
}

/* ------------------------------------------------------------------ */
/* Sentinel-2 passes (Copernicus Data Space STAC)                       */
/* ------------------------------------------------------------------ */

export interface Sentinel2Result {
  latestDate: string;
  cloudCover: number;
  sceneId: string;
  clearScenes90d: number;
  browserUrl: string;
}

interface StacSearch {
  features?: { id: string; properties: { datetime: string; "eo:cloud_cover"?: number } }[];
}

export async function fetchSentinel2(latitude: number, longitude: number): Promise<Sentinel2Result> {
  const d = 0.005;
  const bbox = [longitude - d, latitude - d, longitude + d, latitude + d].map((v) => v.toFixed(4)).join(",");
  const from = new Date(Date.now() - 90 * 86400000).toISOString();
  const json = await getJson<StacSearch>(
    `https://stac.dataspace.copernicus.eu/v1/search?collections=sentinel-2-l2a&bbox=${bbox}&datetime=${from}/..&limit=60&sortby=-properties.datetime&filter=${encodeURIComponent("eo:cloud_cover<20")}&filter-lang=cql2-text`,
    30000,
  );
  const features = json.features ?? [];
  // Overlapping orbits/tiles list the same pass more than once; count distinct days.
  const days = new Set(features.map((f) => f.properties.datetime.slice(0, 10)));
  const latest = features[0];
  if (!latest) throw new Error("No Sentinel-2 pass with less than 20% cloud in the last 90 days");
  return {
    latestDate: latest.properties.datetime.slice(0, 10),
    cloudCover: round(latest.properties["eo:cloud_cover"] ?? 0),
    sceneId: latest.id,
    clearScenes90d: days.size,
    browserUrl: `https://browser.dataspace.copernicus.eu/?zoom=15&lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Groundwater trend (USGS Water Data OGC API, United States)           */
/* ------------------------------------------------------------------ */

export interface GroundwaterResult {
  siteId: string;
  siteUrl: string;
  distanceKm: number;
  latestDepthM: number;
  latestDate: string;
  trendMPerDecade: number; // + means the water table is getting deeper
  measurements: number;
  firstYear: number;
}

interface UsgsFeatures {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties: { monitoring_location_id: string; time: string; value: string; unit_of_measure?: string };
  }[];
}

export async function fetchGroundwater(latitude: number, longitude: number): Promise<GroundwaterResult> {
  const d = 0.35;
  const bbox = [longitude - d, latitude - d, longitude + d, latitude + d].map((v) => v.toFixed(3)).join(",");
  const json = await getJson<UsgsFeatures>(
    `https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements/items?bbox=${bbox}&parameter_code=72019&datetime=2005-01-01T00:00:00Z/..&f=json&limit=5000`,
    45000,
  );

  const sites = new Map<string, { t: number[]; v: number[]; dates: string[]; lon: number; lat: number }>();
  for (const f of json.features ?? []) {
    const p = f.properties;
    const value = Number(p.value);
    if (!Number.isFinite(value)) continue;
    const meters = (p.unit_of_measure ?? "ft").startsWith("ft") ? value * 0.3048 : value;
    const [lon, lat] = f.geometry?.coordinates ?? [longitude, latitude];
    if (!sites.has(p.monitoring_location_id)) sites.set(p.monitoring_location_id, { t: [], v: [], dates: [], lon, lat });
    const site = sites.get(p.monitoring_location_id)!;
    site.t.push(Date.parse(p.time) / (365.25 * 86400000));
    site.v.push(meters);
    site.dates.push(p.time.slice(0, 10));
  }

  const toKm = (lat: number, lon: number) => {
    const dx = (lon - longitude) * 111.32 * Math.cos((latitude * Math.PI) / 180);
    const dy = (lat - latitude) * 110.57;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const nowYears = Date.now() / (365.25 * 86400000);
  const candidates = [...sites.entries()]
    .map(([id, s]) => ({ id, s, span: Math.max(...s.t) - Math.min(...s.t), km: toKm(s.lat, s.lon), latest: Math.max(...s.t) }))
    .filter((c) => c.s.v.length >= 4 && c.span >= 4)
    .sort((a, b) => a.km - b.km);
  // Prefer the nearest well that is still being measured (last reading within ~6 years).
  const best = candidates.find((c) => nowYears - c.latest <= 6) ?? candidates[0];
  if (!best) throw new Error("No well with a long enough groundwater record within ~35 km");

  const { t, v, dates } = best.s;
  const tm = mean(t) as number;
  const vm = mean(v) as number;
  const sxx = t.reduce((s, x) => s + (x - tm) ** 2, 0);
  const slope = sxx ? t.reduce((s, x, i) => s + (x - tm) * (v[i] - vm), 0) / sxx : 0;
  const latestIndex = t.indexOf(Math.max(...t));
  const number = best.id.replace(/^USGS-/, "");

  return {
    siteId: best.id,
    siteUrl: `https://waterdata.usgs.gov/monitoring-location/${number}/`,
    distanceKm: round(best.km, 1),
    latestDepthM: round(v[latestIndex], 1),
    latestDate: dates[latestIndex],
    trendMPerDecade: round(slope * 10, 2),
    measurements: v.length,
    firstYear: Math.floor(Math.min(...t) + 1970),
  };
}

/* ------------------------------------------------------------------ */
/* USDA NASS Quick Stats (county yields) via the local proxy            */
/* ------------------------------------------------------------------ */

const NASS_CROPS: Record<string, string> = {
  CORN: "maize",
  SOYBEANS: "soybean",
  WHEAT: "wheat",
  OATS: "oats",
  BARLEY: "barley",
  SORGHUM: "sorghum",
  SUNFLOWER: "sunflower",
  COTTON: "cotton",
  RICE: "rice",
  PEANUTS: "peanut",
  SUGARBEETS: "sugarbeet",
  CANOLA: "rapeseed",
  "BEANS": "bean",
  "CHICKPEAS": "chickpea",
  LENTILS: "lentil",
  "PEAS": "pea",
  POTATOES: "potato",
};

export interface NassCropYield {
  cropId: string;
  commodity: string;
  unit: string;
  latestYear: number;
  latest: number;
  average5y: number;
  trendPctPerYear: number;
}

export interface NassResult {
  county: string;
  state: string;
  crops: NassCropYield[];
}

interface NassRow {
  commodity_desc: string;
  short_desc: string;
  year: number | string;
  Value: string;
  unit_desc: string;
}

/** Parses a proxy response; anything that is not JSON means the proxy is not running. */
async function proxyJson<T>(url: string, init: RequestInit = {}, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("json")) {
      throw new NotConfiguredError("Needs the AgroCycle dev proxy (run the app with npm run dev)");
    }
    const json = (await response.json()) as T & { error?: string; configured?: boolean };
    if (response.status === 503 || json.configured === false) {
      throw new NotConfiguredError(json.error ?? "API key not configured");
    }
    if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchNassYields(place: PlaceResult | null): Promise<NassResult> {
  if (!place || place.code !== "us" || !place.stateCode || !place.county) {
    throw new Error("County not identified");
  }
  const county = place.county.replace(/\s+(County|Parish|Borough)$/i, "").toUpperCase();
  const query = new URLSearchParams({
    source_desc: "SURVEY",
    statisticcat_desc: "YIELD",
    agg_level_desc: "COUNTY",
    state_alpha: place.stateCode,
    county_name: county,
    year__GE: String(new Date().getFullYear() - 11),
    format: "JSON",
  });
  const json = await proxyJson<{ data?: NassRow[] }>(`/api/nass/api_GET/?${query.toString()}`);
  const rows = (json.data ?? []).filter(
    (row) => !/IRRIGATED|NON-IRRIGATED|FOLLOWING|SILAGE|UTILIZED/i.test(row.short_desc) && /YIELD/.test(row.short_desc),
  );

  const groups = new Map<string, NassRow[]>();
  rows.forEach((row) => {
    const commodity = row.commodity_desc.toUpperCase();
    if (!(commodity in NASS_CROPS)) return;
    if (!groups.has(commodity)) groups.set(commodity, []);
    groups.get(commodity)!.push(row);
  });

  const crops: NassCropYield[] = [];
  groups.forEach((list, commodity) => {
    // Keep the most common unit/short_desc (e.g. "CORN, GRAIN - YIELD, MEASURED IN BU / ACRE").
    const counts = new Map<string, number>();
    list.forEach((row) => counts.set(row.short_desc, (counts.get(row.short_desc) ?? 0) + 1));
    const desc = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const series = list
      .filter((row) => row.short_desc === desc)
      .map((row) => ({ year: Number(row.year), value: Number(String(row.Value).replace(/,/g, "")) }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.year - b.year);
    if (!series.length) return;
    const last = series[series.length - 1];
    const recent = series.slice(-5);
    const first = series[0];
    const years = Math.max(last.year - first.year, 1);
    crops.push({
      cropId: NASS_CROPS[commodity],
      commodity: commodity.charAt(0) + commodity.slice(1).toLowerCase(),
      unit: list[0].unit_desc,
      latestYear: last.year,
      latest: last.value,
      average5y: round(mean(recent.map((p) => p.value)) ?? last.value, 1),
      trendPctPerYear: round(((last.value / first.value) ** (1 / years) - 1) * 100, 1),
    });
  });

  if (!crops.length) throw new Error("No county yield statistics for this county");
  return { county: place.county, state: place.state ?? place.stateCode, crops: crops.sort((a, b) => b.latestYear - a.latestYear) };
}

/* ------------------------------------------------------------------ */
/* OpenET actual evapotranspiration via the local proxy                 */
/* ------------------------------------------------------------------ */

export interface OpenEtResult {
  year: number;
  annualEt: number; // mm
  monthly: number[]; // mm per month
}

export async function fetchOpenEt(latitude: number, longitude: number): Promise<OpenEtResult> {
  const year = new Date().getFullYear() - 1;
  const json = await proxyJson<unknown>("/api/openet/raster/timeseries/point", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date_range: [`${year}-01-01`, `${year}-12-31`],
      interval: "monthly",
      geometry: [Number(longitude.toFixed(5)), Number(latitude.toFixed(5))],
      model: "Ensemble",
      variable: "ET",
      reference_et: "gridMET",
      units: "mm",
      file_format: "JSON",
    }),
  }, 90000);

  // Expected: [{ time: "2025-01-01", et: 12.3 }, ...]; parse defensively.
  const rows = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const monthly = Array(12).fill(0);
  let found = 0;
  rows.forEach((row) => {
    const date = String(row.time ?? row.date ?? row.DateTime ?? "");
    const value = Number(row.et ?? row.ET ?? row.value ?? Object.values(row).find((v) => typeof v === "number"));
    const month = Number(date.slice(5, 7)) - 1;
    if (month >= 0 && month < 12 && Number.isFinite(value)) {
      monthly[month] += value;
      found += 1;
    }
  });
  if (!found) throw new Error("OpenET returned no data (outside coverage?)");
  return { year, annualEt: Math.round(monthly.reduce((s, v) => s + v, 0)), monthly: monthly.map((v) => round(v)) };
}
