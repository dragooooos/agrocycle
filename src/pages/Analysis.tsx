import "./Analysis.css";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  Download,
  Droplets,
  ExternalLink,
  Flame,
  Leaf,
  MapPin,
  Mountain,
  RefreshCw,
  SlidersHorizontal,
  Snowflake,
  Sprout,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import MetricCard, { type MetricTone } from "../components/MetricCard";
import RotationCard, { cropSchedule } from "../components/RotationCard";
import { yearComparison } from "../utils/yearComparison";
import { downloadFieldReport, type ReportMeasurement } from "../utils/fieldReport";
import Accordion, { type AccordionItem } from "../components/Accordion";

import { LAYERS, readLayers, saveLayers, sourcesFor } from "../data/layers";
import { marketScore } from "../data/markets";
import { useFieldSources } from "../services/useFieldSources";
import { readSelection } from "../services/selection";
import { SOURCE_INFO, sourceStatuses, type SourceState } from "../services/sourceStore";
import type { NdviResult, PlaceResult, PowerDaily, SoilProfile, SsurgoResult, TerrainResult } from "../services/nasaData";
import type {
  Era5Result,
  GroundwaterResult,
  NassResult,
  OpenEtResult,
  ProjectionResult,
  Sentinel2Result,
} from "../services/extraSources";
import { recommendRotations } from "../utils/rotations";
import { buildFieldAnalysis, THRESHOLDS } from "../utils/fieldAnalysis";
import { buildClimate, monthRange, type Scenario } from "../utils/cropSuitability";
import type {
  FarmerConstraints,
  FieldAnalysis,
  LayerId,
  PriorityId,
  SourceId,
} from "../types";

const show = (value: number | null | undefined, unit = "") =>
  value === null || value === undefined ? "—" : `${value}${unit}`;
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/* ------------------------------------------------------------------ */
/* Layer readiness                                                     */
/* ------------------------------------------------------------------ */

type Readiness = "ready" | "loading" | "error";

function layerReadiness(layer: LayerId, snapshot: Record<SourceId, SourceState>): Readiness {
  const sources = LAYERS.find((l) => l.id === layer)?.sources ?? [];
  const states = sources.map((id) => snapshot[id]?.status ?? "idle").filter((s) => s !== "na");
  if (states.some((s) => s === "ok")) return "ready";
  if (states.some((s) => s === "loading" || s === "idle")) return "loading";
  return "error";
}

/* ------------------------------------------------------------------ */
/* Plain-language findings                                             */
/* ------------------------------------------------------------------ */

interface Finding {
  id: string;
  layer: LayerId;
  tone: "good" | "watch" | "bad" | "loading" | "missing";
  title: string;
  text: string;
}

function buildFindings(
  a: FieldAnalysis,
  layers: LayerId[],
  sourceLoading: (id: SourceId) => boolean,
): Omit<Finding, "id">[] {
  const findings: Omit<Finding, "id">[] = [];
  const pending = (layer: LayerId, title: string, source: SourceId): Omit<Finding, "id"> =>
    sourceLoading(source)
      ? { layer, tone: "loading", title, text: "Loading…" }
      : { layer, tone: "missing", title, text: "Not available right now." };
  const x = a.extras;

  if (layers.includes("moisture")) {
    const w = a.water.rootZoneWetness;
    const anomaly = a.water.rootZoneAnomaly;
    if (w === null) findings.push(pending("moisture", "Soil moisture", "power"));
    else {
      const tone = anomaly !== null && anomaly <= -10 ? "bad" : anomaly !== null && anomaly <= -4 ? "watch" : "good";
      const title =
        anomaly === null ? "Soil moisture" : anomaly <= -4 ? "Soil is drier than usual" : anomaly >= 4 ? "Soil is wetter than usual" : "Soil moisture is normal";
      findings.push({
        layer: "moisture",
        tone,
        title,
        text: `Root zone ${pct(w)} full${anomaly !== null ? `, ${signed(anomaly)}% vs normal` : ""}.`,
      });
    }
    if (x.groundwater) {
      const g = x.groundwater;
      const deeper = g.trendMPerDecade > 0.1;
      const shallower = g.trendMPerDecade < -0.1;
      findings.push({
        layer: "moisture",
        tone: g.trendMPerDecade > 0.5 ? "bad" : deeper ? "watch" : "good",
        title: deeper ? "Groundwater is dropping" : shallower ? "Groundwater is rising" : "Groundwater is stable",
        text: `Water ${g.latestDepthM} m down at the nearest well (${g.distanceKm} km), ${signed(g.trendMPerDecade)} m per decade.`,
      });
    }
  }

  if (layers.includes("temperature")) {
    const anomaly = a.climate.temperatureAnomaly;
    const heat = a.climate.heatStressDays ?? 0;
    const tone = heat >= 25 || (anomaly ?? 0) >= 1.5 ? "bad" : heat >= 10 || (anomaly ?? 0) >= 0.8 ? "watch" : "good";
    findings.push({
      layer: "temperature",
      tone,
      title:
        anomaly === null ? "Temperature" : anomaly >= 0.5 ? "Warmer than usual" : anomaly <= -0.5 ? "Cooler than usual" : "Temperatures are normal",
      text: `Average ${show(a.climate.meanTemperature, " °C")}${anomaly !== null ? ` (${signed(anomaly)} °C vs normal)` : ""}, ${heat} days above ${THRESHOLDS.heatDayC} °C, ${show(a.climate.frostDays)} frost days.`,
    });
  }

  if (layers.includes("rain")) {
    const anomaly = a.water.rainfallAnomaly;
    const balance = a.water.waterBalance;
    const tone = (anomaly ?? 0) <= -15 ? "bad" : (anomaly ?? 0) <= -5 ? "watch" : "good";
    findings.push({
      layer: "rain",
      tone,
      title: anomaly === null ? "Rainfall" : anomaly <= -5 ? "Less rain than usual" : anomaly >= 5 ? "More rain than usual" : "Normal rainfall",
      text: `${show(a.water.rainfall, " mm")} in 12 months${anomaly !== null ? ` (${signed(anomaly)}% vs normal)` : ""}.${
        balance !== null && balance < 0 ? ` Crops needed ${Math.abs(balance)} mm more than fell.` : ""
      }`,
    });
  }

  if (layers.includes("vegetation")) {
    if (a.vegetation.ndvi === null) findings.push(pending("vegetation", "Vegetation health", "ndvi"));
    else {
      const anomaly = a.vegetation.ndviAnomaly;
      findings.push({
        layer: "vegetation",
        tone: a.vegetation.vegetationStress === "high" ? "bad" : a.vegetation.vegetationStress === "moderate" ? "watch" : "good",
        title: anomaly === null ? "Vegetation greenness" : anomaly <= -3 ? "Vegetation is less green than usual" : "Vegetation looks normal",
        text: `Greenness ${a.vegetation.ndvi}${anomaly !== null ? ` (${signed(anomaly)}% vs normal)` : ""}, image from ${a.vegetation.date}.`,
      });
    }
  }

  if (layers.includes("terrain")) {
    if (a.soil.slope === null) findings.push(pending("terrain", "Slope & erosion", "terrain"));
    else
      findings.push({
        layer: "terrain",
        tone: a.soil.erosionRisk === "high" ? "bad" : a.soil.erosionRisk === "moderate" ? "watch" : "good",
        title: `Erosion risk is ${a.soil.erosionRisk}`,
        text: `Slope about ${a.soil.slope}%, ${show(a.water.heavyRainDays)} heavy-rain days last year.`,
      });
  }

  if (layers.includes("soil")) {
    if (a.soil.soilSource === null) findings.push(pending("soil", "Soil properties", "soil"));
    else {
      const om = a.soil.organicMatter;
      const ph = a.soil.ph;
      const phText = ph === null ? "" : ph < 5.5 ? `, acidic (pH ${ph})` : ph > 7.8 ? `, alkaline (pH ${ph})` : `, pH ${ph}`;
      findings.push({
        layer: "soil",
        tone: om !== null && om < 1.5 ? "bad" : om !== null && om < 2.5 ? "watch" : "good",
        title: `${a.soil.soilType ?? "Soil"}${a.soil.soilSource === "SSURGO" ? " (USDA soil survey)" : ""}`,
        text: `Organic matter about ${show(om, "%")}${om !== null ? (om < 1.5 ? " (low)" : om < 2.5 ? " (moderate)" : " (good)") : ""}${phText}${
          a.soil.drainage ? `, ${a.soil.drainage.toLowerCase()}` : ""
        }.`,
      });
    }
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Analysis() {
  const navigate = useNavigate();
  const field = readSelection();
  const priorities = readJson<PriorityId[]>("farmrotate:priorities", []);
  const farmerNote = sessionStorage.getItem("farmrotate:note") || "";
  const constraints = readJson<FarmerConstraints>("farmrotate:constraints", {
    irrigation: false,
    livestock: false,
    currentCrops: [],
  });

  const [layers, setLayers] = useState<LayerId[]>(readLayers);
  const [scenario, setScenario] = useState<Scenario>({ deltaT: 0, rainPct: 0 });
  // Rotation whose calendar and details are open (one at a time, chosen by the farmer).
  const [selectedRotation, setSelectedRotation] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const layerKey = layers.join(",");
  const priority = useMemo(() => sourcesFor(layers), [layerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { snapshot, retry } = useFieldSources(field?.latitude, field?.longitude, priority);

  const built = useMemo(() => {
    if (!field || !snapshot || snapshot.power.status !== "ok") return null;
    const value = <T,>(id: SourceId) => (snapshot[id].status === "ok" ? (snapshot[id].value as T) : null);
    try {
      return {
        analysis: buildFieldAnalysis({
          latitude: field.latitude,
          longitude: field.longitude,
          power: value<PowerDaily>("power") as PowerDaily,
          soil: value<SoilProfile>("soil"),
          ssurgo: value<SsurgoResult>("ssurgo"),
          ndvi: value<NdviResult>("ndvi"),
          terrain: value<TerrainResult>("terrain"),
          country: value<PlaceResult>("country"),
          extras: {
            era5: value<Era5Result>("era5"),
            projection: value<ProjectionResult>("cmip6"),
            sentinel2: value<Sentinel2Result>("sentinel2"),
            groundwater: value<GroundwaterResult>("groundwater"),
            usdaYields: value<NassResult>("nass"),
            openet: value<OpenEtResult>("openet"),
          },
          // SoilGrids answered "no soil here" and there is no USDA soil map either.
          noSoil:
            snapshot.soil.status === "error" &&
            snapshot.soil.kind === "NoSoilError" &&
            snapshot.ssurgo.status !== "ok",
          sources: sourceStatuses(snapshot),
        }),
        error: null,
      };
    } catch (reason) {
      return { analysis: null, error: reason instanceof Error ? reason.message : "Analysis failed" };
    }
  }, [snapshot, field?.latitude, field?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const analysis = built?.analysis ?? null;
  const constraintKey = JSON.stringify(constraints);
  const priorityKey = priorities.join(",");
  const recommendation = useMemo(() => {
    if (!analysis) return null;
    return recommendRotations(analysis, buildClimate(analysis, scenario, constraints.irrigation), constraints, priorities);
  }, [analysis, priorityKey, constraintKey, scenario.deltaT, scenario.rainPct]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLayer = (id: LayerId) => {
    const next = layers.includes(id) ? layers.filter((l) => l !== id) : [...layers, id];
    if (!next.length) return;
    setLayers(next);
    saveLayers(next);
  };

  const toggleFaq = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openFaq = (id: string) => {
    setOpen((current) => new Set(current).add(id));
    setTimeout(() => document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  /* ----------------------------- empty / loading / error ----------------------------- */

  const shell = (content: ReactNode) => (
    <div className="app-shell">
      <main className="page-container analysis-page">{content}</main>
    </div>
  );

  if (!field) {
    return shell(
      <section className="analysis-state">
        <MapPin size={28} />
        <h1>Choose a field first</h1>
        <p>Pick a point or draw your field on the map, choose what you want to see, then come back here.</p>
        <button className="primary-button" onClick={() => navigate("/map")}>
          Open the field map
        </button>
      </section>,
    );
  }

  // Step 1: is there soil here at all?
  if (!snapshot || snapshot.soil.status === "loading" || snapshot.soil.status === "idle") {
    return shell(
      <section className="analysis-state">
        <RefreshCw size={28} className="spin" />
        <h1>Checking for farmland at this point</h1>
        <p>
          {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)} · looking up the soil map first. Climate and
          satellite data are only fetched where there is soil to farm.
        </p>
      </section>,
    );
  }

  if (snapshot.soil.status === "error" && snapshot.soil.kind === "NoSoilError") {
    return shell(
      <section className="analysis-state not-farmable">
        <div className="na-score" aria-label="Resilience not applicable">
          <strong>N/A</strong>
          <span>resilience</span>
        </div>
        <h1>No farmland at this point</h1>
        <p>
          No soil is mapped here (ISRIC SoilGrids, the soil source NASA's SMAP mission uses). The point is open water
          (ocean, sea, lake or river), permanent ice or a built-up area, so there is nothing to plant and no other data
          was fetched.
        </p>
        <p className="state-hint">
          {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)}
        </p>
        <button className="primary-button" onClick={() => navigate("/map")}>
          <MapPin size={17} /> Choose another spot
        </button>
      </section>,
    );
  }

  // Step 2: soil found (or the soil service is down) → wait for the climate data.
  if (snapshot.power.status === "loading" || snapshot.power.status === "idle") {
    return shell(
      <section className="analysis-state">
        <RefreshCw size={28} className="spin" />
        <h1>Fetching NASA data for your field</h1>
        <p>
          {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)} ·{" "}
          {snapshot.soil.status === "ok" ? "soil found ✓" : "soil map unavailable, continuing"} · daily records since April 2015.
          Your chosen data loads first; the rest follows in the background.
        </p>
        <div className="state-sources">
          {(["power", "soil", "terrain", "ndvi"] as SourceId[]).map((id) => (
            <span key={id} className={snapshot?.[id]?.status === "ok" ? "done" : ""}>
              {snapshot?.[id]?.status === "ok" ? "✓ " : ""}
              {SOURCE_INFO[id].name}
            </span>
          ))}
        </div>
      </section>,
    );
  }

  if (snapshot.power.status === "error" || !analysis) {
    return shell(
      <section className="analysis-state error">
        <AlertTriangle size={28} />
        <h1>NASA data could not be loaded</h1>
        <p>{built?.error ?? snapshot.power.error}</p>
        <p className="state-hint">
          Check your internet connection and try again. Without NASA POWER the tool shows no values, so nothing on
          this page is ever guessed.
        </p>
        <button className="primary-button" onClick={() => retry("power")}>
          <RefreshCw size={17} /> Try again
        </button>
      </section>,
    );
  }

  /* ----------------------------------- loaded ----------------------------------- */

  const a = analysis;

  if (!a.landStatus.farmable || a.resilienceScore === null) {
    return shell(
      <section className="analysis-state not-farmable">
        <div className="na-score" aria-label="Resilience not applicable">
          <strong>N/A</strong>
          <span>resilience</span>
        </div>
        <h1>{a.landStatus.title}</h1>
        <p>{a.landStatus.reason}</p>
        <p className="state-hint">
          {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)}
          {a.climate.meanTemperature !== null ? ` · mean temperature ${a.climate.meanTemperature} °C` : ""}
          {a.water.rainfall !== null ? ` · ${a.water.rainfall} mm precipitation in 12 months` : ""}
        </p>
        <button className="primary-button" onClick={() => navigate("/map")}>
          <MapPin size={17} /> Choose another spot
        </button>
      </section>,
    );
  }

  const resilience = a.resilienceScore;
  const ready = (layer: LayerId) => layerReadiness(layer, snapshot);
  const sourceLoading = (id: SourceId) => ["loading", "idle"].includes(snapshot[id]?.status ?? "idle");
  const findings: Finding[] = buildFindings(a, layers, sourceLoading).map((f, i) => ({ ...f, id: `${f.layer}-${i}` }));
  const projection = a.extras.projection;
  const applyProjection = () => {
    if (!projection) return;
    setScenario({
      deltaT: Math.min(4, Math.max(-1, Math.round(projection.deltaT * 2) / 2)),
      rainPct: Math.min(30, Math.max(-40, Math.round(projection.rainPct / 5) * 5)),
    });
    openFaq("rotations");
  };
  const rotations = recommendation?.rotations ?? [];
  const top = rotations.find((r) => r.recommended);
  const current = rotations.find((r) => r.id === "current");
  // Three options: the current / typical local rotation plus the two best alternatives.
  const shownRotations = [
    ...(current ? [current] : []),
    ...rotations
      .filter((r) => r.id !== "current")
      .sort((x, y) => y.score - x.score)
      .slice(0, current ? 2 : 3),
  ];
  const openRotation = shownRotations.find((r) => r.id === selectedRotation) ?? null;
  const cropFits = recommendation?.cropFits ?? [];
  const scenarioActive = scenario.deltaT !== 0 || scenario.rainPct !== 0;
  const verdict =
    resilience >= 75
      ? "Your field is in good shape overall."
      : resilience >= 55
        ? "Your field shows some pressure worth watching."
        : "Your field is under significant pressure.";

  // Colour rules for the "Last 12 months" values (green = fine, yellow = watch, red = concern).
  const toneBy = (bad: boolean, watch: boolean): MetricTone => (bad ? "bad" : watch ? "watch" : "good");
  const soilA = a.water.rootZoneAnomaly ?? 0;
  const rainA = a.water.rainfallAnomaly ?? 0;
  const tempA = a.climate.temperatureAnomaly ?? 0;
  const extraHeat = (a.climate.heatStressDays ?? 0) - (a.climate.heatStressBaseline ?? a.climate.heatStressDays ?? 0);
  const extraFrost = (a.climate.frostDays ?? 0) - (a.climate.frostBaseline ?? a.climate.frostDays ?? 0);
  const om = a.soil.organicMatter;
  const tones = {
    moisture: toneBy(soilA <= -10 || (a.water.rootZoneWetness ?? 1) < 0.3, soilA <= -4 || (a.water.rootZoneWetness ?? 1) < 0.4),
    rain: toneBy(rainA <= -15, rainA <= -5 || rainA >= 40),
    balance: toneBy(a.water.waterStress >= 55, a.water.waterStress >= 35),
    temp: toneBy(tempA >= 1.5, tempA >= 0.8 || tempA <= -1.5),
    heat: toneBy(extraHeat >= 15, extraHeat >= 5),
    frost: toneBy(extraFrost >= 20, extraFrost >= 8),
    ndvi: toneBy(a.vegetation.vegetationStress === "high", a.vegetation.vegetationStress === "moderate"),
    erosion: toneBy(a.soil.erosionRisk === "high", a.soil.erosionRisk === "moderate"),
    soil: om === null ? undefined : toneBy(om < 1.5, om < 2.5),
  };

  // Every measurement once, as data: the cards and the PDF report both use this list.
  const gw = a.extras.groundwater;
  const measures: (Omit<ReportMeasurement, "change"> & {
    key: string;
    layer: LayerId;
    icon: LucideIcon;
    trend?: number | null;
    trendText?: string;
    shown: boolean;
  })[] = [
    { key: "moisture", layer: "moisture", shown: a.water.rootZoneWetness !== null, tone: tones.moisture, icon: Droplets, label: "Soil moisture", value: pct(a.water.rootZoneWetness), description: "Top metre of soil", trend: a.water.rootZoneAnomaly },
    { key: "groundwater", layer: "moisture", shown: !!gw, tone: gw ? toneBy(gw.trendMPerDecade > 0.5, gw.trendMPerDecade > 0.1) : undefined, icon: Droplets, label: "Groundwater depth", value: gw ? `${gw.latestDepthM} m` : "—", description: gw ? `Nearest well, ${gw.distanceKm} km` : "" },
    { key: "rain", layer: "rain", shown: true, tone: tones.rain, icon: CloudRain, label: "Rainfall", value: show(a.water.rainfall, " mm"), description: `${show(a.water.heavyRainDays)} heavy-rain days`, trend: a.water.rainfallAnomaly },
    { key: "balance", layer: "rain", shown: true, tone: tones.balance, icon: Droplets, label: "Water balance", value: show(a.water.waterBalance, " mm"), description: "Rain minus crop demand" },
    { key: "openet", layer: "rain", shown: !!a.extras.openet, icon: CloudRain, label: "Actual water use", value: a.extras.openet ? `${a.extras.openet.annualEt} mm` : "—", description: a.extras.openet ? `Satellite estimate, ${a.extras.openet.year}` : "" },
    { key: "temp", layer: "temperature", shown: true, tone: tones.temp, icon: Thermometer, label: "Mean temperature", value: show(a.climate.meanTemperature, "°C"), description: `Max ${show(a.climate.maxTemperature, " °C")}`, trend: a.climate.temperatureAnomaly, trendText: a.climate.temperatureAnomaly !== null ? `${Math.abs(a.climate.temperatureAnomaly)}°C` : undefined },
    { key: "heat", layer: "temperature", shown: true, tone: tones.heat, icon: Flame, label: `Days above ${THRESHOLDS.heatDayC} °C`, value: show(a.climate.heatStressDays, " days"), description: `Typically ${show(a.climate.heatStressBaseline)}` },
    { key: "frost", layer: "temperature", shown: true, tone: tones.frost, icon: Snowflake, label: "Frost days", value: show(a.climate.frostDays, " days"), description: `Typically ${show(a.climate.frostBaseline)}` },
    { key: "ndvi", layer: "vegetation", shown: a.vegetation.ndvi !== null, tone: tones.ndvi, icon: Leaf, label: "Vegetation greenness", value: show(a.vegetation.ndvi), description: a.vegetation.date ?? "", trend: a.vegetation.ndviAnomaly },
    { key: "erosion", layer: "terrain", shown: a.soil.slope !== null, tone: tones.erosion, icon: Mountain, label: "Erosion risk", value: a.soil.erosionRisk, description: `Slope ${show(a.soil.slope, "%")}` },
    { key: "soil", layer: "soil", shown: a.soil.soilSource !== null, tone: tones.soil, icon: Sprout, label: "Soil", value: a.soil.soilType ?? "—", description: `Organic matter ${show(a.soil.organicMatter, "%")} · pH ${show(a.soil.ph)}` },
  ];
  // Same order as before: groundwater and actual water use come after the main cards.
  const order = ["moisture", "rain", "balance", "temp", "heat", "frost", "ndvi", "erosion", "soil", "groundwater", "openet"];
  measures.sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key));

  const cardsFor = (layerSet: LayerId[]) =>
    measures
      .filter((m) => m.shown && layerSet.includes(m.layer))
      .map(({ key, layer: _layer, shown: _shown, ...m }) => <MetricCard key={key} {...m} />);

  const changeText = (trend?: number | null, trendText?: string) =>
    trend === undefined || trend === null
      ? null
      : `${trend > 0 ? "+" : trend < 0 ? "−" : ""}${trendText ?? `${Math.abs(trend)}%`} vs normal`;

  const downloadReport = () =>
    downloadFieldReport({
      field,
      analysis: a,
      verdict,
      // The report holds everything, not only the layers chosen on screen.
      findings: buildFindings(a, LAYERS.map((l) => l.id), sourceLoading),
      measurements: measures
        .filter((m) => m.shown)
        .map((m) => ({ label: m.label, value: m.value, description: m.description, tone: m.tone, change: changeText(m.trend, m.trendText) })),
      rotations: shownRotations,
      cropFits,
      priorities,
      constraints,
      farmerNote,
      scenario,
    });
  const stillLoading = a.sources.some((source) => source.pending);

  const faqItems: AccordionItem[] = [
    {
      id: "rotations",
      title: "Which rotation should I consider?",
      render: () => (
        <>
          <p className="faq-lead">Ranked on your priorities. The first one is your current or typical rotation.</p>
          <div className={`scenario-panel ${scenarioActive ? "active" : ""}`}>
            <div className="scenario-title">
              <SlidersHorizontal size={18} />
              <div>
                <strong>What if the climate shifts?</strong>
                <span>See how the ranking changes in a warmer or drier future.</span>
              </div>
              {projection && (
                <button type="button" className="scenario-reset scenario-cmip" onClick={applyProjection}>
                  Use the 2041–2050 outlook
                </button>
              )}
              {scenarioActive && (
                <button type="button" className="scenario-reset" onClick={() => setScenario({ deltaT: 0, rainPct: 0 })}>
                  Reset
                </button>
              )}
            </div>
            <label>
              <span>
                Temperature <b>{signed(scenario.deltaT)} °C</b>
              </span>
              <input type="range" min={-1} max={4} step={0.5} value={scenario.deltaT} onChange={(e) => setScenario({ ...scenario, deltaT: Number(e.target.value) })} />
            </label>
            <label>
              <span>
                Rainfall <b>{signed(scenario.rainPct)}%</b>
              </span>
              <input type="range" min={-40} max={30} step={5} value={scenario.rainPct} onChange={(e) => setScenario({ ...scenario, rainPct: Number(e.target.value) })} />
            </label>
          </div>
          {rotations.length === 0 && (
            <p className="faq-lead">
              No crop in the library has a long or warm enough season here, so no rotation is suggested. Local
              specialists (greenhouses, hardy forage or grazing) are the better route for this climate.
            </p>
          )}
          {shownRotations.length > 0 && (
            <>
              <div className="rotation-picker" role="list">
                {shownRotations.map((rotation, index) => {
                  const isOpen = rotation.id === selectedRotation;
                  return (
                    <button
                      key={rotation.id}
                      type="button"
                      role="listitem"
                      className={`rotation-pick ${isOpen ? "open" : ""} ${rotation.recommended ? "recommended" : ""}`}
                      onClick={() => setSelectedRotation(isOpen ? null : rotation.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="rotation-pick-rank">{index + 1}</span>
                      <span className="rotation-pick-text">
                        <strong>{rotation.name}</strong>
                        <small>
                          {[rotation.recommended ? "Best match for your priorities" : null, rotation.strategy]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <span className="rotation-pick-score">
                        <b>{rotation.score}</b>/100
                      </span>
                      <ChevronDown size={18} className="rotation-pick-chevron" />
                    </button>
                  );
                })}
              </div>
              {openRotation ? (
                <div className="rotation-list">
                  <RotationCard
                    key={openRotation.id}
                    rotation={openRotation}
                    rank={shownRotations.indexOf(openRotation) + 1}
                  />
                </div>
              ) : (
                <p className="rotation-pick-hint">Tap a rotation to see its calendar and details.</p>
              )}
            </>
          )}
        </>
      ),
    },
    {
      id: "crops",
      title: "Which crops suit this field?",
      render: () => (
        <>
          <p className="faq-lead">
            Fit with this field's climate and soil{constraints.irrigation ? ", with irrigation" : ""}.
          </p>
          {a.extras.usdaYields && (
            <p className="faq-lead">
              Recent yields in {a.extras.usdaYields.county}, {a.extras.usdaYields.state}:{" "}
              {a.extras.usdaYields.crops
                .map((c) => `${c.commodity} ${c.latest} ${c.unit.toLowerCase()} (${c.latestYear})`)
                .join(" · ")}
            </p>
          )}
          <table className="crop-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Season</th>
                <th>Fit</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {cropFits.slice(0, 12).map((f) => {
                const common = marketScore(f.crop.id, a.country?.code ?? null, a.latitude, a.longitude) >= 60;
                const notes = [
                  common ? "common locally" : null,
                  f.crop.nFix ? "fixes nitrogen" : null,
                  f.crop.droughtTol >= 0.7 ? "drought-tolerant" : null,
                  f.crop.heatTol >= 0.8 ? "heat-tolerant" : null,
                ].filter(Boolean);
                return (
                  <tr key={f.crop.id}>
                    <td>{f.crop.name}</td>
                    <td>{f.best ? monthRange(f.best.occupied) : "—"}</td>
                    <td>
                      <span className="crop-fit">
                        <i style={{ width: `${f.score}%` }} />
                      </span>
                      {f.score}
                    </td>
                    <td>{notes.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ),
    },
    {
      id: "year",
      title: "Was this year normal?",
      render: () => <YearComparison a={a} />,
    },
    {
      id: "season",
      title: "When is the field most vulnerable?",
      render: () => <SeasonStrip a={a} />,
    },
    {
      id: "outlook",
      title: "What could the coming years look like?",
      render: () => <Outlook a={a} onApply={applyProjection} />,
    },
    {
      id: "reliability",
      title: "How reliable is this?",
      render: () => (
        <>
          <div className="smap-caveats">
            {a.caveats.map((caveat) => (
              <div key={caveat}>
                <AlertTriangle size={16} />
                <span>{caveat}</span>
              </div>
            ))}
          </div>
          <div className="tradeoff-grid">
            <div>
              <strong>Weather</strong>
              <span>Future seasons can behave differently from the 2015–present record.</span>
            </div>
            <div>
              <strong>Soil variability</strong>
              <span>Soil and moisture vary within a field; satellite data averages them out.</span>
            </div>
            <div>
              <strong>Markets</strong>
              <span>Prices, contracts and demand are not measured here. Check them before you commit.</span>
            </div>
            <div>
              <strong>Local knowledge</strong>
              <span>Varieties, pests, machinery and labour are best judged by you and your agronomist.</span>
            </div>
          </div>
        </>
      ),
    },
    ...(farmerNote
      ? [{ id: "note", title: "What did I tell AgroCycle?", render: () => <p className="faq-lead">{farmerNote}</p> }]
      : []),
    {
      id: "glossary",
      title: "What do the terms mean?",
      render: () => <Glossary />,
    },
    {
      id: "sources",
      title: "Where does the data come from?",
      render: () => <Sources a={a} retry={retry} />,
    },
  ];

  return (
    <div className="app-shell">

      <main className="page-container analysis-page essentials-page">
        <section className="essentials-hero">
          <div className="essentials-hero-top">
            <h1>Your field at a glance</h1>
            <button
              type="button"
              className="primary-button report-button"
              onClick={downloadReport}
              title={stillLoading ? "Some extra data is still loading; it will be marked as such in the report." : "Save every value for this field as a PDF"}
            >
              <Download size={17} /> Download report
            </button>
          </div>
          <div className="location-pill">
            <MapPin size={15} />
            <span>
              {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)}
              {a.country ? ` · ${a.country.name}` : ""}
            </span>
            <strong>
              {field.selectionType === "point"
                ? "Point analysis"
                : `${field.area.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`}
            </strong>
          </div>
        </section>

        {/* Field resilience as a folder: a tab on the top left of the card,
            with the data selection beside it. */}
        <div className="folder resilience-folder">
          <div className="folder-top">
            <span className="eyebrow folder-tab">Field resilience</span>
            <section className="layer-bar" aria-label="Data shown">
              {LAYERS.map((layer) => {
                const active = layers.includes(layer.id);
                const state = ready(layer.id);
                return (
                  <button
                    key={layer.id}
                    type="button"
                    className={`layer-chip ${active ? "active" : ""} ${state}`}
                    onClick={() => toggleLayer(layer.id)}
                    aria-pressed={active}
                    title={state === "loading" ? "Loading in the background" : state === "error" ? "Not available right now" : undefined}
                  >
                    {active && <CheckCircle2 size={14} />}
                    {layer.label}
                    {state === "loading" && <RefreshCw size={12} className="spin" />}
                    {state === "error" && <AlertTriangle size={12} />}
                  </button>
                );
              })}
            </section>
          </div>

          <section className="essentials-card">
            <div className="essentials-score">
              <div className="resilience-score">
                <strong>{resilience}</strong>
                <span>/100</span>
              </div>
              <div>
                <h2>{verdict}</h2>
                <p>Last 12 months · data confidence {a.confidence}</p>
                {a.resilienceParts.length > 0 && (
                  <details className="score-parts">
                    <summary>What is behind this score</summary>
                    <ul>
                      {a.resilienceParts.map((part) => (
                        <li key={part.id}>
                          <span>{part.label}</span>
                          <i className="score-part-bar">
                            <i
                              className={part.mark >= 75 ? "good" : part.mark >= 55 ? "watch" : "bad"}
                              style={{ width: `${part.mark}%` }}
                            />
                          </i>
                          <b>{part.mark}</b>
                          <small>{part.weight}%</small>
                        </li>
                      ))}
                    </ul>
                    <p>
                      Weighted average of the marks above. Missing data is left out rather than counted against the field.
                    </p>
                  </details>
                )}
              </div>
            </div>

            <ul className="findings">
              {findings.map((f) =>
                f.tone === "loading" || f.tone === "missing" ? (
                  <li key={f.id} className="finding pending">
                    <strong>{f.title}</strong>
                    {f.tone === "loading" ? (
                      <RefreshCw size={14} className="spin finding-status" aria-label="Loading" />
                    ) : (
                      <small className="finding-status">Not available</small>
                    )}
                  </li>
                ) : (
                  // The explanation stays folded away behind a small arrow.
                  <li key={f.id} className="finding">
                    <details>
                      <summary>
                        <strong>{f.title}</strong>
                        <ChevronDown size={16} className="finding-chevron" aria-hidden="true" />
                      </summary>
                      <p>{f.text}</p>
                    </details>
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>

        {cardsFor(layers).length > 0 && (
          <section className="measurements-card" aria-label="Measurements">
            <span className="eyebrow">Last 12 months</span>
            <div className="metric-grid">
              {cardsFor(layers)}
            </div>
            {layers.includes("vegetation") && a.extras.sentinel2 && (
              <a className="source-link" href={a.extras.sentinel2.browserUrl} target="_blank" rel="noreferrer">
                Latest satellite image of this field <ExternalLink size={12} />
              </a>
            )}
          </section>
        )}

        {top && (
          // A folder like the field resilience card: the score sits in the tab.
          <div className="folder rotation-folder">
            <div className="folder-top">
              <div className="folder-tab rotation-score" aria-label={`Score ${top.score} out of 100`}>
                <strong>{top.score}</strong>
                <span>/100</span>
              </div>
              <span className="folder-caption">Suggested rotation</span>
            </div>
            <section className="suggestion-card">
              <div className="suggestion-head">
                <h2>{top.name}</h2>
              </div>
              <ol className="suggestion-crops">
                {cropSchedule(top.calendar).map((crop, i) => (
                  <li key={`${crop.name}-${i}`}>
                    <b>{crop.name}</b>
                    {crop.wholeYear ? (
                      <span>All year</span>
                    ) : (
                      <span>
                        Plant {crop.plant}
                        <br />
                        Harvest {crop.harvest}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}

        <section className="faq-section">
          <div className="faq-heading">
            <h2>Questions you might have</h2>
          </div>
          <Accordion items={faqItems} open={open} onToggle={toggleFaq} />
        </section>

        <p className="essentials-footnote">A decision aid, not a replacement for local agronomic advice.</p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section components                                                  */
/* ------------------------------------------------------------------ */

function SeasonStrip({ a }: { a: FieldAnalysis }) {
  const maxRain = Math.max(...a.monthly.map((m) => m.rainMm ?? 0), 1);
  return (
    <>
      <p className="faq-lead">A typical year since 2015. Bars show soil moisture, the line shows rain.</p>
      <div className="season-strip">
        {a.monthly.map((month) => {
          const wet = month.rootWetness ?? 0;
          const flags = [
            month.rootWetness !== null && month.rootWetness < 0.45 ? "Dry" : null,
            month.frostDays >= 5 ? "Frost" : null,
            month.heatDays >= 2 ? "Heat" : null,
          ].filter(Boolean) as string[];
          return (
            <div
              className="season-month"
              key={month.month}
              title={`${month.month}: soil moisture ${pct(month.rootWetness)}, rain ${show(month.rainMm, " mm")}, ${month.frostDays} frost days, ${month.heatDays} hot days`}
            >
              <div className="season-bar-area">
                <div className="season-bar" style={{ height: `${Math.max(wet * 100, 4)}%` }} />
                <i className="season-rain" style={{ bottom: `${((month.rainMm ?? 0) / maxRain) * 92}%` }} />
              </div>
              <strong>{month.month}</strong>
              <span>{pct(month.rootWetness)}</span>
              <div className="season-flags">
                {flags.map((flag) => (
                  <em key={flag}>{flag}</em>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const withUnit = (value: number, unit: string) => (unit === "%" ? `${value}%` : `${value} ${unit}`);

function YearComparison({ a }: { a: FieldAnalysis }) {
  const rows = yearComparison(a);
  if (!rows.length) return <p className="faq-lead">There are not enough earlier years yet to compare with.</p>;
  return (
    <>
      <p className="faq-lead">The last 12 months next to the average of earlier years at this field.</p>
      <div className="year-compare">
        {rows.map((row) => {
          const max = Math.max(row.normal, row.current, 1);
          return (
            <div className="year-row" key={row.id}>
              <span className="year-label">{row.label}</span>
              <div className="year-bars">
                <div className="year-bar-line">
                  <span className="year-track">
                    <i className="year-bar normal" style={{ width: `${(row.normal / max) * 100}%` }} />
                  </span>
                  <span>Normal {withUnit(row.normal, row.unit)}</span>
                </div>
                <div className="year-bar-line">
                  <span className="year-track">
                    <i className="year-bar current" style={{ width: `${(row.current / max) * 100}%` }} />
                  </span>
                  <span>This year {withUnit(row.current, row.unit)}</span>
                </div>
              </div>
              <span className={`year-change ${row.change > 0 ? "up" : row.change < 0 ? "down" : ""}`}>
                {row.normal === 0 && row.current === 0 ? "—" : Math.abs(row.change) < 1 ? "0%" : `${row.change > 0 ? "+" : ""}${row.change}%`}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Outlook({ a, onApply }: { a: FieldAnalysis; onApply: () => void }) {
  const p = a.extras.projection;
  return (
    <>
      <div className="odds-row">
        <div>
          <strong>
            {a.odds.dryGrowingSeasons.count} of {a.odds.dryGrowingSeasons.of}
          </strong>
          <span>recent growing seasons were dry</span>
        </div>
        <div>
          <strong>
            {a.odds.hotYears.count} of {a.odds.hotYears.of}
          </strong>
          <span>recent years had 10 or more days above {THRESHOLDS.heatDayC} °C</span>
        </div>
        <div>
          <strong>
            {a.odds.lateFrostYears.count} of {a.odds.lateFrostYears.of}
          </strong>
          <span>recent years had a late spring frost</span>
        </div>
      </div>

      {a.trends.length > 0 ? (
        <>
          <p className="faq-lead">If recent years' pattern continues. Not a weather forecast.</p>
          <table className="outlook-table">
            <thead>
              <tr>
                <th>Measure</th>
                <th>Last full year</th>
                <th>Expected by {a.trends[0].projectionYear}</th>
                <th>Direction</th>
              </tr>
            </thead>
            <tbody>
              {a.trends.map((trend) => {
                const last = trend.values[trend.values.length - 1];
                return (
                  <tr key={trend.id}>
                    <td>{trend.label}</td>
                    <td>{last ? withUnit(last.value, trend.unit) : "—"}</td>
                    <td>
                      {withUnit(trend.projection, trend.unit)}
                      <small>
                        likely {trend.low}–{trend.high}
                      </small>
                    </td>
                    <td>{!trend.significant ? "No clear change" : trend.slopePerDecade > 0 ? "Rising" : "Falling"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <p className="faq-lead">There are not yet enough complete years of data to show where this field is heading.</p>
      )}

      {p && (
        <div className="cmip-card">
          <span className="eyebrow">Longer term</span>
          <div>
            <h3>
              By {p.future}: about {signed(p.deltaT)} °C and {signed(p.rainPct)}% rain
            </h3>
            <p>
              Climate model average vs {p.baseline}. Days above 32 °C: {p.hotDaysBaseline} → {p.hotDaysFuture} a year.
            </p>
          </div>
          <button type="button" className="primary-button" onClick={onApply}>
            Test the rotations under this climate <ArrowRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function Glossary() {
  const terms: [string, string][] = [
    ["Soil moisture", "How full the soil is with water, from 0% (bone dry) to 100% (saturated). The root zone is the top metre that crops draw water from."],
    ["Compared with earlier years", "The difference from what is normal for this place and time of year. −15% means 15% drier than the same months in earlier years."],
    ["Crop water demand", "How much water a crop would use through evaporation from the soil and its leaves in the current weather."],
    ["Water balance", "Rain minus crop water demand. A negative value means crops rely on water stored in the soil, or on irrigation."],
    ["Greenness (NDVI)", "A satellite measure of how green and dense the vegetation is. Healthy crops are around 0.6–0.9; bare soil is around 0.1–0.2."],
    ["Frost and hot days", `Days with a minimum at or below 0 °C, which damages tender crops, and days at or above ${THRESHOLDS.heatDayC} °C, which stress flowering and grain fill.`],
    ["Cover crop", "A crop grown between main crops to protect and feed the soil. Legumes such as peas and beans also add nitrogen for the next crop."],
  ];
  return (
    <dl className="glossary-list">
      {terms.map(([term, text]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Sources({ a, retry }: { a: FieldAnalysis; retry: (id: SourceId) => void }) {
  return (
    <>
      <p className="faq-lead">Fetched live for your coordinates.</p>
      <div className="source-status-list">
        {a.sources.map((source) => (
          <div key={source.id} className={`source-status ${source.ok ? "ok" : source.pending ? "pending" : source.notApplicable ? "na" : "off"}`}>
            {source.ok ? (
              <CheckCircle2 size={16} />
            ) : source.pending ? (
              <RefreshCw size={16} className="spin" />
            ) : (
              <AlertTriangle size={16} />
            )}
            <div>
              <a href={source.url} target="_blank" rel="noreferrer">
                <strong>{source.name}</strong>
              </a>
              <small>{source.provider}</small>
              <span>
                {source.ok || source.pending ? source.detail : source.notApplicable ? `Not used here: ${source.detail}` : `Unavailable right now: ${source.detail}`}
              </span>
              {!source.ok && !source.pending && !source.notApplicable && (
                <button type="button" className="source-retry" onClick={() => retry(source.id as SourceId)}>
                  <RefreshCw size={12} /> Retry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
