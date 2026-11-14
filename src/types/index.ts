export type RiskLevel = "low" | "moderate" | "high";

export type PriorityId =
  | "water"
  | "soil"
  | "heat"
  | "erosion"
  | "pest"
  | "income";

export type IndicatorId =
  | "temperature"
  | "heatStress"
  | "rainfall"
  | "soilMoisture"
  | "evaporation"
  | "frostRisk"
  | "extremePrecipitation"
  | "vegetationStress"
  | "waterTrends"
  | "slopeErosion"
  | "soilProperties";

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

export type Confidence = "high" | "medium" | "low";

export type LayerId = "moisture" | "temperature" | "rain" | "vegetation" | "terrain" | "soil";

export type SourceId =
  | "power"
  | "ndvi"
  | "terrain"
  | "soil"
  | "ssurgo"
  | "country"
  | "era5"
  | "cmip6"
  | "sentinel2"
  | "groundwater"
  | "nass"
  | "openet";

export interface SourceStatus {
  id: string;
  name: string;
  provider: string;
  ok: boolean;
  /** Still loading (not a failure). */
  pending?: boolean;
  /** Needs configuration (API key / proxy) or does not apply here. */
  notApplicable?: boolean;
  /** Core sources affect data confidence; extras do not. */
  core?: boolean;
  detail: string;
  url?: string;
}

export interface MonthlyProfile {
  month: string;
  rootWetness: number | null;
  rainMm: number | null;
  frostDays: number;
  heatDays: number;
  tMean: number | null;
  tMax: number | null;
  tMin: number | null;
  et0: number | null;
}

export interface TrendPoint {
  year: number;
  value: number;
}

export interface Trend {
  id: string;
  label: string;
  unit: string;
  values: TrendPoint[];
  slopePerDecade: number;
  r2: number;
  significant: boolean;
  projectionYear: number;
  projection: number;
  low: number;
  high: number;
}

export interface SeasonOdds {
  dryGrowingSeasons: { count: number; of: number };
  hotYears: { count: number; of: number };
  lateFrostYears: { count: number; of: number };
}

export interface FarmerConstraints {
  irrigation: boolean;
  livestock: boolean;
  currentCrops: string[];
}

export interface RotationSegment {
  cropId: string;
  name: string;
  emoji: string;
  role: "main" | "second" | "cover";
  months: number[];
}

export interface RotationYear {
  label: string;
  segments: RotationSegment[];
  bareMonths: number[];
}

export interface ClimateData {
  meanTemperature: number | null;
  temperatureAnomaly: number | null;
  maxTemperature: number | null;
  heatStressDays: number | null;
  heatStressBaseline: number | null;
  frostDays: number | null;
  frostBaseline: number | null;
}

export interface WaterData {
  rainfall: number | null;
  rainfallAnomaly: number | null;
  heavyRainDays: number | null;
  surfaceWetness: number | null;
  rootZoneWetness: number | null;
  rootZoneAnomaly: number | null;
  rootZoneVolumetric: number | null;
  evapotranspiration: number | null;
  waterBalance: number | null;
  waterStress: number;
}

export interface VegetationData {
  ndvi: number | null;
  ndviAnomaly: number | null;
  vegetationStress: RiskLevel | null;
  date: string | null;
}

export interface SoilData {
  organicMatter: number | null;
  ph: number | null;
  clay: number | null;
  sand: number | null;
  silt: number | null;
  bulkDensity: number | null;
  porosity: number | null;
  soilType: string | null;
  slope: number | null;
  elevation: number | null;
  erosionRisk: RiskLevel;
  drainage: string | null;
  hydrologicGroup: string | null;
  awc: number | null;
  mapUnit: string | null;
  soilSource: "SSURGO" | "SoilGrids" | null;
}

export interface LandStatus {
  farmable: boolean;
  kind: "land" | "water-or-ice" | "no-soil" | "too-cold";
  title: string | null;
  reason: string | null;
}

export interface AnalysisExtras {
  era5: import("../services/extraSources").Era5Result | null;
  projection: import("../services/extraSources").ProjectionResult | null;
  sentinel2: import("../services/extraSources").Sentinel2Result | null;
  groundwater: import("../services/extraSources").GroundwaterResult | null;
  usdaYields: import("../services/extraSources").NassResult | null;
  openet: import("../services/extraSources").OpenEtResult | null;
}

export interface FieldAnalysis {
  latitude: number;
  longitude: number;
  period: { start: string; end: string; baselineStart: string };
  climate: ClimateData;
  water: WaterData;
  vegetation: VegetationData;
  soil: SoilData;
  monthly: MonthlyProfile[];
  /** Daily Tmax / Tmin samples per calendar month, for scenario recounts. */
  dailyByMonth: { tmax: number[][]; tmin: number[][]; years: number };
  trends: Trend[];
  odds: SeasonOdds;
  country: { code: string; name: string; state?: string; stateCode?: string; county?: string } | null;
  /** Results from the additional sources (null while loading or unavailable). */
  extras: AnalysisExtras;
  /** null when the point is not farmable (see landStatus). */
  resilienceScore: number | null;
  landStatus: LandStatus;
  confidence: Confidence;
  caveats: string[];
  sources: SourceStatus[];
  generatedAt: string;
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
  evidence?: string[];
  infoGaps?: string[];
  strategy?: string;
  fit?: number;
  calendar?: RotationYear[];
  assumed?: boolean;
  confidence: Confidence;
  recommended: boolean;
}
