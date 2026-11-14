import type {
  AnalysisExtras,
  Confidence,
  FieldAnalysis,
  LandStatus,
  MonthlyProfile,
  RiskLevel,
  SeasonOdds,
  SourceStatus,
  Trend,
} from "../types";
import type {
  NdviResult,
  PowerDaily,
  SoilProfile,
  SsurgoResult,
  TerrainResult,
} from "../services/nasaData";
import { SMAP_FACTS } from "../data/smapLibrary";

/** Thresholds used by the indicators (shown in the UI next to each value). */
export const THRESHOLDS = {
  heatDayC: 32,
  frostDayC: 0,
  heavyRainMm: 20,
  windowDays: 365,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export const ymdToIso = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

/* ------------------------------------------------------------------ */
/* Reference evapotranspiration (FAO-56 Hargreaves)                    */
/* ------------------------------------------------------------------ */

function dayOfYear(ymd: string) {
  const date = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
  const start = Date.UTC(+ymd.slice(0, 4), 0, 0);
  return Math.round((date - start) / 86400000);
}

/** Extraterrestrial radiation, MJ m-2 day-1 (FAO-56 eq. 21). */
export function extraterrestrialRadiation(latitude: number, doy: number) {
  const phi = (latitude * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(delta), -1, 1));
  return (
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

export function hargreavesEt0(latitude: number, ymd: string, tmean: number, tmax: number, tmin: number) {
  const ra = extraterrestrialRadiation(latitude, dayOfYear(ymd));
  return Math.max(0, 0.0023 * 0.408 * ra * (tmean + 17.8) * Math.sqrt(Math.max(tmax - tmin, 0)));
}

/* ------------------------------------------------------------------ */
/* Window helpers                                                      */
/* ------------------------------------------------------------------ */

function lastValidIndex(values: (number | null)[]) {
  for (let i = values.length - 1; i >= 0; i -= 1) if (values[i] !== null) return i;
  return -1;
}

type Aggregate = "mean" | "sum" | "max" | "countGte" | "countLte";

function aggregate(values: (number | null)[], from: number, to: number, kind: Aggregate, threshold = 0) {
  const slice = values.slice(Math.max(from, 0), to + 1).filter((v): v is number => v !== null);
  // Require 80% coverage so a gappy window is not mistaken for a dry/cool one.
  if (slice.length < (to - from + 1) * 0.8) return null;
  switch (kind) {
    case "mean":
      return mean(slice);
    case "sum":
      return slice.reduce((s, v) => s + v, 0);
    case "max":
      return Math.max(...slice);
    case "countGte":
      return slice.filter((v) => v >= threshold).length;
    case "countLte":
      return slice.filter((v) => v <= threshold).length;
  }
}

/** Value for the latest 365-day window plus the mean of earlier, same-length windows. */
function windowWithBaseline(
  values: (number | null)[],
  endIndex: number,
  kind: Aggregate,
  threshold = 0,
) {
  const length = THRESHOLDS.windowDays;
  const current = aggregate(values, endIndex - length + 1, endIndex, kind, threshold);
  const previous: number[] = [];
  for (let end = endIndex - length; end - length + 1 >= 0; end -= length) {
    const value = aggregate(values, end - length + 1, end, kind, threshold);
    if (value !== null) previous.push(value);
  }
  return { current, baseline: mean(previous), years: previous.length };
}

/* ------------------------------------------------------------------ */
/* Soil helpers                                                        */
/* ------------------------------------------------------------------ */

/** USDA texture class from sand / silt / clay percentages. */
export function textureClass(sand: number, silt: number, clay: number) {
  if (silt + 1.5 * clay < 15) return "Sand";
  if (silt + 1.5 * clay < 30) return "Loamy sand";
  if ((clay >= 7 && clay < 20 && sand > 52) || (clay < 7 && silt < 50)) return "Sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "Loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "Silt loam";
  if (silt >= 80 && clay < 12) return "Silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "Sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "Clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "Silty clay loam";
  if (clay >= 35 && sand > 45) return "Sandy clay";
  if (clay >= 40 && silt >= 40) return "Silty clay";
  return "Clay";
}

/* ------------------------------------------------------------------ */
/* Main builder                                                        */
/* ------------------------------------------------------------------ */

export interface AnalysisInputs {
  latitude: number;
  longitude: number;
  power: PowerDaily;
  soil: SoilProfile | null;
  ssurgo?: SsurgoResult | null;
  ndvi: NdviResult | null;
  terrain: TerrainResult | null;
  country: FieldAnalysis["country"];
  extras?: Partial<AnalysisExtras>;
  /** SoilGrids answered but has no soil mapped at this point (and no USDA soil map either). */
  noSoil?: boolean;
  sources: SourceStatus[];
}

/**
 * Is there farmland here at all? Uses signals verified against oceans, seas,
 * ice sheets, lakes and cities:
 * - NASA POWER has no soil wetness at all over open water and permanent ice;
 * - SoilGrids maps no soil on water bodies, glaciers and built-up land;
 * - field crops need at least 3 months with a mean temperature of 5 °C or more.
 */
export function landStatus(rootWetness: (number | null)[], monthlyMeanT: (number | null)[], noSoil: boolean): LandStatus {
  if (!rootWetness.some((value) => value !== null)) {
    return {
      farmable: false,
      kind: "water-or-ice",
      title: "No land surface here",
      reason:
        "NASA's land model has no soil at this point: it is open water (ocean, sea, large lake) or a permanent ice sheet. There is nothing to plant, so no resilience score or rotation is given.",
    };
  }
  if (noSoil) {
    return {
      farmable: false,
      kind: "no-soil",
      title: "No farmland at this point",
      reason:
        "No soil is mapped here (SoilGrids). The point is most likely a lake, river, glacier or built-up area. Move the marker onto a field to get an analysis.",
    };
  }
  const growingMonths = monthlyMeanT.filter((t) => t !== null && t >= 5).length;
  if (growingMonths < 3) {
    return {
      farmable: false,
      kind: "too-cold",
      title: "Too cold for field crops",
      reason: `Only ${growingMonths} month${growingMonths === 1 ? "" : "s"} a year average 5 °C or more. No field crop can complete a season here (ice, tundra or high mountains).`,
    };
  }
  return { farmable: true, kind: "land", title: null, reason: null };
}

export function buildFieldAnalysis(input: AnalysisInputs): FieldAnalysis {
  const { power, ndvi, terrain, latitude, longitude } = input;
  const ssurgo = input.ssurgo ?? null;
  // Field-scale USDA SSURGO values (US only) take precedence over 250 m SoilGrids.
  const soil: SoilProfile | null =
    ssurgo || input.soil
      ? {
          bulkDensity: ssurgo?.bulkDensity ?? input.soil?.bulkDensity ?? null,
          clay: ssurgo?.clay ?? input.soil?.clay ?? null,
          sand: ssurgo?.sand ?? input.soil?.sand ?? null,
          silt:
            ssurgo?.clay != null && ssurgo?.sand != null
              ? Math.max(0, 100 - ssurgo.clay - ssurgo.sand)
              : input.soil?.silt ?? null,
          // SoilGrids gives organic carbon (g/kg); SSURGO organic matter (%) is converted back.
          soc: ssurgo?.organicMatter != null ? (ssurgo.organicMatter / 1.724) * 10 : input.soil?.soc ?? null,
          ph: ssurgo?.ph ?? input.soil?.ph ?? null,
        }
      : null;
  const { dates, series } = power;
  const t2m = series.T2M;
  const tmax = series.T2M_MAX;
  const tmin = series.T2M_MIN;
  const rain = series.PRECTOTCORR;
  const top = series.GWETTOP;
  const root = series.GWETROOT;

  // Temperature/rain windows end at the last date with valid temperature;
  // soil wetness (MERRA-2 based) can lag, so it uses its own last valid date.
  const metEnd = lastValidIndex(t2m);
  const wetEnd = lastValidIndex(root);
  if (metEnd < THRESHOLDS.windowDays) {
    throw new Error("NASA POWER returned less than one year of data for this location");
  }

  const et0 = dates.map((date, i) =>
    t2m[i] !== null && tmax[i] !== null && tmin[i] !== null
      ? hargreavesEt0(latitude, date, t2m[i] as number, tmax[i] as number, tmin[i] as number)
      : null,
  );

  const temperature = windowWithBaseline(t2m, metEnd, "mean");
  const maxTemp = aggregate(tmax, metEnd - 364, metEnd, "max");
  const heat = windowWithBaseline(tmax, metEnd, "countGte", THRESHOLDS.heatDayC);
  const frost = windowWithBaseline(tmin, metEnd, "countLte", THRESHOLDS.frostDayC);
  const rainfall = windowWithBaseline(rain, metEnd, "sum");
  const heavy = aggregate(rain, metEnd - 364, metEnd, "countGte", THRESHOLDS.heavyRainMm);
  const et0Sum = aggregate(et0, metEnd - 364, metEnd, "sum");

  const rootZone = wetEnd >= 0 ? windowWithBaseline(root, wetEnd, "mean") : null;
  const surface = wetEnd >= 0 ? aggregate(top, wetEnd - 364, wetEnd, "mean") : null;

  const pctChange = (current: number | null, baseline: number | null) =>
    current !== null && baseline ? round(((current - baseline) / baseline) * 100) : null;

  const rootWet = rootZone?.current ?? null;
  const rootAnomaly = pctChange(rootWet, rootZone?.baseline ?? null);

  // Soil attributes and porosity (SMAP: porosity = 1 - BD / 2.65).
  const porosity =
    soil?.bulkDensity ? clamp(1 - soil.bulkDensity / SMAP_FACTS.particleDensity, 0.2, 0.8) : null;
  const organicMatter = soil?.soc !== null && soil?.soc !== undefined ? (soil.soc / 10) * 1.724 : null;
  const soilType =
    soil?.sand !== null && soil?.silt !== null && soil?.clay !== null && soil
      ? textureClass(soil.sand as number, soil.silt as number, soil.clay as number)
      : null;

  // Water stress index (0-100).
  const dryness = rootWet !== null ? clamp((0.75 - rootWet) / 0.45) : 0.5;
  const deficit =
    et0Sum && rainfall.current !== null ? clamp((et0Sum - rainfall.current) / et0Sum) : 0.5;
  const anomalyTerm = rootAnomaly !== null ? clamp(-rootAnomaly / 30) : 0;
  const waterStress = Math.round(100 * (0.5 * dryness + 0.3 * deficit + 0.2 * anomalyTerm));

  // Vegetation.
  const ndviAnomaly =
    ndvi?.windowMean !== null && ndvi?.windowMean !== undefined && ndvi.baselineMean
      ? round(((ndvi.windowMean - ndvi.baselineMean) / ndvi.baselineMean) * 100)
      : null;
  const vegetationStress: RiskLevel | null =
    ndviAnomaly === null ? null : ndviAnomaly <= -10 ? "high" : ndviAnomaly <= -3 ? "moderate" : "low";

  // Erosion risk from slope, heavy-rain frequency and vegetation cover.
  const slope = terrain?.slopePercent ?? null;
  const slopeTerm = slope === null ? 1 : slope < 2 ? 0 : slope < 5 ? 1 : slope < 10 ? 2 : 3;
  const rainTerm = heavy === null ? 1 : heavy < 3 ? 0 : heavy <= 8 ? 1 : 2;
  const coverTerm = ndvi?.latest !== null && ndvi?.latest !== undefined && ndvi.latest < 0.3 ? 1 : 0;
  // Hydrologic groups C/D shed more runoff (SSURGO).
  const runoffTerm = ssurgo?.hydrologicGroup && /[CD]/.test(ssurgo.hydrologicGroup) ? 1 : 0;
  const erosionPoints = slopeTerm + rainTerm + coverTerm + runoffTerm;
  const erosionRisk: RiskLevel = erosionPoints <= 1 ? "low" : erosionPoints <= 3 ? "moderate" : "high";

  // Seasonal profile across the whole record.
  const monthly: MonthlyProfile[] = MONTHS.map((month, m) => {
    const indices = dates
      .map((date, i) => ({ month: +date.slice(4, 6) - 1, year: date.slice(0, 4), i }))
      .filter((item) => item.month === m);
    const years = new Set(indices.map((item) => item.year)).size || 1;
    const wet = indices.map(({ i }) => root[i]).filter((v): v is number => v !== null);
    const rainVals = indices.map(({ i }) => rain[i]).filter((v): v is number => v !== null);
    const avgOf = (values: (number | null)[]) => {
      const valid = indices.map(({ i }) => values[i]).filter((v): v is number => v !== null);
      return valid.length ? round(mean(valid) as number, 1) : null;
    };
    const et0Vals = indices.map(({ i }) => et0[i]).filter((v): v is number => v !== null);
    return {
      tMean: avgOf(t2m),
      tMax: avgOf(tmax),
      tMin: avgOf(tmin),
      et0: et0Vals.length ? round(et0Vals.reduce((sum, v) => sum + v, 0) / years) : null,
      month,
      rootWetness: wet.length ? round(mean(wet) as number, 3) : null,
      rainMm: rainVals.length ? round(rainVals.reduce((s, v) => s + v, 0) / years) : null,
      frostDays: round(
        indices.filter(({ i }) => tmin[i] !== null && (tmin[i] as number) <= THRESHOLDS.frostDayC).length / years,
        1,
      ),
      heatDays: round(
        indices.filter(({ i }) => tmax[i] !== null && (tmax[i] as number) >= THRESHOLDS.heatDayC).length / years,
        1,
      ),
    };
  });

  // Daily samples per calendar month (used to recount frost/heat days under scenarios).
  const dailyByMonth = {
    tmax: MONTHS.map(() => [] as number[]),
    tmin: MONTHS.map(() => [] as number[]),
    years: new Set(dates.map((date) => date.slice(0, 4))).size,
  };
  dates.forEach((date, i) => {
    const m = +date.slice(4, 6) - 1;
    if (tmax[i] !== null) dailyByMonth.tmax[m].push(round(tmax[i] as number, 1));
    if (tmin[i] !== null) dailyByMonth.tmin[m].push(round(tmin[i] as number, 1));
  });

  const trends = buildTrends(dates, { t2m, tmax, tmin, rain, root });
  const odds = buildOdds(dates, monthly, { tmin, tmax, root }, latitude);

  const land = landStatus(root, monthly.map((m) => m.tMean), input.noSoil ?? false);

  // Resilience score.
  const heatPressure = clamp((heat.current ?? 0) / 40) * 100;
  const erosionPressure = { low: 15, moderate: 50, high: 85 }[erosionRisk];
  const vegPressure = vegetationStress ? { low: 15, moderate: 50, high: 85 }[vegetationStress] : 40;
  const soilPressure = organicMatter === null ? 50 : organicMatter < 1.5 ? 80 : organicMatter < 3 ? 45 : 15;
  const resilienceScore = Math.round(
    100 -
      (0.35 * waterStress +
        0.2 * heatPressure +
        0.15 * erosionPressure +
        0.15 * vegPressure +
        0.15 * soilPressure),
  );

  // Confidence and caveats grounded in SMAP documentation.
  const caveats: string[] = [
    `Soil wetness comes from NASA POWER's ~50 km grid (SMAP L4 itself is ${SMAP_FACTS.l4GridKm} km). It describes the surrounding landscape, not your exact field.`,
  ];
  let points = 3;
  const missing = input.sources.filter(
    (source) => !source.ok && !source.pending && !source.notApplicable && source.core !== false,
  );
  if (missing.length) {
    points -= missing.length >= 2 ? 2 : 1;
    caveats.push(`Not available right now: ${missing.map((source) => source.name).join(", ")}.`);
  }
  const slopeDegrees = slope !== null ? (Math.atan(slope / 100) * 180) / Math.PI : null;
  if (slopeDegrees !== null && slopeDegrees > SMAP_FACTS.slopeSdUncertain) {
    points -= 1;
    caveats.push(
      `Local slope ≈ ${round(slopeDegrees, 1)}°. SMAP flags soil-moisture retrievals as uncertain where terrain varies by more than ${SMAP_FACTS.slopeSdUncertain}°.`,
    );
  }
  if (ndvi?.latest !== null && ndvi?.latest !== undefined && ndvi.latest > 0.8) {
    points -= 1;
    caveats.push(
      `Very dense vegetation (NDVI ${round(ndvi.latest, 2)}). SMAP's L-band signal loses sensitivity above ~${SMAP_FACTS.vwcSensitivityLimit} kg/m² vegetation water content.`,
    );
  }
  if (ssurgo?.drainage && /poorly/i.test(ssurgo.drainage)) {
    caveats.push(`USDA soil survey: "${ssurgo.drainage}". Waterlogging limits crops that need well-drained soil.`);
  }
  const era5 = input.extras?.era5 ?? null;
  if (era5?.rootZoneAnomaly != null && rootAnomaly !== null && Math.abs(era5.rootZoneAnomaly - rootAnomaly) > 15) {
    caveats.push(
      `The two soil-moisture sources disagree: NASA POWER ${rootAnomaly > 0 ? "+" : ""}${rootAnomaly}% vs Copernicus ERA5-Land ${era5.rootZoneAnomaly > 0 ? "+" : ""}${era5.rootZoneAnomaly}% compared with earlier years. Check the soil by hand.`,
    );
  }
  if ((frost.current ?? 0) > 60) {
    caveats.push(
      "Long frost season: SMAP masks frozen soil, so winter soil-moisture values are model-only.",
    );
  }
  if (wetEnd >= 0 && metEnd - wetEnd > 20) {
    caveats.push(
      `Soil wetness data end on ${ymdToIso(dates[wetEnd])}; the root-zone window ends there, not today.`,
    );
  }
  const confidence: Confidence = points >= 3 ? "high" : points === 2 ? "medium" : "low";

  return {
    latitude,
    longitude,
    period: {
      start: ymdToIso(dates[Math.max(metEnd - 364, 0)]),
      end: ymdToIso(dates[metEnd]),
      baselineStart: ymdToIso(dates[0]),
    },
    climate: {
      meanTemperature: temperature.current !== null ? round(temperature.current, 1) : null,
      temperatureAnomaly:
        temperature.current !== null && temperature.baseline !== null
          ? round(temperature.current - temperature.baseline, 1)
          : null,
      maxTemperature: maxTemp !== null ? round(maxTemp, 1) : null,
      heatStressDays: heat.current,
      heatStressBaseline: heat.baseline !== null ? round(heat.baseline) : null,
      frostDays: frost.current,
      frostBaseline: frost.baseline !== null ? round(frost.baseline) : null,
    },
    water: {
      rainfall: rainfall.current !== null ? round(rainfall.current) : null,
      rainfallAnomaly: pctChange(rainfall.current, rainfall.baseline),
      heavyRainDays: heavy,
      surfaceWetness: surface !== null ? round(surface, 3) : null,
      rootZoneWetness: rootWet !== null ? round(rootWet, 3) : null,
      rootZoneAnomaly: rootAnomaly,
      rootZoneVolumetric: rootWet !== null && porosity !== null ? round(rootWet * porosity, 3) : null,
      evapotranspiration: et0Sum !== null ? round(et0Sum) : null,
      waterBalance:
        et0Sum !== null && rainfall.current !== null ? round(rainfall.current - et0Sum) : null,
      waterStress,
    },
    vegetation: {
      ndvi: ndvi?.latest !== null && ndvi?.latest !== undefined ? round(ndvi.latest, 2) : null,
      ndviAnomaly,
      vegetationStress,
      date: ndvi?.latestDate ?? null,
    },
    soil: {
      organicMatter: organicMatter !== null ? round(organicMatter, 1) : null,
      ph: soil?.ph != null ? round(soil.ph, 1) : null,
      clay: soil?.clay != null ? round(soil.clay) : null,
      sand: soil?.sand != null ? round(soil.sand) : null,
      silt: soil?.silt != null ? round(soil.silt) : null,
      bulkDensity: soil?.bulkDensity != null ? round(soil.bulkDensity, 2) : null,
      porosity: porosity !== null ? round(porosity, 2) : null,
      soilType,
      slope: slope !== null ? round(slope, 1) : null,
      elevation: terrain?.elevation != null ? Math.round(terrain.elevation) : null,
      erosionRisk,
      drainage: ssurgo?.drainage ?? null,
      hydrologicGroup: ssurgo?.hydrologicGroup ?? null,
      awc: ssurgo?.awc ?? null,
      mapUnit: ssurgo?.mapUnit ?? null,
      soilSource: ssurgo ? "SSURGO" : input.soil ? "SoilGrids" : null,
    },
    monthly,
    dailyByMonth,
    trends,
    odds,
    country: input.country,
    extras: {
      era5: input.extras?.era5 ?? null,
      projection: input.extras?.projection ?? null,
      sentinel2: input.extras?.sentinel2 ?? null,
      groundwater: input.extras?.groundwater ?? null,
      usdaYields: input.extras?.usdaYields ?? null,
      openet: input.extras?.openet ?? null,
    },
    resilienceScore: land.farmable ? Math.max(0, Math.min(100, resilienceScore)) : null,
    landStatus: land,
    confidence,
    caveats,
    sources: input.sources,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Trends and projections                                              */
/* ------------------------------------------------------------------ */

const T_90: Record<number, number> = { 1: 6.31, 2: 2.92, 3: 2.35, 4: 2.13, 5: 2.02, 6: 1.94, 7: 1.89, 8: 1.86, 9: 1.83, 10: 1.81, 11: 1.8, 12: 1.78, 13: 1.77, 14: 1.76, 15: 1.75 };

/** Ordinary least squares with a 90% prediction interval at `x0`. */
export function linearProjection(points: { year: number; value: number }[], x0: number) {
  const n = points.length;
  const xm = points.reduce((s, p) => s + p.year, 0) / n;
  const ym = points.reduce((s, p) => s + p.value, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.year - xm) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.year - xm) * (p.value - ym), 0);
  const slope = sxx ? sxy / sxx : 0;
  const intercept = ym - slope * xm;
  const residual = points.reduce((s, p) => s + (p.value - (intercept + slope * p.year)) ** 2, 0);
  const sst = points.reduce((s, p) => s + (p.value - ym) ** 2, 0);
  const se = Math.sqrt(residual / Math.max(n - 2, 1));
  const t = T_90[n - 2] ?? 1.7;
  const slopeSe = sxx ? se / Math.sqrt(sxx) : Infinity;
  const significant = Math.abs(slope) > t * slopeSe;
  if (!significant) {
    // No clear trend: expect values around the record mean, with year-to-year spread.
    const sd = Math.sqrt(sst / Math.max(n - 1, 1));
    const margin = t * sd * Math.sqrt(1 + 1 / n);
    return { slope, prediction: ym, low: ym - margin, high: ym + margin, r2: sst ? 1 - residual / sst : 0, significant };
  }
  const prediction = intercept + slope * x0;
  const margin = t * se * Math.sqrt(1 + 1 / n + (sxx ? (x0 - xm) ** 2 / sxx : 0));
  return {
    slope,
    prediction,
    low: prediction - margin,
    high: prediction + margin,
    r2: sst ? 1 - residual / sst : 0,
    significant,
  };
}

function buildTrends(
  dates: string[],
  s: { t2m: (number | null)[]; tmax: (number | null)[]; tmin: (number | null)[]; rain: (number | null)[]; root: (number | null)[] },
): Trend[] {
  const byYear = new Map<number, number[]>();
  dates.forEach((date, i) => {
    const year = +date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(i);
  });

  const series = (
    id: string,
    label: string,
    unit: string,
    values: (number | null)[],
    reduce: (valid: number[]) => number,
    digits: number,
  ): Trend | null => {
    const points: { year: number; value: number }[] = [];
    byYear.forEach((indices, year) => {
      const valid = indices.map((i) => values[i]).filter((v): v is number => v !== null);
      if (valid.length >= 330) points.push({ year, value: round(reduce(valid), digits) });
    });
    if (points.length < 4) return null;
    const projectionYear = 2030;
    const fit = linearProjection(points, projectionYear);
    // Counts, rain and wetness cannot go below zero.
    fit.low = Math.max(fit.low, 0);
    fit.prediction = Math.max(fit.prediction, 0);
    if (id === "temperature") fit.low = Math.min(fit.low, fit.prediction);
    return {
      id,
      label,
      unit,
      values: points,
      slopePerDecade: round(fit.slope * 10, digits + 1),
      r2: round(fit.r2, 2),
      significant: fit.significant,
      projectionYear,
      projection: round(fit.prediction, digits),
      low: round(fit.low, digits),
      high: round(fit.high, digits),
    };
  };

  return [
    series("temperature", "Mean temperature", "°C", s.t2m, (v) => mean(v) as number, 1),
    series("rain", "Annual rainfall", "mm", s.rain, (v) => v.reduce((a, b) => a + b, 0), 0),
    series("heat", `Days ≥ ${THRESHOLDS.heatDayC} °C`, "days", s.tmax, (v) => v.filter((x) => x >= THRESHOLDS.heatDayC).length, 0),
    series("frost", "Frost days", "days", s.tmin, (v) => v.filter((x) => x <= THRESHOLDS.frostDayC).length, 0),
    series("wetness", "Root-zone wetness", "%", s.root, (v) => (mean(v) as number) * 100, 1),
  ].filter((trend): trend is Trend => trend !== null);
}

function buildOdds(
  dates: string[],
  monthly: MonthlyProfile[],
  s: { tmin: (number | null)[]; tmax: (number | null)[]; root: (number | null)[] },
  latitude: number,
): SeasonOdds {
  const growingMonths = monthly
    .map((m, index) => ({ index, warm: (m.tMean ?? -99) >= 10 }))
    .filter((m) => m.warm)
    .map((m) => m.index);
  const springFrostMonths = latitude >= 0 ? [3, 4] : [9, 10];

  const years = new Map<string, { wet: number[]; heat: number; lateFrost: boolean; days: number }>();
  dates.forEach((date, i) => {
    const year = date.slice(0, 4);
    const m = +date.slice(4, 6) - 1;
    if (!years.has(year)) years.set(year, { wet: [], heat: 0, lateFrost: false, days: 0 });
    const entry = years.get(year)!;
    entry.days += 1;
    if (growingMonths.includes(m) && s.root[i] !== null) entry.wet.push(s.root[i] as number);
    if (s.tmax[i] !== null && (s.tmax[i] as number) >= THRESHOLDS.heatDayC) entry.heat += 1;
    if (springFrostMonths.includes(m) && s.tmin[i] !== null && (s.tmin[i] as number) <= THRESHOLDS.frostDayC) entry.lateFrost = true;
  });

  const complete = [...years.values()].filter((y) => y.days >= 360);
  const withWet = complete.filter((y) => y.wet.length >= growingMonths.length * 25);
  return {
    dryGrowingSeasons: {
      count: withWet.filter((y) => (mean(y.wet) as number) < 0.45).length,
      of: withWet.length,
    },
    hotYears: { count: complete.filter((y) => y.heat >= 10).length, of: complete.length },
    lateFrostYears: { count: complete.filter((y) => y.lateFrost).length, of: complete.length },
  };
}
