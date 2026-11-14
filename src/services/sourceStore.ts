import type { SourceId, SourceStatus } from "../types";
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
};

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

function readCache(key: string): unknown | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { at, value } = JSON.parse(raw) as { at: number; value: unknown };
    return Date.now() - at < CACHE_HOURS * 3600000 ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
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

  if (id === "ssurgo" && !inUnitedStates(lat, lon)) {
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
      states.set(key, { status: "error", error: describeError(reason) });
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

export function sourceStatuses(snapshot: Record<SourceId, SourceState>): SourceStatus[] {
  return (Object.keys(SOURCE_INFO) as SourceId[])
    .filter((id) => id !== "country" && snapshot[id]?.status !== "na")
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
        detail:
          state.status === "ok"
            ? info.detail
            : state.status === "error"
              ? state.error ?? "Unavailable"
              : "Loading in the background…",
      };
    });
}
