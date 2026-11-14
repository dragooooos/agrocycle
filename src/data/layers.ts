import type { IndicatorId, LayerId, SourceId } from "../types";

export interface LayerOption {
  id: LayerId;
  label: string;
  description: string;
  sources: SourceId[];
  emoji: string;
}

/** What the farmer can choose to see, and which data sources each choice needs. */
export const LAYERS: LayerOption[] = [
  { id: "moisture", label: "Soil moisture", emoji: "💧", description: "Surface and root-zone wetness (NASA POWER, SMAP layers; ERA5-Land check; US groundwater)", sources: ["power", "era5", "groundwater"] },
  { id: "temperature", label: "Temperature, heat & frost", emoji: "🌡️", description: "Mean temperature, hot days and frost days (NASA POWER)", sources: ["power"] },
  { id: "rain", label: "Rainfall & water balance", emoji: "🌧️", description: "Rain, evaporation demand and heavy-rain days (NASA POWER; OpenET in the US)", sources: ["power", "openet"] },
  { id: "vegetation", label: "Vegetation health", emoji: "🌿", description: "Crop greenness from MODIS NDVI (slow service, ~1 min) and recent Sentinel-2 passes", sources: ["ndvi", "sentinel2"] },
  { id: "terrain", label: "Slope & erosion", emoji: "⛰️", description: "Elevation and slope from a 90 m elevation model", sources: ["terrain"] },
  { id: "soil", label: "Soil properties", emoji: "🟫", description: "Texture, organic matter and pH (SoilGrids; USDA SSURGO in the US)", sources: ["soil", "ssurgo"] },
];

export const ALL_LAYERS = LAYERS.map((layer) => layer.id);
export const DEFAULT_LAYERS: LayerId[] = ["moisture", "temperature", "rain"];

export function sourcesFor(layers: LayerId[]): SourceId[] {
  const set = new Set<SourceId>(["power", "country"]); // climate is always needed for crop recommendations
  layers.forEach((id) => LAYERS.find((layer) => layer.id === id)?.sources.forEach((source) => set.add(source)));
  return [...set];
}

/** Map-page indicators → analysis layers (several indicators share one data source). */
export const INDICATOR_LAYER: Record<IndicatorId, LayerId> = {
  temperature: "temperature",
  heatStress: "temperature",
  frostRisk: "temperature",
  rainfall: "rain",
  evaporation: "rain",
  extremePrecipitation: "rain",
  soilMoisture: "moisture",
  waterTrends: "moisture",
  vegetationStress: "vegetation",
  slopeErosion: "terrain",
  soilProperties: "soil",
};

export const DEFAULT_INDICATORS: IndicatorId[] = ["temperature", "rainfall", "soilMoisture"];

export function layersFromIndicators(indicators: IndicatorId[]): LayerId[] {
  return ALL_LAYERS.filter((layer) => indicators.some((id) => INDICATOR_LAYER[id] === layer));
}

export function readIndicators(): IndicatorId[] {
  try {
    const raw = sessionStorage.getItem("farmrotate:indicators");
    const parsed = raw ? (JSON.parse(raw) as IndicatorId[]) : null;
    if (parsed) return parsed.filter((id) => id in INDICATOR_LAYER);
  } catch {
    // ignore
  }
  return DEFAULT_INDICATORS;
}

/** Layers chosen on the map page (via its indicators), never empty. */
export function readLayers(): LayerId[] {
  const layers = layersFromIndicators(readIndicators());
  return layers.length ? layers : DEFAULT_LAYERS;
}

/** Keeps the map-page indicator selection in sync when layers are toggled on the analysis page. */
export function saveLayers(layers: LayerId[]) {
  try {
    const current = readIndicators();
    const kept = current.filter((id) => layers.includes(INDICATOR_LAYER[id]));
    const added = layers
      .filter((layer) => !kept.some((id) => INDICATOR_LAYER[id] === layer))
      .flatMap((layer) => (Object.keys(INDICATOR_LAYER) as IndicatorId[]).filter((id) => INDICATOR_LAYER[id] === layer));
    sessionStorage.setItem("farmrotate:indicators", JSON.stringify([...kept, ...added]));
  } catch {
    // ignore
  }
}
