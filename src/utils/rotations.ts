import type {
  Confidence,
  FarmerConstraints,
  FieldAnalysis,
  PriorityId,
  Rotation,
  RotationSegment,
  RotationYear,
} from "../types";
import { CROPS, CROP_BY_ID } from "../data/crops";
import { marketCrops, marketScore } from "../data/markets";
import {
  evaluateCrop,
  monthRange,
  type ClimateInputs,
  type CropFit,
  type CropWindow,
} from "./cropSuitability";
import { calculateRotationScore } from "./scoring";

interface Slot {
  main: CropFit;
  window: CropWindow;
  second: { fit: CropFit; window: CropWindow } | null;
}

interface Candidate {
  slots: Slot[];
  metrics: { water: number; soil: number; heat: number; erosion: number; pest: number; market: number };
  fit: number;
  score: number;
  coveredMonths: number;
  bareMonths: number;
}

const clampScore = (value: number) => Math.round(Math.min(98, Math.max(5, value)));
const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
const fits = (months: number[], free: Set<number>) => months.every((m) => free.has(m));

export interface RecommendationResult {
  rotations: Rotation[];
  cropFits: CropFit[];
  market: { countryName: string | null; regionName: string | null };
}

/* ------------------------------------------------------------------ */
/* Slot construction                                                   */
/* ------------------------------------------------------------------ */

function buildSlot(
  main: CropFit,
  all: CropFit[],
  allowSecondCash: boolean,
  localScore: (cropId: string) => number,
): Slot | null {
  const window = main.best;
  if (!window) return null;
  const free = new Set<number>();
  for (let m = 0; m < 12; m += 1) if (!window.occupied.includes(m)) free.add(m);

  let second: Slot["second"] = null;
  if (free.size >= 2) {
    const options = all
      .filter((f) => f.crop.id !== main.crop.id && f.crop.family !== main.crop.family || f.crop.role === "cover")
      .filter((f) => f.crop.id !== main.crop.id && !f.crop.perennial)
      .filter((f) => (f.crop.role === "cover" ? true : allowSecondCash && f.crop.role === "cash"))
      .map((f) => ({
        fit: f,
        window: f.windows.find(
          (w) =>
            fits(w.occupied, free) &&
            w.score >= (f.crop.role === "cover" ? 55 : 72) &&
            (allowSecondCash && f.crop.role !== "cover" ? w.factors.water >= 0.6 : w.factors.water >= 0.45),
        ),
      }))
      .filter((o): o is { fit: CropFit; window: CropWindow } => Boolean(o.window));

    // Prefer a second cash crop (double cropping), otherwise the best cover crop.
    // A second cash crop must be locally established (market ≥ 60) to be worth a second harvest.
    const cash = options
      .filter((o) => o.fit.crop.role === "cash" && localScore(o.fit.crop.id) >= 60)
      .sort((a, b) => 0.6 * b.window.score + 0.4 * localScore(b.fit.crop.id) - (0.6 * a.window.score + 0.4 * localScore(a.fit.crop.id)))[0];
    const cover = options.filter((o) => o.fit.crop.role === "cover").sort((a, b) => b.window.score - a.window.score)[0];
    second = cash ?? cover ?? null;
  }
  return { main, window, second };
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

function evaluate(
  slots: Slot[],
  a: FieldAnalysis,
  climate: ClimateInputs,
  constraints: FarmerConstraints,
  priorities: PriorityId[],
): Candidate {
  const country = a.country?.code ?? null;
  const mains = slots.map((s) => s.main);
  const seconds = slots.filter((s) => s.second).map((s) => s.second!);
  const cashSeconds = seconds.filter((s) => s.fit.crop.role !== "cover");
  const covers = seconds.filter((s) => s.fit.crop.role === "cover");
  const heavyRain = [...climate.rain].sort((x, y) => y - x)[3]; // top-4 wettest months
  const riskIndex = { low: 0, moderate: 1, high: 2 }[a.soil.erosionRisk];

  // Water: how well rain + soil cover each crop's need, plus drought tolerance.
  const waterOf = (crop: CropFit["crop"], w: CropWindow) =>
    100 * (0.7 * Math.min(w.waterSupply / Math.max(w.waterNeed, 1), 1) + 0.3 * crop.droughtTol);
  let water = avg([
    ...slots.map((s) => waterOf(s.main.crop, s.window)),
    ...cashSeconds.map((s) => waterOf(s.fit.crop, s.window) * 0.9),
  ]);
  if (a.water.waterStress >= 60 && !constraints.irrigation) water -= 4 * covers.length;

  const heat = avg(slots.map((s) => 100 * (0.6 * s.window.factors.heat + 0.4 * s.main.crop.heatTol)));

  // Soil cover and bare months.
  let covered = 0;
  let bare = 0;
  let wetBare = 0;
  slots.forEach((s) => {
    const occupied = new Set([...s.window.occupied, ...(s.second?.window.occupied ?? [])]);
    covered += occupied.size;
    for (let m = 0; m < 12; m += 1) {
      if (!occupied.has(m)) {
        bare += 1;
        if (climate.rain[m] >= heavyRain) wetBare += 1;
      }
    }
  });
  const totalMonths = slots.length * 12;
  const allCrops = [...mains.map((m) => m.crop), ...seconds.map((s) => s.fit.crop)];
  const legumeShare =
    (allCrops.filter((c) => c.nFix && c.role !== "cover").length + 0.5 * covers.filter((c) => c.fit.crop.nFix).length) /
    Math.max(slots.length, 1);
  const deepShare = allCrops.filter((c) => c.deepRoot).length / allCrops.length;
  const lowOm = a.soil.organicMatter !== null && a.soil.organicMatter < 2;

  const soil =
    30 +
    25 * Math.min(legumeShare, 1) +
    20 * (covered / totalMonths) +
    15 * deepShare +
    10 * avg(allCrops.map((c) => c.residue)) +
    (mains.some((m) => m.crop.perennial) ? 8 : 0) +
    (lowOm ? 4 * Math.min(legumeShare, 1) : 0);

  const erosion = 100 * (1 - (bare / totalMonths) * (0.7 + 0.15 * riskIndex)) - (3 * wetBare) / slots.length;

  const families = new Set(allCrops.map((c) => c.family)).size;
  const pest =
    25 +
    55 * (families / allCrops.length) +
    (allCrops.some((c) => c.biofumigant) ? 8 : 0) +
    (slots.length >= 3 ? 7 : 0);

  const marketOf = (crop: CropFit["crop"]) =>
    constraints.livestock && (crop.role === "forage" || ["oats", "sorghum", "maize", "barley"].includes(crop.id))
      ? Math.max(85, marketScore(crop.id, country, a.latitude, a.longitude))
      : marketScore(crop.id, country, a.latitude, a.longitude);
  const market = avg([...mains.map((m) => marketOf(m.crop)), ...cashSeconds.map((s) => marketOf(s.fit.crop) * 0.95)]);

  const metrics = {
    water: clampScore(water),
    soil: clampScore(soil),
    heat: clampScore(heat),
    erosion: clampScore(erosion),
    pest: clampScore(pest),
    market: clampScore(market),
  };
  const fit = Math.round(avg([...slots.map((s) => s.window.score), ...cashSeconds.map((s) => s.window.score * 0.9)]));
  // Local fit blends climate/soil suitability with how established each crop is locally.
  const localFit = avg(slots.map((s) => 0.55 * s.window.score + 0.45 * marketOf(s.main.crop)));
  const priorityScore = calculateRotationScore({ ...metrics } as Rotation, priorities);

  return {
    slots,
    metrics,
    fit,
    score: Math.round(0.4 * localFit + 0.6 * priorityScore),
    coveredMonths: covered,
    bareMonths: bare,
  };
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

function cropReason(slot: Slot, a: FieldAnalysis) {
  const crop = slot.main.crop;
  if (crop.perennial) return "a perennial forage that keeps the soil covered all year";
  if (crop.nFix) return "adds nitrogen for the next crop";
  if (crop.paddy) return "uses the warm, wet season";
  if (crop.heatTol >= 0.8 && (a.climate.heatStressDays ?? 0) >= 10) return "tolerates the hot spells";
  if (crop.droughtTol >= 0.7 && a.water.waterStress >= 45) return "needs little water";
  if (crop.overwinter) return "uses the cool season";
  return "fits the warm season";
}

function describe(candidate: Candidate, a: FieldAnalysis, strategy: string) {
  const parts = candidate.slots.map((s) => {
    const second = s.second
      ? s.second.fit.crop.role === "cover"
        ? `, then a ${s.second.fit.crop.name.toLowerCase()} (${monthRange(s.second.window.occupied)})`
        : ` with ${s.second.fit.crop.name} as a second crop (${monthRange(s.second.window.occupied)})`
      : "";
    return `${s.main.crop.name} (${monthRange(s.window.occupied)}) ${cropReason(s, a)}${second}`;
  });
  return `${strategy}: ${parts.join("; ")}.`;
}

function calendarOf(slots: Slot[]): RotationYear[] {
  return slots.map((s, index) => {
    const segments: RotationSegment[] = [
      { cropId: s.main.crop.id, name: s.main.crop.name, emoji: s.main.crop.emoji, role: "main", months: s.window.occupied },
    ];
    if (s.second) {
      segments.push({
        cropId: s.second.fit.crop.id,
        name: s.second.fit.crop.name,
        emoji: s.second.fit.crop.emoji,
        role: s.second.fit.crop.role === "cover" ? "cover" : "second",
        months: s.second.window.occupied,
      });
    }
    const occupied = new Set(segments.flatMap((seg) => seg.months));
    return {
      label: s.main.crop.perennial ? `Years ${index + 1}+` : `Year ${index + 1}`,
      segments,
      bareMonths: Array.from({ length: 12 }, (_, m) => m).filter((m) => !occupied.has(m)),
    };
  });
}

function toRotation(
  candidate: Candidate,
  a: FieldAnalysis,
  constraints: FarmerConstraints,
  options: { id: string; name: string; strategy: string; assumed?: boolean; baselineBare?: number },
): Rotation {
  const { slots, metrics } = candidate;
  const country = a.country?.code ?? null;
  const { country: countryList, region } = marketCrops(country, a.latitude, a.longitude);
  const benefits: string[] = [];
  const risks: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];

  const legumes = slots.filter((s) => s.main.crop.nFix).map((s) => s.main.crop.name);
  if (legumes.length) benefits.push(`${legumes.join(" and ")} fix${legumes.length === 1 ? "es" : ""} nitrogen, reducing fertiliser for the next crop.`);
  const doubles = slots.filter((s) => s.second && s.second.fit.crop.role !== "cover");
  if (doubles.length)
    benefits.push(`Two harvests in a year: ${doubles.map((s) => `${s.main.crop.name} + ${s.second!.fit.crop.name}`).join(", ")}.`);
  const coverSlots = slots.filter((s) => s.second?.fit.crop.role === "cover");
  if (coverSlots.length) benefits.push(`Cover crops protect the soil in ${coverSlots.map((s) => monthRange(s.second!.window.occupied)).join(", ")}.`);
  if (options.baselineBare !== undefined && candidate.bareMonths / slots.length < options.baselineBare - 0.5)
    benefits.push(`Fewer bare months: ${(candidate.bareMonths / slots.length).toFixed(1)} per year vs ${options.baselineBare.toFixed(1)} in the current rotation.`);
  if (slots.some((s) => s.main.crop.deepRoot)) benefits.push("Deep roots improve infiltration and reach subsoil water.");
  const families = slots.map((s) => s.main.crop.family);
  if (new Set(families).size === families.length && families.length > 1) benefits.push("Every main crop is from a different plant family, breaking pest and disease cycles.");
  if (metrics.water >= 75 && a.water.waterStress >= 45) benefits.push("Water needs stay within what rain and soil usually supply.");

  slots.forEach((s) => {
    if (s.main.limiting[0] && s.window.score < 75) risks.push(`${s.main.crop.name}: ${s.main.limiting[0].charAt(0).toLowerCase()}${s.main.limiting[0].slice(1)}.`);
    if (s.main.crop.paddy && !constraints.irrigation) risks.push("Paddy rice depends on irrigation or reliable flooding; confirm water rights and bunds.");
    const ms = marketScore(s.main.crop.id, country, a.latitude, a.longitude);
    if (ms < 50) risks.push(`${s.main.crop.name} is uncommon here; check buyers and seed availability.`);
  });
  if (coverSlots.length && a.water.waterStress >= 60 && !constraints.irrigation)
    risks.push("Cover crops use some soil water; terminate early in dry years.");
  if (doubles.length) risks.push("Double cropping leaves little time between harvest and sowing; it needs timely machinery.");

  gaps.push("No local yield records: fit is based on climate, soil and crop requirements only.");
  gaps.push(
    countryList
      ? `Market fit uses how common each crop is in ${a.country?.name ?? "this country"}, not prices or contracts.`
      : region.length
        ? "Country not identified: market fit uses regional crop patterns."
        : "Market context unavailable for this location.",
  );
  if (slots.some((s) => s.window.factors.frost < 0.95 || s.main.crop.overwinter)) gaps.push("Sowing dates should follow local frost dates and variety choice.");
  if (a.soil.ph === null) gaps.push("Soil pH and texture unavailable: a soil test would refine crop fit.");
  if (a.vegetation.ndvi === null) gaps.push("Current crop condition was not observed (no NDVI).");
  gaps.push("Local pest, disease and weed pressure is not visible to satellites.");
  if (slots.some((s) => s.main.crop.perennial)) gaps.push("Perennial forage occupies the field for 2–4 years; plan livestock or hay sales.");

  slots.forEach((s) => {
    evidence.push(
      `${s.main.crop.name}: fit ${s.window.score}/100 in ${monthRange(s.window.occupied)} · water need ~${s.window.waterNeed} mm vs ~${s.window.waterSupply} mm rain + soil${
        constraints.irrigation ? " (irrigation available)" : ""
      } · ${s.window.frostDays} frost / ${s.window.heatDays} hot days.`,
    );
  });
  evidence.push(
    `${candidate.coveredMonths} of ${slots.length * 12} months covered by a crop; erosion risk ${a.soil.erosionRisk}${
      a.soil.slope !== null ? ` (slope ${a.soil.slope}%)` : ""
    }.`,
  );

  let confidence: Confidence = a.confidence;
  if (candidate.fit < 55) confidence = "low";
  else if (confidence === "high" && slots.some((s) => marketScore(s.main.crop.id, country, a.latitude, a.longitude) < 50)) confidence = "medium";

  const cropNames = slots.flatMap((s) => [s.main.crop.name, ...(s.second ? [s.second.fit.crop.name] : [])]);

  return {
    id: options.id,
    name: options.name,
    crops: cropNames,
    score: candidate.score,
    fit: candidate.fit,
    ...metrics,
    explanation: describe(candidate, a, options.strategy),
    benefits: benefits.slice(0, 5),
    risks: risks.slice(0, 5),
    infoGaps: gaps,
    evidence,
    strategy: options.strategy,
    calendar: calendarOf(slots),
    assumed: options.assumed,
    confidence,
    recommended: false,
  };
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

export function recommendRotations(
  a: FieldAnalysis,
  climate: ClimateInputs,
  constraints: FarmerConstraints,
  priorities: PriorityId[],
): RecommendationResult {
  const country = a.country?.code ?? null;
  const all = CROPS.map((crop) => evaluateCrop(crop, climate));
  const cropFits = all.filter((f) => f.crop.role !== "cover").sort((x, y) => y.score - x.score);
  const market = marketCrops(country, a.latitude, a.longitude);

  // Candidate main crops: climatically viable, boosted slightly by local prevalence.
  const viable = cropFits
    .filter((f) => f.score >= 45 && (f.crop.role === "cash" || constraints.livestock || f.crop.perennial))
    .map((f) => ({ f, rank: 0.6 * f.score + 0.4 * marketScore(f.crop.id, country, a.latitude, a.longitude) }))
    .sort((x, y) => y.rank - x.rank)
    .map((x) => x.f);
  const pool = viable.slice(0, 9);
  const bestLegume = viable.find((f) => f.crop.nFix && !pool.includes(f));
  if (bestLegume) pool.push(bestLegume);

  const slotCache = new Map<string, Slot | null>();
  const slotOf = (f: CropFit) => {
    if (!slotCache.has(f.crop.id))
      slotCache.set(f.crop.id, buildSlot(f, all, true, (id) => marketScore(id, country, a.latitude, a.longitude)));
    return slotCache.get(f.crop.id) ?? null;
  };

  // Enumerate 2- and 3-year sequences with no family repeated back-to-back.
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const consider = (crops: CropFit[]) => {
    const key = crops.map((f) => f.crop.id).sort().join("|");
    if (seen.has(key)) return;
    for (let i = 0; i < crops.length; i += 1) {
      if (crops[i].crop.family === crops[(i + 1) % crops.length].crop.family) return;
    }
    if (crops.filter((f) => f.crop.perennial).length > 1) return;
    const slots = crops.map(slotOf);
    if (slots.some((s) => !s)) return;
    seen.add(key);
    candidates.push(evaluate(slots as Slot[], a, climate, constraints, priorities));
  };
  for (const x of pool) for (const y of pool) {
    if (x === y) continue;
    consider([x, y]);
    for (const z of pool) if (z !== x && z !== y) consider(orderForNitrogen([x, y, z]));
  }

  // Current rotation (farmer input) or an assumed regional one.
  let current: Candidate | null = null;
  let assumed = false;
  const chosen = constraints.currentCrops.map((id) => all.find((f) => f.crop.id === id)).filter(Boolean) as CropFit[];
  if (chosen.length) {
    const slots = chosen.map((f) => (f.best ? { main: f, window: f.best, second: null } : null)).filter(Boolean) as Slot[];
    if (slots.length) current = evaluate(slots, a, climate, constraints, priorities);
  }
  if (!current) {
    const local = cropFits
      .filter((f) => f.best && f.score >= 40 && f.crop.role === "cash")
      .map((f) => ({ f, m: marketScore(f.crop.id, country, a.latitude, a.longitude) }))
      .sort((x, y) => y.m - x.m || y.f.score - x.f.score)
      .map((x) => x.f);
    const picks: CropFit[] = [];
    for (const f of local) {
      if (picks.length === 0 || (picks.length < 2 && f.crop.id !== picks[0].crop.id)) picks.push(f);
    }
    if (picks.length) {
      assumed = true;
      const slots = (picks.length === 2 ? [picks[0], picks[1], picks[0]] : picks).map((f) => ({ main: f, window: f.best!, second: null }));
      current = evaluate(slots, a, climate, constraints, priorities);
    }
  }

  // Pick distinct strategies.
  candidates.sort((x, y) => y.score - x.score);
  const picked: { c: Candidate; strategy: string }[] = [];
  const keyOf = (c: Candidate) => c.slots.map((s) => s.main.crop.id).sort().join("|");
  const currentKey = current ? keyOf(current) : "";
  const take = (strategy: string, metric: (c: Candidate) => number) => {
    const best = candidates[0]?.score ?? 0;
    const option = candidates
      .filter((c) => c.score >= best - 18 && keyOf(c) !== currentKey && !picked.some((p) => keyOf(p.c) === keyOf(c)))
      .sort((x, y) => metric(y) - metric(x) || y.score - x.score)[0];
    if (option) picked.push({ c: option, strategy });
  };
  take("Best overall fit", (c) => c.score);
  take("Water-saving", (c) => c.metrics.water);
  take("Soil builder", (c) => c.metrics.soil);
  take("Local market", (c) => c.metrics.market);
  if ((a.climate.heatStressDays ?? 0) >= 15) take("Heat-resilient", (c) => c.metrics.heat);

  const baselineBare = current ? current.bareMonths / current.slots.length : undefined;
  const nameOf = (c: Candidate) =>
    c.slots.map((s) => s.main.crop.name + (s.second ? ` + ${s.second.fit.crop.name.replace(" cover", "")}` : "")).join(" → ");

  const rotations: Rotation[] = picked.map(({ c, strategy }, index) =>
    toRotation(c, a, constraints, { id: `option-${index}`, name: nameOf(c), strategy, baselineBare }),
  );
  rotations.sort((x, y) => y.score - x.score);
  if (rotations[0]) rotations[0].recommended = true;

  if (current) {
    rotations.unshift(
      toRotation(current, a, constraints, {
        id: "current",
        name: assumed ? `Typical local rotation (assumed): ${nameOf(current)}` : `Your current rotation: ${nameOf(current)}`,
        strategy: assumed ? "Assumed baseline" : "Your baseline",
        assumed,
      }),
    );
  }

  return {
    rotations,
    cropFits,
    market: { countryName: a.country?.name ?? null, regionName: market.regionName },
  };
}

/** Put a legume before the hungriest crop so it benefits from fixed nitrogen. */
function orderForNitrogen(crops: CropFit[]) {
  const legumeIndex = crops.findIndex((f) => f.crop.nFix);
  if (legumeIndex < 0) return crops;
  const rest = crops.filter((_, i) => i !== legumeIndex);
  rest.sort((x, y) => (CROP_BY_ID[y.crop.id]?.kc ?? 0) - (CROP_BY_ID[x.crop.id]?.kc ?? 0));
  return [crops[legumeIndex], ...rest];
}
