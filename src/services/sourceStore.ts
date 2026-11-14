import type { SourceId, SourceStatus } from "../types";
import {
  fetchClimateProjection,
  fetchEra5Land,
  fetchGroundwater,
  fetchNassYields,
  fetchOpenEt,
  fetchSentinel2,
} from "./extraSources";
import type { PlaceResult } from "./nasaData";
import {
  fetchCountry,
  fetchNdvi,
  fetchPowerDaily,
  fetchSoilGrids,
  fetchSsurgo,
  fetchTerrain,
  inUnitedStates,
} from "./nasaData";

/**
 * Per-source fetch store. Each source is fetched at most once per location
 * (requests are shared between pages and re-renders) and cached in
 * sessionStorage for 12 hours, so switching layers on or off is instant.
 */

export type SourceStatusKind = "idle" | "loading" | "ok" | "error" | "na";

export interface SourceState {
  status: SourceStatusKind;
  value?: unknown;
  error?: string;
  /** Error class name, e.g. "NoSoilError" (used for the land check). */
  kind?: string;
  startedAt?: number;
}

const CACHE_PREFIX = "agrocycle:src:v1:";
const CACHE_HOURS = 12;

const FETCHERS: Record<SourceId, (lat: number, lon: number) => Promise<unknown>> = {
  power: fetchPowerDaily,
  ndvi: fetchNdvi,
  terrain: fetchTerrain,
  soil: fetchSoilGrids,
  ssurgo: fetchSsurgo,
  country: fetchCountry,
  era5: fetchEra5Land,
  cmip6: fetchClimateProjection,
  sentinel2: fetchSentinel2,
  groundwater: fetchGroundwater,
  // County yields need the county name, so wait for the place lookup first.
  nass: async (lat, lon) => {
    await startSource("country", lat, lon);
    const place = getSourceState("country", lat, lon);
    return fetchNassYields(place.status === "ok" ? (place.value as PlaceResult) : null);
  },
  openet: fetchOpenEt,
};

/** Sources that only exist inside the United States. */
const US_ONLY: SourceId[] = ["ssurgo", "groundwater", "nass", "openet"];

export const SOURCE_INFO: Record<SourceId, { name: string; provider: string; url: string; detail: string }> = {
  power: {
    name: "NASA POWER",
    provider: "NASA LaRC · MERRA-2 / GEOS",
    url: "https://power.larc.nasa.gov/",
    detail: "Daily temperature, precipitation, surface (0–5 cm) and root-zone (0–100 cm) soil wetness since April 2015.",
  },
  ndvi: {
    name: "MODIS NDVI",
    provider: "NASA ORNL DAAC",
    url: "https://modis.ornl.gov/",
    detail: "MOD13Q1 250 m, 16-day vegetation index composites.",
  },
  terrain: {
    name: "Elevation & slope",
    provider: "Copernicus GLO-90 DEM via Open-Meteo",
    url: "https://open-meteo.com/en/docs/elevation-api",
    detail: "Elevation and local slope from five samples 90 m apart (NASA SRTM services need an Earthdata login).",
  },
  soil: {
    name: "SoilGrids",
    provider: "ISRIC · soil source used by SMAP",
    url: "https://soilgrids.org/",
    detail: "Bulk density, texture, organic carbon and pH for 0–30 cm at 250 m.",
  },
  ssurgo: {
    name: "USDA Web Soil Survey",
    provider: "NRCS SSURGO via Soil Data Access",
    url: "https://websoilsurvey.nrcs.usda.gov/app/",
    detail: "Field-scale soil map unit: drainage, hydrologic group, organic matter, pH, texture and water-holding capacity.",
  },
  era5: {
    name: "ERA5-Land soil moisture",
    provider: "Copernicus Climate Change Service (CDS) via Open-Meteo",
    url: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    detail: "Independent reanalysis of soil moisture (0–7 cm and 28–100 cm, m³/m³) since 2015, ~9 km.",
  },
  cmip6: {
    name: "CMIP6 climate projections",
    provider: "HighResMIP models via Open-Meteo (downscaled with ERA5-Land)",
    url: "https://open-meteo.com/en/docs/climate-api",
    detail: "Three high-resolution models, 2041–2050 vs 1995–2014, high-emission pathway (closest to RCP8.5).",
  },
  sentinel2: {
    name: "Sentinel-2 passes",
    provider: "Copernicus Data Space Ecosystem (STAC)",
    url: "https://dataspace.copernicus.eu/",
    detail: "Recent cloud-free (< 20%) Sentinel-2 L2A images over the field, with a link to view them.",
  },
  groundwater: {
    name: "Groundwater wells",
    provider: "USGS Water Data (OGC API)",
    url: "https://waterdata.usgs.gov/",
    detail: "Depth-to-water measurements from the nearest well with a multi-year record.",
  },
  nass: {
    name: "USDA county yields",
    provider: "USDA NASS Quick Stats (via local proxy)",
    url: "https://quickstats.nass.usda.gov/",
    detail: "Surveyed county yields for the main crops over the last decade.",
  },
  openet: {
    name: "OpenET water use",
    provider: "OpenET ensemble (via local proxy)",
    url: "https://etdata.org/",
    detail: "Satellite-based actual evapotranspiration for the last full year, by month.",
  },
  country: {
    name: "Country",
    provider: "OpenStreetMap Nominatim",
    url: "https://nominatim.openstreetmap.org/",
    detail: "Used only to judge which crops are common locally.",
  },
};

const keyOf = (id: SourceId, lat: number, lon: number) => `${id}:${lat.toFixed(3)},${lon.toFixed(3)}`;

const states = new Map<string, SourceState>();
const promises = new Map<string, Promise<void>>();

/** Climate projections do not change, so they are kept for 30 days across visits. */
const LONG_CACHE = ["cmip6"];
const storageFor = (key: string) => (LONG_CACHE.some((id) => key.startsWith(`${id}:`)) ? localStorage : sessionStorage);
const maxAgeFor = (key: string) => (LONG_CACHE.some((id) => key.startsWith(`${id}:`)) ? 30 * 24 : CACHE_HOURS) * 3600000;

function readCache(key: string): unknown | undefined {
  try {
    const raw = storageFor(key).getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { at, value } = JSON.parse(raw) as { at: number; value: unknown };
    return Date.now() - at < maxAgeFor(key) ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    storageFor(key).setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Storage full: the data still works for this page view.
  }
}

const describeError = (reason: unknown) =>
  reason instanceof Error
    ? reason.name === "AbortError"
      ? "The service did not answer in time"
      : reason.message
    : "Request failed";

export function getSourceState(id: SourceId, lat: number, lon: number): SourceState {
  const key = keyOf(id, lat, lon);
  const known = states.get(key);
  if (known) return known;
  const cached = readCache(key);
  if (cached !== undefined) {
    const state: SourceState = { status: "ok", value: cached };
    states.set(key, state);
    return state;
  }
  return { status: "idle" };
}

/** Starts (or reuses) the fetch for one source. Resolves when it settles. */
export function startSource(id: SourceId, lat: number, lon: number): Promise<void> {
  const key = keyOf(id, lat, lon);
  const current = getSourceState(id, lat, lon);
  if (current.status === "ok" || current.status === "na") return Promise.resolve();
  const running = promises.get(key);
  if (running) return running;

  if (US_ONLY.includes(id) && !inUnitedStates(lat, lon)) {
    states.set(key, { status: "na", error: "Only available inside the United States" });
    return Promise.resolve();
  }

  states.set(key, { status: "loading", startedAt: Date.now() });
  const promise = FETCHERS[id](lat, lon)
    .then((value) => {
      states.set(key, { status: "ok", value });
      writeCache(key, value);
    })
    .catch((reason: unknown) => {
      // Missing API key / proxy is a configuration state, not a failure.
      const notConfigured = reason instanceof Error && reason.name === "NotConfiguredError";
      states.set(key, {
        status: notConfigured ? "na" : "error",
        error: describeError(reason),
        kind: reason instanceof Error ? reason.name : undefined,
      });
    })
    .finally(() => {
      promises.delete(key);
    });
  promises.set(key, promise);
  return promise;
}

/** Clears a failed source so it can be retried. */
export function resetSource(id: SourceId, lat: number, lon: number) {
  states.delete(keyOf(id, lat, lon));
}

const CORE: SourceId[] = ["power", "ndvi", "terrain", "soil", "ssurgo"];

export function sourceStatuses(snapshot: Record<SourceId, SourceState>): SourceStatus[] {
  return (Object.keys(SOURCE_INFO) as SourceId[])
    .filter((id) => id !== "country")
    // Hide US-only sources outside the US; keep "needs an API key" so the farmer knows why.
    .filter((id) => !(snapshot[id]?.status === "na" && snapshot[id]?.error?.startsWith("Only available")))
    .map((id) => {
      const state = snapshot[id] ?? { status: "idle" };
      const info = SOURCE_INFO[id];
      return {
        id,
        name: info.name,
        provider: info.provider,
        url: info.url,
        ok: state.status === "ok",
        pending: state.status === "loading" || state.status === "idle",
        notApplicable: state.status === "na",
        core: CORE.includes(id),
        detail:
          state.status === "ok"
            ? info.detail
            : state.status === "error" || state.status === "na"
              ? state.error ?? "Unavailable"
              : "Loading in the background…",
      };
    });
}

/** True when SoilGrids answered and has no soil mapped at this point (water, ice or built-up land). */
export function hasNoSoil(lat: number, lon: number) {
  const soil = getSourceState("soil", lat, lon);
  return soil.status === "error" && soil.kind === "NoSoilError";
}
