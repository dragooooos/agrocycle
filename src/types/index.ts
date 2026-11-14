export type RiskLevel = "low" | "moderate" | "high";

export type PriorityId =
  | "water"
  | "soil"
  | "heat"
  | "erosion"
  | "pest"
  | "income";

export type SelectionType = "point" | "area";

export type AreaUnit =
  | "m2"
  | "ha"
  | "km2"
  | "acres"
  | "ft2";

export interface FieldSelection {
  area: number;
  latitude: number;
  longitude: number;
  selectionType: SelectionType;
  areaUnit?: AreaUnit;
  geoJson?: unknown;
}

export interface ClimateData {
  meanTemperature: number;
  temperatureAnomaly: number;
  maxTemperature: number;
  heatStressDays: number;
  frostDays: number;
}

export interface WaterData {
  rainfall: number;
  rainfallAnomaly: number;
  soilMoisture: number;
  soilMoistureAnomaly: number;
  evapotranspiration: number;
  waterStress: number;
}

export interface VegetationData {
  ndvi: number;
  ndviAnomaly: number;
  vegetationStress: RiskLevel;
}

export interface SoilData {
  organicMatter: number;
  ph: number;
  soilType: string;
  slope: number;
  erosionRisk: RiskLevel;
}

export interface FieldData {
  area: number;
  climate: ClimateData;
  water: WaterData;
  vegetation: VegetationData;
  soil: SoilData;
  resilienceScore: number;
}

export interface Rotation {
  id: string;
  name: string;
  crops: string[];
  score: number;
  water: number;
  soil: number;
  heat: number;
  erosion: number;
  pest: number;
  market: number;
  explanation: string;
  benefits: string[];
  risks: string[];
  confidence: "high" | "medium" | "low";
  recommended: boolean;
}
