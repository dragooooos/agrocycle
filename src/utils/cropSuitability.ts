import type { FieldAnalysis } from "../types";
import type { Crop } from "../data/crops";
import { THRESHOLDS } from "./fieldAnalysis";

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Monthly climate the crop model works on (baseline or a what-if scenario). */
export interface ClimateInputs {
  tMean: number[];
  tMax: number[];
  tMin: number[];
  rain: number[];
  et0: number[];
  wet: number[];
  frostDays: number[];
  heatDays: number[];
  ph: number | null;
  clay: number | null;
  sand: number | null;
  drainage: string | null;
  irrigation: boolean;
}

export interface Scenario {
  deltaT: number; // °C added to every day
  rainPct: number; // % change in rainfall
}

/** Builds climate inputs from the NASA analysis, optionally shifted by a scenario. */
export function buildClimate(a: FieldAnalysis, scenario: Scenario, irrigation: boolean): ClimateInputs {
  const { deltaT, rainPct } = scenario;
  const fallback = (values: (number | null)[], value: number) => values.map((v) => v ?? value);
  const tMeanBase = fallback(a.monthly.map((m) => m.tMean), 10);

  const recount = (samples: number[][], test: (value: number) => boolean) =>
    samples.map((values, m) => {
      const years = values.length / DAYS_IN_MONTH[m] || 1;
      return values.filter(test).length / years;
    });

  return {
    tMean: tMeanBase.map((t) => t + deltaT),
    tMax: fallback(a.monthly.map((m) => m.tMax), 15).map((t) => t + deltaT),
    tMin: fallback(a.monthly.map((m) => m.tMin), 5).map((t) => t + deltaT),
    rain: fallback(a.monthly.map((m) => m.rainMm), 50).map((r) => r * (1 + rainPct / 100)),
    // Hargreaves ET0 scales with (T + 17.8).
    et0: fallback(a.monthly.map((m) => m.et0), 80).map((e, i) =>
      e * Math.max((tMeanBase[i] + deltaT + 17.8) / Math.max(tMeanBase[i] + 17.8, 1), 0),
    ),
    // Heuristic soil-wetness response: half the relative rain change, minus drying from warming.
    wet: fallback(a.monthly.map((m) => m.rootWetness), 0.55).map((w) =>
      clamp(w * (1 + (0.5 * rainPct) / 100) - 0.01 * deltaT, 0.05, 1),
    ),
    frostDays: recount(a.dailyByMonth.tmin, (t) => t + deltaT <= THRESHOLDS.frostDayC),
    heatDays: recount(a.dailyByMonth.tmax, (t) => t + deltaT >= THRESHOLDS.heatDayC),
    ph: a.soil.ph,
    clay: a.soil.clay,
    sand: a.soil.sand,
    drainage: a.soil.drainage ?? null,
    irrigation,
  };
}

export interface CropWindow {
  start: number;
  active: number[];
  occupied: number[];
  score: number;
  factors: { temp: number; water: number; frost: number; heat: number; soil: number };
  waterNeed: number;
  waterSupply: number;
  frostDays: number;
  heatDays: number;
}

export interface CropFit {
  crop: Crop;
  best: CropWindow | null;
  windows: CropWindow[];
  score: number;
  limiting: string[];
}

function tempResponse(crop: Crop, t: number) {
  if (t < crop.tBase || t > crop.tMax) return 0;
  if (t < crop.tOptLow) return 0.25 + (0.75 * (t - crop.tBase)) / (crop.tOptLow - crop.tBase);
  if (t <= crop.tOptHigh) return 1;
  return 0.25 + (0.75 * (crop.tMax - t)) / (crop.tMax - crop.tOptHigh);
}

function soilFactor(crop: Crop, c: ClimateInputs) {
  let ph = 0.9;
  if (c.ph !== null) {
    const distance = c.ph < crop.phMin ? crop.phMin - c.ph : c.ph > crop.phMax ? c.ph - crop.phMax : 0;
    ph = clamp(1 - 0.3 * distance, 0.3, 1);
  }
  let texture = 0.9;
  if (c.clay !== null) {
    if (crop.soil === "heavy") texture = c.clay >= 25 ? 1 : c.clay >= 15 ? 0.8 : 0.6;
    else if (crop.soil === "light") texture = c.clay > 40 ? 0.55 : c.clay > 30 ? 0.8 : 1;
    else if (crop.soil === "well-drained") texture = c.clay > 45 ? 0.7 : 1;
    else texture = 1;
  }
  if (c.drainage && /poorly/i.test(c.drainage)) {
    if (crop.soil === "light" || crop.soil === "well-drained") texture *= 0.7;
  }
  return ph * texture;
}

const wetAvgSeason = (months: number[], c: ClimateInputs) =>
  months.reduce((sum, i) => sum + c.wet[i], 0) / Math.max(months.length, 1);

export const monthRange = (months: number[]) =>
  months.length ? `${MONTH_NAMES[months[0]]}–${MONTH_NAMES[months[months.length - 1]]}` : "";

export function evaluateCrop(crop: Crop, c: ClimateInputs): CropFit {
  const windows: CropWindow[] = [];
  const soil = soilFactor(crop, c);

  for (let start = 0; start < 12; start += 1) {
    if (tempResponse(crop, c.tMean[start]) <= 0) continue;

    const active: number[] = [];
    const occupied: number[] = [];
    let dormant = 0;
    let m = start;
    let valid = true;
    for (let step = 0; step < 12 && active.length < crop.months; step += 1) {
      const t = c.tMean[m];
      if (t >= crop.tBase && t <= crop.tMax) {
        active.push(m);
        occupied.push(m);
      } else if (crop.overwinter && t < crop.tBase && t >= -12 && dormant < 5) {
        dormant += 1;
        occupied.push(m);
      } else {
        valid = false;
        break;
      }
      m = (m + 1) % 12;
    }
    if (!valid || active.length < crop.months) continue;
    if (crop.perennial) {
      occupied.length = 0;
      for (let i = 0; i < 12; i += 1) occupied.push(i);
    }

    const temp = active.reduce((sum, i) => sum + tempResponse(crop, c.tMean[i]), 0) / active.length;
    const frostDays = active.reduce((sum, i) => sum + c.frostDays[i], 0);
    const heatDays = active.reduce((sum, i) => sum + c.heatDays[i], 0);

    let frost = 1;
    if (!crop.frostTolerant) frost = clamp(1 - frostDays / 8);
    else if (Math.min(...occupied.map((i) => c.tMin[i])) < -18) frost = 0.5; // winter-kill risk

    const heat = clamp(1 - (heatDays * (1 - crop.heatTol)) / 12);

    const paddyExtra = crop.paddy ? 100 * active.length : 0; // percolation + standing water
    const waterNeed = active.reduce((sum, i) => sum + c.et0[i] * crop.kc, 0) + paddyExtra;
    const waterSupply = occupied.reduce((sum, i) => sum + 0.8 * c.rain[i], 0) + c.wet[start] * 120;
    const ratio = waterSupply / Math.max(waterNeed, 1);
    const threshold = 0.35 - 0.25 * crop.droughtTol;
    let water = clamp((ratio - threshold) / (1 - threshold));
    if (crop.paddy && ratio < 0.9) {
      // Rain-fed paddy is only realistic in very wet places; elsewhere it needs irrigation.
      const wetSeason = active.reduce((sum, i) => sum + c.wet[i], 0) / active.length >= 0.65;
      water *= wetSeason && ratio >= 0.5 ? 0.8 : 0.55;
    }
    // Drought-adapted crops suffer from disease and waterlogging in very humid seasons.
    if (crop.droughtTol >= 0.75 && wetAvgSeason(active, c) > 0.62) water *= 0.7;
    if (ratio > 1.3 && crop.droughtTol >= 0.6) water *= clamp(1 - (ratio - 1.3) * 0.4 * crop.droughtTol, 0.5, 1);
    if (c.irrigation) water = Math.max(water, 0.9);
    const wetAvg = active.reduce((sum, i) => sum + c.wet[i], 0) / active.length;
    if (!crop.paddy && wetAvg > 0.85 && (crop.soil === "light" || crop.soil === "well-drained")) water *= 0.85;

    const score =
      temp <= 0
        ? 0
        : 100 *
          Math.pow(temp, 0.35) *
          Math.pow(Math.max(water, 0.01), 0.3) *
          Math.pow(Math.max(frost, 0.01), 0.15) *
          Math.pow(Math.max(heat, 0.01), 0.1) *
          Math.pow(soil, 0.1);

    windows.push({
      start,
      active,
      occupied,
      score: Math.round(score),
      factors: { temp, water, frost, heat, soil },
      waterNeed: Math.round(waterNeed),
      waterSupply: Math.round(waterSupply),
      frostDays: Math.round(frostDays * 10) / 10,
      heatDays: Math.round(heatDays * 10) / 10,
    });
  }

  windows.sort((x, y) => y.score - x.score);
  const best = windows[0] ?? null;
  const limiting: string[] = [];

  if (!best) {
    const warm = Math.max(...c.tMean);
    const cool = Math.min(...c.tMean);
    limiting.push(
      warm < crop.tBase + 3
        ? "Too cool: the warmest months stay below what it needs"
        : cool > crop.tMax - 3 && !crop.overwinter
          ? "Too hot for most of the year"
          : `No ${crop.months}-month window with suitable temperatures`,
    );
  } else {
    const f = best.factors;
    if (f.temp < 0.7) limiting.push(`Temperatures are outside its optimum (${crop.tOptLow}–${crop.tOptHigh} °C) in ${monthRange(best.active)}`);
    if (f.water < 0.7)
      limiting.push(
        `Needs ~${best.waterNeed} mm in its season but rain and soil supply ~${best.waterSupply} mm${crop.paddy ? " (paddy needs irrigation)" : ""}`,
      );
    if (f.frost < 0.8) limiting.push(`Frost risk during the season (~${best.frostDays} frost days)`);
    if (f.heat < 0.8) limiting.push(`~${best.heatDays} days ≥ ${THRESHOLDS.heatDayC} °C while growing`);
    if (f.soil < 0.8) limiting.push("Soil pH or texture is not ideal");
  }

  return { crop, best, windows, score: best?.score ?? 0, limiting };
}
