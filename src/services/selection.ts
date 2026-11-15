import type { AreaUnit, FieldSelection } from "../types";

const KEY = "farmrotate:field";
const MAX_STORED_CHARS = 200_000;
const MAX_RINGS = 10;
const MAX_POINTS_PER_RING = 5_000;
const MAX_AREA_M2 = 1e11;

const UNITS: AreaUnit[] = ["m2", "ha", "km2", "acres", "ft2"];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: [number, number][][];
}

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function cleanPolygon(input: unknown): PolygonGeometry | null {
  const geometry =
    input && typeof input === "object" && (input as { type?: unknown }).type === "Feature"
      ? (input as { geometry?: unknown }).geometry
      : input;
  if (!geometry || typeof geometry !== "object") return null;
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown };
  if (type !== "Polygon" || !Array.isArray(coordinates)) return null;
  if (coordinates.length === 0 || coordinates.length > MAX_RINGS) return null;

  const rings: [number, number][][] = [];
  for (const ring of coordinates) {
    if (!Array.isArray(ring) || ring.length < 4 || ring.length > MAX_POINTS_PER_RING) return null;
    const points: [number, number][] = [];
    for (const point of ring) {
      if (!Array.isArray(point) || !isNumberIn(point[0], -180, 180) || !isNumberIn(point[1], -90, 90)) return null;
      points.push([point[0], point[1]]);
    }
    rings.push(points);
  }
  return { type: "Polygon", coordinates: rings };
}

export function cleanSelection(input: unknown): FieldSelection | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (!isNumberIn(value.latitude, -90, 90) || !isNumberIn(value.longitude, -180, 180)) return null;

  if (value.selectionType === "point") {
    return { selectionType: "point", latitude: value.latitude, longitude: value.longitude, area: 0 };
  }
  if (value.selectionType === "area") {
    const geoJson = cleanPolygon(value.geoJson);
    if (!geoJson || !isNumberIn(value.area, 0, MAX_AREA_M2)) return null;
    const areaUnit = UNITS.includes(value.areaUnit as AreaUnit) ? (value.areaUnit as AreaUnit) : undefined;
    return {
      selectionType: "area",
      latitude: value.latitude,
      longitude: value.longitude,
      area: value.area,
      ...(areaUnit ? { areaUnit } : {}),
      geoJson,
    };
  }
  return null;
}

export function readSelection(): FieldSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw || raw.length > MAX_STORED_CHARS) return null;
    return cleanSelection(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSelection(selection: FieldSelection | null) {
  try {
    const clean = selection ? cleanSelection(selection) : null;
    const raw = clean ? JSON.stringify(clean) : null;
    if (!raw || raw.length > MAX_STORED_CHARS) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, raw);
  } catch {
  }
}

export function outlineOf(selection: FieldSelection | null): [number, number][][] | null {
  if (!selection || selection.selectionType !== "area") return null;
  const polygon = cleanPolygon(selection.geoJson);
  return polygon ? polygon.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])) : null;
}
