import { useCallback, useEffect, useState } from "react";
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
 */
export function useFieldSources(lat: number | undefined, lon: number | undefined, priority: SourceId[]) {
  const [snapshot, setSnapshot] = useState<Record<SourceId, SourceState> | null>(null);
  const priorityKey = priority.join(",");

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let active = true;
    const refresh = () => {
      if (active) setSnapshot(snapshotOf(lat, lon));
    };

    refresh();
    startSource("soil", lat, lon).finally(() => {
      refresh();
      if (!active || hasNoSoil(lat, lon)) return;

      const first = ALL.filter((id) => id !== "soil" && priority.includes(id));
      const rest = ALL.filter((id) => id !== "soil" && !priority.includes(id));
      first.forEach((id) => startSource(id, lat, lon).finally(refresh));
      startSource("power", lat, lon).finally(() => {
        if (!active) return;
        rest.forEach((id) => startSource(id, lat, lon).finally(refresh));
        refresh();
      });
    });

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
