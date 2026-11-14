import { useCallback, useEffect, useState } from "react";
import type { SourceId } from "../types";
import { getSourceState, resetSource, startSource, type SourceState } from "./sourceStore";

const ALL: SourceId[] = ["power", "country", "soil", "ssurgo", "terrain", "ndvi"];

const snapshotOf = (lat: number, lon: number) =>
  Object.fromEntries(ALL.map((id) => [id, getSourceState(id, lat, lon)])) as Record<SourceId, SourceState>;

/**
 * Loads the sources behind the farmer's chosen layers first, then fetches
 * every other source in the background so extra layers appear instantly.
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

    const first = ALL.filter((id) => priority.includes(id));
    const rest = ALL.filter((id) => !priority.includes(id));
    first.forEach((id) => startSource(id, lat, lon).finally(refresh));
    // Background sources start once the climate data (needed for the analysis) is in.
    startSource("power", lat, lon).finally(() => {
      rest.forEach((id) => startSource(id, lat, lon).finally(refresh));
      refresh();
    });
    refresh();

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
