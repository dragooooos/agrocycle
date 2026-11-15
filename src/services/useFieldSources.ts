import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceId } from "../types";
import { getSourceState, hasNoSoil, resetSource, startSource, type SourceState } from "./sourceStore";

const ALL: SourceId[] = [
  "power",
  "country",
  "soil",
  "ssurgo",
  "terrain",
  "ndvi",
  "era5",
  "sentinel2",
  "cmip6",
  "groundwater",
  "nass",
  "openet",
];

/**
 * Starts a source unless it already failed for this location in this session.
 * Moving between the map and the analysis page then sends no new requests for
 * an unchanged selection; failed sources are retried with `retry` (the page's
 * Retry button) or after a reload.
 */
const startUnlessFailed = (id: SourceId, lat: number, lon: number) =>
  getSourceState(id, lat, lon).status === "error" ? Promise.resolve() : startSource(id, lat, lon);

const snapshotOf = (lat: number, lon: number) =>
  Object.fromEntries(ALL.map((id) => [id, getSourceState(id, lat, lon)])) as Record<SourceId, SourceState>;

/**
 * Loading order:
 * 1. Soil first (~1 s). If no soil is mapped at the point (ocean, sea, lake,
 *    ice, built-up area) nothing else is fetched: there is nothing to farm.
 * 2. Otherwise the sources behind the farmer's chosen layers.
 * 3. Once the climate data is in, every other source in the background, so
 *    extra layers appear instantly when switched on.
 * If the soil service itself fails (network, outage), loading continues and
 * the land check falls back to NASA POWER.
 *
 * `priority` only decides what loads first. Changing it (toggling indicators on
 * the analysis page) never restarts loading: it only starts sources that have
 * not been requested yet. Loaded, loading and failed sources are left alone;
 * failed ones are retried only through `retry`.
 */
export function useFieldSources(lat: number | undefined, lon: number | undefined, priority: SourceId[]) {
  const [snapshot, setSnapshot] = useState<Record<SourceId, SourceState> | null>(null);
  const priorityKey = priority.join(",");
  // Read inside the loading sequence without making it re-run when the selection changes.
  const priorityRef = useRef(priority);
  priorityRef.current = priority;

  // Full loading sequence: once per location.
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let active = true;
    const refresh = () => {
      if (active) setSnapshot(snapshotOf(lat, lon));
    };

    refresh();
    startUnlessFailed("soil", lat, lon).finally(() => {
      refresh();
      if (!active || hasNoSoil(lat, lon)) return;

      const chosen = priorityRef.current;
      const first = ALL.filter((id) => id !== "soil" && chosen.includes(id));
      const rest = ALL.filter((id) => id !== "soil" && !chosen.includes(id));
      first.forEach((id) => startUnlessFailed(id, lat, lon).finally(refresh));
      startUnlessFailed("power", lat, lon).finally(() => {
        if (!active) return;
        rest.forEach((id) => startUnlessFailed(id, lat, lon).finally(refresh));
        refresh();
      });
    });

    return () => {
      active = false;
    };
  }, [lat, lon]);

  // A newly selected layer whose sources were still queued (waiting for the climate
  // data) starts straight away. Sources that were ever requested are not touched.
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const soil = getSourceState("soil", lat, lon).status;
    // Before the land check has settled, the sequence above decides what to load.
    if (soil === "idle" || soil === "loading" || hasNoSoil(lat, lon)) return;
    let active = true;
    priority
      .filter((id) => getSourceState(id, lat, lon).status === "idle")
      .forEach((id) =>
        startSource(id, lat, lon).finally(() => {
          if (active) setSnapshot(snapshotOf(lat, lon));
        }),
      );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, priorityKey]);

  const retry = useCallback(
    (id: SourceId) => {
      if (lat === undefined || lon === undefined) return;
      resetSource(id, lat, lon);
      startSource(id, lat, lon).finally(() => setSnapshot(snapshotOf(lat, lon)));
      setSnapshot(snapshotOf(lat, lon));
    },
    [lat, lon],
  );

  return { snapshot, retry };
}
