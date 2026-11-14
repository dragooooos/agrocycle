/**
 * Live data clients used by the analysis page. All of them are public,
 * keyless and callable from the browser.
 *
 * - NASA POWER daily API: temperature, precipitation and soil wetness for the
 *   surface (GWETTOP, 0–5 cm) and root zone (GWETROOT, 0–100 cm) — the same
 *   two layers SMAP L4 reports (sm_surface_wetness / sm_rootzone_wetness).
 * - ORNL DAAC MODIS web service (NASA DAAC): MOD13Q1 250 m NDVI.
 * - Copernicus GLO-90 elevation through Open-Meteo: slope (NASA SRTM services
 *   need an Earthdata login and the public SRTM mirror blocks browser calls).
 * - USDA NRCS SSURGO (Web Soil Survey) via Soil Data Access: field-scale soil
 *   properties inside the United States.
 * - ISRIC SoilGrids 250 m: the soil-attribute source the SMAP mission itself
 *   uses (SMAP Ancillary Data Report: Soil Attributes, 2020).
 */

export interface PowerDaily {
  dates: string[]; // YYYYMMDD
  series: Record<string, (number | null)[]>;
}

export interface SoilProfile {
  bulkDensity: number | null; // g/cm3
  clay: number | null; // %
  sand: number | null; // %
  silt: number | null; // %
  soc: number | null; // g/kg
  ph: number | null;
}

export interface NdviResult {
  latest: number | null;
  latestDate: string | null;
  windowMean: number | null;
  baselineMean: number | null;
  product: string;
}

export interface TerrainResult {
  elevation: number | null;
  slopePercent: number | null;
}

export const POWER_PARAMETERS = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "PRECTOTCORR",
  "GWETTOP",
  "GWETROOT",
] as const;

export const POWER_START = "20150401"; // start of the SMAP science record

async function fetchJson<T>(
  url: string,
  timeoutMs = 25000,
  headers: Record<string, string> = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export function formatYmd(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/* ------------------------------------------------------------------ */
/* NASA POWER                                                          */
/* ------------------------------------------------------------------ */

interface PowerResponse {
  properties?: { parameter?: Record<string, Record<string, number>> };
  header?: { fill_value?: number };
  messages?: string[];
}

export function buildPowerUrl(latitude: number, longitude: number, end: Date) {
  const query = new URLSearchParams({
    parameters: POWER_PARAMETERS.join(","),
    community: "AG",
    longitude: longitude.toFixed(4),
    latitude: latitude.toFixed(4),
    start: POWER_START,
    end: formatYmd(end),
    format: "JSON",
  });
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${query.toString()}`;
}

export function parsePower(json: PowerResponse): PowerDaily {
  const parameters = json.properties?.parameter;
  if (!parameters) {
    throw new Error(json.messages?.join(" ") || "Unexpected NASA POWER response");
  }

  const fill = json.header?.fill_value ?? -999;
  const dates = Object.keys(parameters.T2M ?? Object.values(parameters)[0] ?? {})
    .filter((key) => /^\d{8}$/.test(key))
    .sort();

  const series: Record<string, (number | null)[]> = {};
  for (const name of POWER_PARAMETERS) {
    const values = parameters[name] ?? {};
    series[name] = dates.map((date) => {
      const value = values[date];
      return typeof value === "number" && value !== fill && value > -900
        ? value
        : null;
    });
  }

  return { dates, series };
}

export async function fetchPowerDaily(latitude: number, longitude: number) {
  const end = new Date(Date.now() - 3 * 86400000);
  const json = await fetchJson<PowerResponse>(
    buildPowerUrl(latitude, longitude, end),
    45000,
  );
  return parsePower(json);
}

/* ------------------------------------------------------------------ */
/* ISRIC SoilGrids (soil attributes used by SMAP)                      */
/* ------------------------------------------------------------------ */

interface SoilGridsLayer {
  name: string;
  unit_measure?: { d_factor?: number };
  depths?: { label: string; values?: { mean?: number | null } }[];
}

interface SoilGridsResponse {
  properties?: { layers?: SoilGridsLayer[] };
}

export async function fetchSoilGrids(
  latitude: number,
  longitude: number,
): Promise<SoilProfile> {
  const query = new URLSearchParams({
    lon: longitude.toFixed(5),
    lat: latitude.toFixed(5),
    value: "mean",
  });
  ["bdod", "clay", "sand", "silt", "soc", "phh2o"].forEach((property) =>
    query.append("property", property),
  );
  ["0-5cm", "5-15cm", "15-30cm"].forEach((depth) => query.append("depth", depth));

  const json = await fetchJson<SoilGridsResponse>(
    `https://rest.isric.org/soilgrids/v2.0/properties/query?${query.toString()}`,
    25000,
  );

  const layers = json.properties?.layers ?? [];
  const read = (name: string, defaultFactor: number) => {
    const layer = layers.find((item) => item.name === name);
    if (!layer?.depths?.length) return null;
    const factor = layer.unit_measure?.d_factor ?? defaultFactor;
    // Thickness-weighted 0–30 cm mean (the 0–5 cm layer alone overstates organic carbon).
    const thickness: Record<string, number> = { "0-5cm": 5, "5-15cm": 10, "15-30cm": 15 };
    let total = 0;
    let weight = 0;
    layer.depths.forEach((depth) => {
      const value = depth.values?.mean;
      const w = thickness[depth.label] ?? 0;
      if (typeof value === "number" && w) {
        total += value * w;
        weight += w;
      }
    });
    return weight ? total / weight / factor : null;
  };

  const profile: SoilProfile = {
    bulkDensity: read("bdod", 100),
    clay: read("clay", 10),
    sand: read("sand", 10),
    silt: read("silt", 10),
    soc: read("soc", 10),
    ph: read("phh2o", 10),
  };

  if (Object.values(profile).every((value) => value === null)) {
    throw new Error("No soil data at this location (water, urban or outside coverage)");
  }
  return profile;
}

/* ------------------------------------------------------------------ */
/* MODIS NDVI via ORNL DAAC                                            */
/* ------------------------------------------------------------------ */

interface ModisSubset {
  scale?: string | number;
  subset?: { calendar_date: string; data: number[] }[];
}

const ORNL = "https://modis.ornl.gov/rst/api/v1";

/** MOD13Q1 composites start every 16 days from day 1 of each year. */
function compositeDoy(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = Math.floor((date.getTime() - start) / 86400000) + 1;
  return Math.floor((doy - 1) / 16) * 16 + 1;
}

const modisDate = (year: number, doy: number) => `A${year}${String(doy).padStart(3, "0")}`;

/** Two composites starting at `doy` (the ORNL service is slow; small requests succeed). */
function pairRange(year: number, doy: number): [string, string] {
  let endDoy = doy + 16;
  let endYear = year;
  if (endDoy > 353) {
    endDoy = 1;
    endYear += 1;
  }
  return [modisDate(year, doy), modisDate(endYear, endDoy)];
}

async function ndviForProduct(product: string, latitude: number, longitude: number): Promise<NdviResult> {
  const location = `latitude=${latitude.toFixed(5)}&longitude=${longitude.toFixed(5)}`;
  const subset = async ([from, to]: [string, string]) => {
    const json = await fetchJson<ModisSubset>(
      `${ORNL}/${product}/subset?${location}&band=250m_16_days_NDVI&startDate=${from}&endDate=${to}&kmAboveBelow=0&kmLeftRight=0`,
      90000,
    );
    const scale = Number(json.scale) || 0.0001;
    return (json.subset ?? [])
      .map((item) => ({ date: item.calendar_date, value: item.data?.[0] }))
      .filter((item) => typeof item.value === "number" && item.value > -2000)
      .map((item) => ({ date: item.date, value: (item.value as number) * scale }));
  };
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  // Latest composites are published ~3 weeks after they start.
  const anchor = new Date(Date.now() - 24 * 86400000);
  const year = anchor.getUTCFullYear();
  const doy = compositeDoy(anchor);
  const earlier = doy > 32 ? { year, doy: doy - 32 } : { year: year - 1, doy: doy + 320 };

  const requests = [
    subset(pairRange(earlier.year, earlier.doy)),
    subset(pairRange(year, Math.max(doy - 16, 1))),
    ...[1, 2, 3].map((back) => subset(pairRange(year - back, Math.max(doy - 16, 1)))),
  ];
  const results = await Promise.allSettled(requests);
  const values = (index: number) => (results[index].status === "fulfilled" ? (results[index] as PromiseFulfilledResult<{ date: string; value: number }[]>).value : []);

  const current = [...values(0), ...values(1)].sort((x, y) => x.date.localeCompare(y.date));
  const baseline = [2, 3, 4].flatMap(values).map((item) => item.value);
  const last = current[current.length - 1];
  if (!last) throw new Error(`${product}: no valid NDVI in the latest composites`);

  return {
    latest: last.value,
    latestDate: last.date,
    windowMean: mean(values(1).map((item) => item.value)) ?? mean(current.map((item) => item.value)),
    baselineMean: mean(baseline),
    product,
  };
}

export async function fetchNdvi(latitude: number, longitude: number) {
  try {
    return await ndviForProduct("MOD13Q1", latitude, longitude);
  } catch {
    // Terra is ageing; Aqua carries the same 16-day NDVI product.
    return ndviForProduct("MYD13Q1", latitude, longitude);
  }
}

/* ------------------------------------------------------------------ */
/* Terrain (Copernicus GLO-90 DEM via Open-Meteo)                       */
/* ------------------------------------------------------------------ */

interface ElevationResponse {
  elevation?: number[];
}

export async function fetchTerrain(
  latitude: number,
  longitude: number,
): Promise<TerrainResult> {
  const step = 90; // metres between samples (one DEM cell)
  const dLat = step / 111320;
  const dLon = step / (111320 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  const lats = [latitude, latitude + dLat, latitude - dLat, latitude, latitude];
  const lons = [longitude, longitude, longitude, longitude + dLon, longitude - dLon];

  const json = await fetchJson<ElevationResponse>(
    `https://api.open-meteo.com/v1/elevation?latitude=${lats.map((v) => v.toFixed(6)).join(",")}&longitude=${lons
      .map((v) => v.toFixed(6))
      .join(",")}`,
    20000,
  );
  const z = json.elevation ?? [];
  if (z.length < 5 || z.some((value) => typeof value !== "number" || Number.isNaN(value))) {
    throw new Error("No elevation for this location");
  }
  const [center, north, south, east, west] = z;
  const dzdy = (north - south) / (2 * step);
  const dzdx = (east - west) / (2 * step);

  return {
    elevation: center,
    slopePercent: Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100,
  };
}

/* ------------------------------------------------------------------ */
/* Country (for market context)                                        */
/* ------------------------------------------------------------------ */

interface NominatimResponse {
  address?: { country?: string; country_code?: string };
}

/** Reverse-geocodes the field to a country via OpenStreetMap Nominatim. */
export async function fetchCountry(latitude: number, longitude: number) {
  const json = await fetchJson<NominatimResponse>(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&accept-language=en&lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`,
    12000,
  );
  const code = json.address?.country_code;
  if (!code) throw new Error("No country at this location");
  return { code: code.toLowerCase(), name: json.address?.country ?? code.toUpperCase() };
}

/* ------------------------------------------------------------------ */
/* USDA NRCS SSURGO via Soil Data Access (United States only)          */
/* ------------------------------------------------------------------ */

export interface SsurgoResult {
  mapUnit: string | null;
  component: string | null;
  hydrologicGroup: string | null;
  drainage: string | null;
  organicMatter: number | null; // %
  ph: number | null;
  clay: number | null; // %
  sand: number | null; // %
  awc: number | null; // cm/cm available water capacity
  bulkDensity: number | null; // g/cm3
}

/** Rough continental-US check before calling the (slow) US-only service. */
export const inUnitedStates = (lat: number, lon: number) =>
  (lat >= 24.4 && lat <= 49.5 && lon >= -125 && lon <= -66.9) || (lat >= 51 && lat <= 71.5 && lon >= -170 && lon <= -129);

export async function fetchSsurgo(latitude: number, longitude: number): Promise<SsurgoResult> {
  const point = `point(${longitude.toFixed(6)} ${latitude.toFixed(6)})`;
  const query = `SELECT TOP 1 mu.muname, c.compname, c.hydgrp, c.drainagecl, ch.om_r, ch.ph1to1h2o_r, ch.claytotal_r, ch.sandtotal_r, ch.awc_r, ch.dbthirdbar_r
FROM mapunit mu
INNER JOIN component c ON c.mukey = mu.mukey AND c.majcompflag = 'Yes'
LEFT JOIN chorizon ch ON ch.cokey = c.cokey AND ch.hzdept_r = 0
WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${point}'))
ORDER BY c.comppct_r DESC`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch("https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, format: "JSON+COLUMNNAME" }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as { Table?: (string | null)[][] };
    const [header, row] = json.Table ?? [];
    if (!header || !row) throw new Error("No SSURGO soil map unit at this point");
    const get = (name: string) => row[header.indexOf(name)] ?? null;
    const num = (name: string) => {
      const value = get(name);
      return value === null || value === "" ? null : Number(value);
    };
    return {
      mapUnit: get("muname"),
      component: get("compname"),
      hydrologicGroup: get("hydgrp"),
      drainage: get("drainagecl"),
      organicMatter: num("om_r"),
      ph: num("ph1to1h2o_r"),
      clay: num("claytotal_r"),
      sand: num("sandtotal_r"),
      awc: num("awc_r"),
      bulkDensity: num("dbthirdbar_r"),
    };
  } finally {
    clearTimeout(timer);
  }
}
