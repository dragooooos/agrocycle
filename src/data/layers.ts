import type { LayerId, SourceId } from "../types";

export interface LayerOption {
  id: LayerId;
  label: string;
  description: string;
  sources: SourceId[];
  emoji: string;
}

/** What the farmer can choose to see, and which data sources each choice needs. */
export const LAYERS: LayerOption[] = [
  { id: "moisture", label: "Soil moisture", emoji: "💧", description: "Surface and root-zone wetness (NASA POWER, SMAP layers)", sources: ["power"] },
  { id: "temperature", label: "Temperature, heat & frost", emoji: "🌡️", description: "Mean temperature, hot days and frost days (NASA POWER)", sources: ["power"] },
  { id: "rain", label: "Rainfall & water balance", emoji: "🌧️", description: "Rain, evaporation demand and heavy-rain days (NASA POWER)", sources: ["power"] },
  { id: "vegetation", label: "Vegetation health", emoji: "🌿", description: "Crop greenness from MODIS NDVI (slow service, ~1 min)", sources: ["ndvi"] },
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

export function readLayers(): LayerId[] {
  try {
    const raw = sessionStorage.getItem("farmrotate:layers");
    const parsed = raw ? (JSON.parse(raw) as LayerId[]) : null;
    if (parsed && parsed.length) return parsed.filter((id) => ALL_LAYERS.includes(id));
  } catch {
    // ignore
  }
  return DEFAULT_LAYERS;
}

export function saveLayers(layers: LayerId[]) {
  try {
    sessionStorage.setItem("farmrotate:layers", JSON.stringify(layers));
  } catch {
    // ignore
  }
}
