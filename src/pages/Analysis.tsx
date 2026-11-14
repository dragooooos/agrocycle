import "./Analysis.css";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CloudRain,
  Droplets,
  ExternalLink,
  FileText,
  Flame,
  Leaf,
  MapPin,
  Mountain,
  RefreshCw,
  Satellite,
  SlidersHorizontal,
  Snowflake,
  Sprout,
  Thermometer,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header";
import MetricCard from "../components/MetricCard";
import RotationCard from "../components/RotationCard";
import Accordion, { type AccordionItem } from "../components/Accordion";

import { SMAP_DOCUMENTS, SMAP_EVIDENCE, type SmapDocKind } from "../data/smapLibrary";
import { LAYERS, readLayers, saveLayers, sourcesFor } from "../data/layers";
import { marketScore } from "../data/markets";
import { useFieldSources } from "../services/useFieldSources";
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
import { getScoreTone } from "../utils/scoring";
import type {
  FarmerConstraints,
  FieldAnalysis,
  FieldSelection,
  LayerId,
  PriorityId,
  RiskLevel,
  SourceId,
  Trend,
} from "../types";

type Status = "good" | "moderate" | "bad";

const show = (value: number | null | undefined, unit = "") =>
  value === null || value === undefined ? "—" : `${value}${unit}`;
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
const riskStatus = (risk: RiskLevel | null): Status =>
  risk === "high" ? "bad" : risk === "moderate" ? "moderate" : "good";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const OTHER_RESOURCES: { name: string; url: string; note: string }[] = [
  { name: "Copernicus Climate Data Store", url: "https://cds.climate.copernicus.eu/datasets", note: "Connected through Open-Meteo: ERA5-Land soil moisture and CMIP6 projections. The CDS API itself queues jobs and needs a key, so it cannot be called from a browser." },
  { name: "Copernicus Data Space", url: "https://dataspace.copernicus.eu/", note: "Connected: the STAC catalogue lists recent cloud-free Sentinel-2 images. Pixel values (e.g. 10 m NDVI) need an account and OAuth, which requires a backend." },
  { name: "USGS Water Data", url: "https://waterdata.usgs.gov/", note: "Connected (US): groundwater-level trends from the nearest well with a multi-year record." },
  { name: "USDA NASS Quick Stats", url: "https://quickstats.nass.usda.gov/", note: "Connected through the local proxy when NASS_API_KEY is set in .env: county crop yields. The API blocks browser calls." },
  { name: "OpenET", url: "https://etdata.org/api/", note: "Connected through the local proxy when OPENET_API_KEY is set in .env: field-scale actual evapotranspiration (US)." },
  { name: "USDA AMS Market News", url: "https://www.ams.usda.gov/market-news", note: "Not connected: prices come as individual reports (by commodity and market) behind an API key; mapping them to every crop and region needs a backend job." },
  { name: "LANDFIRE", url: "https://www.landfire.gov/", note: "Not connected: US vegetation, fuel and topography layers delivered through asynchronous download jobs; aimed at wildfire, little added value for crop rotation." },
  { name: "GEDI", url: "https://gedi.umd.edu/data-collection-started/", note: "Not connected: lidar forest structure and biomass, sampled along tracks; it says little about cropland and needs an Earthdata login." },
];

const DOC_ORDER: SmapDocKind[] = [
  "User guide",
  "Product specification",
  "ATBD",
  "Assessment report",
  "Ancillary / general",
  "Validation campaign",
  "Salinity (ocean)",
];

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
  emoji: string;
  title: string;
  text: string;
}

function buildFindings(
  a: FieldAnalysis,
  layers: LayerId[],
  sourceLoading: (id: SourceId) => boolean,
): Omit<Finding, "id">[] {
  const findings: Omit<Finding, "id">[] = [];
  const pending = (layer: LayerId, emoji: string, title: string, source: SourceId): Omit<Finding, "id"> =>
    sourceLoading(source)
      ? { layer, tone: "loading", emoji, title, text: "Still loading from the data service…" }
      : { layer, tone: "missing", emoji, title, text: "The data service did not answer. You can retry below." };
  const x = a.extras;

  if (layers.includes("moisture")) {
    const w = a.water.rootZoneWetness;
    const anomaly = a.water.rootZoneAnomaly;
    if (w === null) findings.push(pending("moisture", "💧", "Soil moisture", "power"));
    else {
      const tone = anomaly !== null && anomaly <= -10 ? "bad" : anomaly !== null && anomaly <= -4 ? "watch" : "good";
      const title =
        anomaly === null ? "Soil moisture" : anomaly <= -4 ? "Soil is drier than usual" : anomaly >= 4 ? "Soil is wetter than usual" : "Soil moisture is normal";
      findings.push({
        layer: "moisture",
        tone,
        emoji: "💧",
        title,
        text: `The root zone is ${pct(w)} full of water${anomaly !== null ? ` (${signed(anomaly)}% compared with earlier years)` : ""}.${
          x.era5?.rootZone != null
            ? ` Copernicus ERA5-Land: ${x.era5.rootZone} m³/m³${x.era5.rootZoneAnomaly !== null ? ` (${signed(x.era5.rootZoneAnomaly)}%)` : ""}.`
            : ""
        }`,
      });
    }
    if (x.groundwater) {
      const g = x.groundwater;
      const deeper = g.trendMPerDecade > 0.1;
      const shallower = g.trendMPerDecade < -0.1;
      findings.push({
        layer: "moisture",
        tone: g.trendMPerDecade > 0.5 ? "bad" : deeper ? "watch" : "good",
        emoji: "🚰",
        title: deeper ? "Groundwater is dropping" : shallower ? "Groundwater is rising" : "Groundwater is stable",
        text: `Nearest USGS well (${g.distanceKm} km): water ${g.latestDepthM} m below ground in ${g.latestDate.slice(0, 4)}, ${signed(g.trendMPerDecade)} m per decade since ${g.firstYear}.`,
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
      emoji: "🌡️",
      title:
        anomaly === null ? "Temperature" : anomaly >= 0.5 ? "Warmer than usual" : anomaly <= -0.5 ? "Cooler than usual" : "Temperatures are normal",
      text: `Average ${show(a.climate.meanTemperature, " °C")}${anomaly !== null ? ` (${signed(anomaly)} °C)` : ""}, ${heat} very hot days (≥ ${THRESHOLDS.heatDayC} °C) and ${show(a.climate.frostDays)} frost days in the last 12 months.`,
    });
  }

  if (layers.includes("rain")) {
    const anomaly = a.water.rainfallAnomaly;
    const balance = a.water.waterBalance;
    const tone = (anomaly ?? 0) <= -15 ? "bad" : (anomaly ?? 0) <= -5 ? "watch" : "good";
    findings.push({
      layer: "rain",
      tone,
      emoji: "🌧️",
      title: anomaly === null ? "Rainfall" : anomaly <= -5 ? "Less rain than usual" : anomaly >= 5 ? "More rain than usual" : "Normal rainfall",
      text: `${show(a.water.rainfall, " mm")} in 12 months${anomaly !== null ? ` (${signed(anomaly)}%)` : ""}.${
        balance !== null && balance < 0 ? ` Crops could use ${Math.abs(balance)} mm more water than fell as rain.` : ""
      }${x.openet ? ` Measured water use here (OpenET, ${x.openet.year}): ${x.openet.annualEt} mm.` : ""}`,
    });
  }

  if (layers.includes("vegetation")) {
    const s2 = x.sentinel2 ? ` Latest clear Sentinel-2 image: ${x.sentinel2.latestDate} (${x.sentinel2.cloudCover}% cloud).` : "";
    if (a.vegetation.ndvi === null) {
      const p = pending("vegetation", "🌿", "Vegetation health", "ndvi");
      findings.push({ ...p, text: p.text + s2 });
    }
    else {
      const anomaly = a.vegetation.ndviAnomaly;
      findings.push({
        layer: "vegetation",
        tone: a.vegetation.vegetationStress === "high" ? "bad" : a.vegetation.vegetationStress === "moderate" ? "watch" : "good",
        emoji: "🌿",
        title: anomaly === null ? "Vegetation greenness" : anomaly <= -3 ? "Vegetation is less green than usual" : "Vegetation looks normal",
        text: `Greenness index ${a.vegetation.ndvi}${anomaly !== null ? ` (${signed(anomaly)}% vs the same weeks in earlier years)` : ""}, image from ${a.vegetation.date}.${s2}`,
      });
    }
  }

  if (layers.includes("terrain")) {
    if (a.soil.slope === null) findings.push(pending("terrain", "⛰️", "Slope & erosion", "terrain"));
    else
      findings.push({
        layer: "terrain",
        tone: a.soil.erosionRisk === "high" ? "bad" : a.soil.erosionRisk === "moderate" ? "watch" : "good",
        emoji: "⛰️",
        title: `Erosion risk is ${a.soil.erosionRisk}`,
        text: `Slope about ${a.soil.slope}% at ${show(a.soil.elevation, " m")} elevation, with ${show(a.water.heavyRainDays)} heavy-rain days last year.`,
      });
  }

  if (layers.includes("soil")) {
    if (a.soil.soilSource === null) findings.push(pending("soil", "🟫", "Soil properties", "soil"));
    else {
      const om = a.soil.organicMatter;
      const ph = a.soil.ph;
      const phText = ph === null ? "" : ph < 5.5 ? `, acidic (pH ${ph})` : ph > 7.8 ? `, alkaline (pH ${ph})` : `, pH ${ph}`;
      findings.push({
        layer: "soil",
        tone: om !== null && om < 1.5 ? "bad" : om !== null && om < 2.5 ? "watch" : "good",
        emoji: "🟫",
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
  const field = readJson<FieldSelection | null>("farmrotate:field", null);
  const priorities = readJson<PriorityId[]>("farmrotate:priorities", []);
  const farmerNote = sessionStorage.getItem("farmrotate:note") || "";
  const constraints = readJson<FarmerConstraints>("farmrotate:constraints", {
    irrigation: false,
    livestock: false,
    currentCrops: [],
  });

  const [layers, setLayers] = useState<LayerId[]>(readLayers);
  const [scenario, setScenario] = useState<Scenario>({ deltaT: 0, rainPct: 0 });
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
      <Header selected />
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

  if (!snapshot || snapshot.power.status === "loading" || snapshot.power.status === "idle") {
    return shell(
      <section className="analysis-state">
        <RefreshCw size={28} className="spin" />
        <h1>Fetching NASA data for your field</h1>
        <p>
          {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)} · daily records since April 2015. Your chosen
          data loads first; the rest follows in the background.
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
  const tone = getScoreTone(a.resilienceScore);
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
  const cropFits = recommendation?.cropFits ?? [];
  const scenarioActive = scenario.deltaT !== 0 || scenario.rainPct !== 0;
  const verdict =
    a.resilienceScore >= 75
      ? "Your field is in good shape overall."
      : a.resilienceScore >= 50
        ? "Your field shows some pressure worth watching."
        : "Your field is under significant pressure.";

  const cardsFor = (layerSet: LayerId[]) => {
    const cards: ReactNode[] = [];
    if (layerSet.includes("moisture") && a.water.rootZoneWetness !== null)
      cards.push(
        <MetricCard
          key="moisture"
          icon={Droplets}
          label="Root-zone soil moisture"
          value={pct(a.water.rootZoneWetness)}
          description={`0–100 cm, share of saturation${a.water.rootZoneVolumetric !== null ? ` ≈ ${a.water.rootZoneVolumetric} m³/m³` : ""} · surface ${pct(a.water.surfaceWetness)}`}
          status={a.water.waterStress >= 55 ? "bad" : a.water.waterStress >= 35 ? "moderate" : "good"}
          trend={a.water.rootZoneAnomaly}
        />,
      );
    if (layerSet.includes("rain"))
      cards.push(
        <MetricCard
          key="rain"
          icon={CloudRain}
          label="Rainfall"
          value={show(a.water.rainfall, " mm")}
          description={`Last 12 months · ${show(a.water.heavyRainDays)} heavy-rain days`}
          status={(a.water.rainfallAnomaly ?? 0) <= -15 ? "bad" : (a.water.rainfallAnomaly ?? 0) <= -5 ? "moderate" : "good"}
          trend={a.water.rainfallAnomaly}
        />,
        <MetricCard
          key="balance"
          icon={Droplets}
          label="Water balance"
          value={show(a.water.waterBalance, " mm")}
          description={`Rain minus crop water demand (${show(a.water.evapotranspiration, " mm")})`}
          status={a.water.waterStress >= 55 ? "bad" : a.water.waterStress >= 35 ? "moderate" : "good"}
        />,
      );
    if (layerSet.includes("temperature"))
      cards.push(
        <MetricCard
          key="temp"
          icon={Thermometer}
          label="Mean temperature"
          value={show(a.climate.meanTemperature, "°C")}
          description={`Last 12 months · max ${show(a.climate.maxTemperature, "°C")}`}
          status={(a.climate.temperatureAnomaly ?? 0) > 1 ? "moderate" : "good"}
          trend={a.climate.temperatureAnomaly}
          trendText={a.climate.temperatureAnomaly !== null ? `${Math.abs(a.climate.temperatureAnomaly)}°C` : undefined}
        />,
        <MetricCard
          key="heat"
          icon={Flame}
          label="Very hot days"
          value={show(a.climate.heatStressDays, " days")}
          description={`Days ≥ ${THRESHOLDS.heatDayC} °C · typical ${show(a.climate.heatStressBaseline)}`}
          status={(a.climate.heatStressDays ?? 0) >= 25 ? "bad" : (a.climate.heatStressDays ?? 0) >= 10 ? "moderate" : "good"}
        />,
        <MetricCard
          key="frost"
          icon={Snowflake}
          label="Frost days"
          value={show(a.climate.frostDays, " days")}
          description={`Minimum ≤ 0 °C · typical ${show(a.climate.frostBaseline)}`}
          status={(a.climate.frostDays ?? 0) > 90 ? "moderate" : "good"}
        />,
      );
    if (layerSet.includes("vegetation") && a.vegetation.ndvi !== null)
      cards.push(
        <MetricCard
          key="ndvi"
          icon={Leaf}
          label="Vegetation (NDVI)"
          value={show(a.vegetation.ndvi)}
          description={`MODIS 250 m · ${a.vegetation.date}`}
          status={riskStatus(a.vegetation.vegetationStress)}
          trend={a.vegetation.ndviAnomaly}
        />,
      );
    if (layerSet.includes("terrain") && a.soil.slope !== null)
      cards.push(
        <MetricCard
          key="erosion"
          icon={Mountain}
          label="Erosion risk"
          value={a.soil.erosionRisk}
          description={`Slope ${show(a.soil.slope, "%")} · elevation ${show(a.soil.elevation, " m")}`}
          status={riskStatus(a.soil.erosionRisk)}
        />,
      );
    if (layerSet.includes("soil") && a.soil.soilSource !== null)
      cards.push(
        <MetricCard
          key="soil"
          icon={Sprout}
          label="Soil"
          value={a.soil.soilType ?? "—"}
          description={`Organic matter ${show(a.soil.organicMatter, "%")} · pH ${show(a.soil.ph)}${a.soil.awc !== null ? ` · water capacity ${a.soil.awc} cm/cm` : ""} · ${a.soil.soilSource}`}
          status={a.soil.organicMatter !== null && a.soil.organicMatter < 1.5 ? "bad" : a.soil.organicMatter !== null && a.soil.organicMatter < 2.5 ? "moderate" : "good"}
        />,
      );
    return cards;
  };

  const faqItems: AccordionItem[] = [
    {
      id: "rotations",
      title: "Which rotation should I consider?",
      hint: `${rotations.length} options generated for this field, including your baseline`,
      render: () => (
        <>
          <p className="faq-lead">
            Candidate crops are combined into 2- and 3-year rotations (with second crops or cover crops in free months),
            then scored on your priorities. The first card is your baseline.
          </p>
          <div className={`scenario-panel ${scenarioActive ? "active" : ""}`}>
            <div className="scenario-title">
              <SlidersHorizontal size={18} />
              <div>
                <strong>What if the climate shifts?</strong>
                <span>Move the sliders to re-run crop suitability and the ranking.</span>
              </div>
              {projection && (
                <button type="button" className="scenario-reset scenario-cmip" onClick={applyProjection}>
                  Use 2041–2050 projection
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
          <div className="rotation-list">
            {rotations.map((rotation, index) => (
              <RotationCard key={rotation.id} rotation={rotation} rank={index + 1} collapsible={rotation.id !== "current"} />
            ))}
          </div>
        </>
      ),
    },
    {
      id: "signals",
      title: "What is happening on the field?",
      hint: "All available measurements, including data you did not select",
      render: () => (
        <>
          <p className="faq-lead">
            Last 12 months ({a.period.start} → {a.period.end}) compared with the same period in earlier years. Arrows show
            the change.
          </p>
          <div className="metric-grid">
            {cardsFor(LAYERS.map((l) => l.id))}
            {a.extras.era5?.rootZone != null && (
              <MetricCard
                icon={Droplets}
                label="Soil moisture · ERA5-Land"
                value={`${a.extras.era5.rootZone} m³/m³`}
                description={`Copernicus reanalysis, 28–100 cm · surface ${show(a.extras.era5.surface)} m³/m³ · to ${a.extras.era5.end}`}
                status={(a.extras.era5.rootZoneAnomaly ?? 0) <= -10 ? "bad" : (a.extras.era5.rootZoneAnomaly ?? 0) <= -4 ? "moderate" : "good"}
                trend={a.extras.era5.rootZoneAnomaly}
              />
            )}
            {a.extras.groundwater && (
              <MetricCard
                icon={Droplets}
                label="Groundwater depth"
                value={`${a.extras.groundwater.latestDepthM} m`}
                description={`USGS well ${a.extras.groundwater.distanceKm} km away · ${signed(a.extras.groundwater.trendMPerDecade)} m/decade (+ = deeper)`}
                status={a.extras.groundwater.trendMPerDecade > 0.5 ? "bad" : a.extras.groundwater.trendMPerDecade > 0.1 ? "moderate" : "good"}
              />
            )}
            {a.extras.openet && (
              <MetricCard
                icon={CloudRain}
                label="Actual water use (OpenET)"
                value={`${a.extras.openet.annualEt} mm`}
                description={`Satellite evapotranspiration in ${a.extras.openet.year} vs crop demand ${show(a.water.evapotranspiration, " mm")}`}
                status="good"
              />
            )}
            {a.extras.sentinel2 && (
              <MetricCard
                icon={Satellite}
                label="Sentinel-2 images"
                value={`${a.extras.sentinel2.clearScenes90d} clear`}
                description={`Cloud-free passes in the last 90 days · latest ${a.extras.sentinel2.latestDate}`}
                status="good"
              />
            )}
          </div>
          {a.extras.sentinel2 && (
            <a className="source-link" href={a.extras.sentinel2.browserUrl} target="_blank" rel="noreferrer">
              View the latest Sentinel-2 image of this field in the Copernicus Browser <ExternalLink size={12} />
            </a>
          )}
        </>
      ),
    },
    {
      id: "season",
      title: "When is the field most vulnerable?",
      hint: "Month-by-month dry, frost and heat periods",
      render: () => <SeasonStrip a={a} />,
    },
    {
      id: "trends",
      title: "Where is this field heading?",
      hint: `Trends projected to ${a.trends[0]?.projectionYear ?? 2030}`,
      render: () => <Predictions a={a} onApply={applyProjection} />,
    },
    {
      id: "crops",
      title: "Which crops fit this field?",
      hint: "Every crop tested month by month against this field",
      render: () => (
        <>
          <p className="faq-lead">
            Each crop is tested against this field's temperature, frost, heat, water balance and soil
            {a.country ? `, and compared with what is commonly grown in ${a.country.name}` : ""}.
            {constraints.irrigation ? " Irrigation is assumed available." : ""}
          </p>
          {a.extras.usdaYields && (
            <div className="usda-yields">
              <strong>
                USDA surveyed yields in {a.extras.usdaYields.county}, {a.extras.usdaYields.state}
              </strong>
              <div className="usda-yield-grid">
                {a.extras.usdaYields.crops.map((c) => (
                  <span key={c.cropId}>
                    <b>{c.commodity}</b> {c.latest} {c.unit.toLowerCase()} ({c.latestYear}) · 5-yr avg {c.average5y} ·{" "}
                    {signed(c.trendPctPerYear)}%/yr
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="cropfit-grid">
            {cropFits.slice(0, 12).map((f) => {
              const common = marketScore(f.crop.id, a.country?.code ?? null, a.latitude, a.longitude) >= 60;
              return (
                <div key={f.crop.id} className="cropfit">
                  <div className="cropfit-top">
                    <span className="cropfit-emoji">{f.crop.emoji}</span>
                    <div>
                      <strong>{f.crop.name}</strong>
                      <small>{f.best ? monthRange(f.best.occupied) : "no window"}</small>
                    </div>
                    <b className={`cropfit-score ${getScoreTone(f.score)}`}>{f.score}</b>
                  </div>
                  <div className="cropfit-bar">
                    <i style={{ width: `${f.score}%` }} className={getScoreTone(f.score)} />
                  </div>
                  <div className="cropfit-tags">
                    {common && <em className="common">Common locally</em>}
                    {f.crop.nFix && <em>Fixes N</em>}
                    {f.crop.droughtTol >= 0.7 && <em>Drought-hardy</em>}
                    {f.crop.heatTol >= 0.8 && <em>Heat-hardy</em>}
                  </div>
                  <p>{f.limiting[0] ?? f.crop.note}</p>
                </div>
              );
            })}
          </div>
        </>
      ),
    },
    {
      id: "trust",
      title: "How far can these numbers be trusted?",
      hint: "Accuracy and limits from NASA SMAP documentation",
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
          <div className="smap-evidence-grid">
            {SMAP_EVIDENCE.map((item) => (
              <a key={item.label} href={item.url} target="_blank" rel="noreferrer" className="smap-evidence">
                <strong>{item.label}</strong>
                <p>{item.text}</p>
                <span>
                  <FileText size={13} /> {item.source} <ExternalLink size={12} />
                </span>
              </a>
            ))}
          </div>
        </>
      ),
    },
    {
      id: "tradeoffs",
      title: "What are the trade-offs and uncertainties?",
      hint: "Why a strong option is not a guarantee",
      render: () => (
        <div className="tradeoff-grid">
          <div>
            <strong>Weather uncertainty</strong>
            <span>Future seasons can behave differently from the 2015–present record.</span>
          </div>
          <div>
            <strong>Soil variability</strong>
            <span>Soil and moisture vary within a field; satellite grids average them out.</span>
          </div>
          <div>
            <strong>Market conditions</strong>
            <span>Market fit is not observed by satellites. Validate prices, contracts and demand.</span>
          </div>
          <div>
            <strong>Local expertise</strong>
            <span>Varieties, pests, machinery and labour are best judged by you and your agronomist.</span>
          </div>
        </div>
      ),
    },
    ...(farmerNote
      ? [{ id: "note", title: "What did I tell AgroCycle?", render: () => <p className="faq-lead">{farmerNote}</p> }]
      : []),
    {
      id: "glossary",
      title: "What do the terms mean?",
      hint: "Soil moisture, evapotranspiration, NDVI and more in plain language",
      render: () => <Glossary />,
    },
    {
      id: "sources",
      title: "Where does every number come from?",
      hint: "Data sources, their status and the NASA SMAP document library",
      render: () => <Sources a={a} retry={retry} />,
    },
  ];

  return (
    <div className="app-shell">
      <Header selected />

      <main className="page-container analysis-page essentials-page">
        <section className="essentials-hero">
          <div className="hero-badge">
            <Satellite size={15} />
            Live NASA field analysis
          </div>
          <h1>Your field at a glance</h1>
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
                {active ? <CheckCircle2 size={14} /> : <span className="chip-plus">+</span>}
                {layer.emoji} {layer.label}
                {state === "loading" && <RefreshCw size={12} className="spin" />}
                {state === "error" && <AlertTriangle size={12} />}
              </button>
            );
          })}
        </section>

        <section className="essentials-card">
          <div className="essentials-score">
            <div className={`resilience-score ${tone}`}>
              <strong>{a.resilienceScore}</strong>
              <span>/100</span>
            </div>
            <div>
              <span className="eyebrow">FIELD RESILIENCE</span>
              <h2>{verdict}</h2>
              <p>
                Based on {a.period.start} → {a.period.end}. Data confidence: <strong>{a.confidence}</strong>.
              </p>
            </div>
          </div>

          <ul className="findings">
            {findings.map((f) => (
              <li key={f.id} className={`finding ${f.tone}`}>
                <span className="finding-emoji">{f.emoji}</span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
                {f.tone === "loading" && <RefreshCw size={14} className="spin finding-status" />}
              </li>
            ))}
          </ul>

          {cardsFor(layers).length > 0 && <div className="metric-grid essentials-metrics">{cardsFor(layers)}</div>}
        </section>

        {top && (
          <section className="suggestion-card">
            <div>
              <span className="eyebrow">OUR SUGGESTION FOR YOU</span>
              <h2>{top.name}</h2>
              <p>
                {top.benefits.slice(0, 2).join(" ")}
                {current && current.score < top.score
                  ? ` It scores ${top.score}/100 against ${current.score}/100 for ${current.assumed ? "the typical local rotation" : "your current rotation"}.`
                  : ""}
              </p>
              {top.calendar && (
                <div className="suggestion-crops">
                  {top.calendar.flatMap((year) => year.segments).map((seg, i) => (
                    <span key={`${seg.cropId}-${i}`}>
                      {seg.emoji} {seg.name} <small>{monthRange(seg.months)}</small>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="suggestion-side">
              <div className={`rotation-score ${getScoreTone(top.score)}`}>
                <strong>{top.score}</strong>
                <span>/100</span>
              </div>
              <button type="button" className="primary-button" onClick={() => openFaq("rotations")}>
                Compare all options <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}

        <section className="faq-section">
          <div className="faq-heading">
            <BookOpen size={20} />
            <div>
              <span className="eyebrow">MORE DETAIL</span>
              <h2>Questions you might have</h2>
            </div>
          </div>
          <Accordion items={faqItems} open={open} onToggle={toggleFaq} />
        </section>

        <p className="essentials-footnote">
          AgroCycle supports decisions; it does not replace your experience or local agronomic advice.
        </p>
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
      <p className="faq-lead">
        Average month since 2015: bars show root-zone moisture, the blue line monthly rain. Months marked dry (&lt; 45%),
        frost or heat are when bare soil or a sensitive crop is most exposed.
      </p>
      <div className="season-strip">
        {a.monthly.map((month) => {
          const wet = month.rootWetness ?? 0;
          const flags = [
            month.rootWetness !== null && month.rootWetness < 0.45 ? "dry" : null,
            month.frostDays >= 5 ? "frost" : null,
            month.heatDays >= 2 ? "heat" : null,
          ].filter(Boolean) as string[];
          return (
            <div
              className="season-month"
              key={month.month}
              title={`${month.month}: moisture ${pct(month.rootWetness)}, rain ${show(month.rainMm, " mm")}, frost ${month.frostDays} d, heat ${month.heatDays} d`}
            >
              <div className="season-bar-area">
                <div className={`season-bar ${wet < 0.45 ? "dry" : wet < 0.6 ? "watch" : "wet"}`} style={{ height: `${Math.max(wet * 100, 4)}%` }} />
                <i className="season-rain" style={{ bottom: `${((month.rainMm ?? 0) / maxRain) * 92}%` }} />
              </div>
              <strong>{month.month}</strong>
              <span>{pct(month.rootWetness)}</span>
              <div className="season-flags">
                {flags.map((flag) => (
                  <em key={flag} className={flag}>
                    {flag}
                  </em>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Predictions({ a, onApply }: { a: FieldAnalysis; onApply: () => void }) {
  const p = a.extras.projection;
  const cmip = p ? (
    <div className="cmip-card">
      <div>
        <span className="eyebrow">CLIMATE MODELS · CMIP6</span>
        <h3>
          By {p.future}: {signed(p.deltaT)} °C, rain {signed(p.rainPct)}%
        </h3>
        <p>
          Average of {p.models.length} high-resolution models ({p.models.join(", ")}) compared with {p.baseline}, on a
          high-emission pathway. Model range: {p.deltaTRange[0]} to {p.deltaTRange[1]} °C and {p.rainPctRange[0]} to{" "}
          {p.rainPctRange[1]}% rain. Days ≥ 32 °C: {p.hotDaysBaseline} → {p.hotDaysFuture} per year.
        </p>
        <div className="cmip-months">
          {p.monthlyDeltaT.map((dt, i) => (
            <span key={i} title={`${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]}: ${signed(dt)} °C, rain ${signed(p.monthlyRainPct[i])}%`}>
              <i style={{ height: `${Math.min(Math.abs(dt) * 18, 40) + 4}px` }} className={dt >= 0 ? "warm" : "cool"} />
              {"JFMAMJJASOND"[i]}
            </span>
          ))}
        </div>
      </div>
      <button type="button" className="primary-button" onClick={onApply}>
        Test crops under this climate <ArrowRight size={16} />
      </button>
    </div>
  ) : null;
  if (!a.trends.length)
    return (
      <>
        {cmip}
        <p className="faq-lead">Not enough complete years of data to estimate trends here.</p>
      </>
    );
  return (
    <>
      {cmip}
      <p className="faq-lead">
        Linear trends fitted to each complete year since 2015 and projected to {a.trends[0].projectionYear} with a 90%
        range. Where the trend is not statistically clear, the projection is simply the average year with its usual
        spread. This extrapolates the recent record; it is not a climate model.
      </p>
      <div className="trend-grid">
        {a.trends.map((trend) => (
          <TrendCard key={trend.id} trend={trend} />
        ))}
      </div>
      <div className="odds-row">
        <div>
          <strong>
            {a.odds.dryGrowingSeasons.count} of {a.odds.dryGrowingSeasons.of}
          </strong>
          <span>growing seasons were dry (root-zone moisture &lt; 45%)</span>
        </div>
        <div>
          <strong>
            {a.odds.hotYears.count} of {a.odds.hotYears.of}
          </strong>
          <span>years had 10+ days ≥ {THRESHOLDS.heatDayC} °C</span>
        </div>
        <div>
          <strong>
            {a.odds.lateFrostYears.count} of {a.odds.lateFrostYears.of}
          </strong>
          <span>years had a late spring frost</span>
        </div>
      </div>
    </>
  );
}

function TrendCard({ trend }: { trend: Trend }) {
  const values = trend.values.map((p) => p.value);
  const min = Math.min(...values, trend.low);
  const max = Math.max(...values, trend.high);
  const span = max - min || 1;
  const years = [...trend.values.map((p) => p.year), trend.projectionYear];
  const x = (year: number) => ((year - years[0]) / Math.max(years[years.length - 1] - years[0], 1)) * 100;
  const y = (value: number) => 36 - ((value - min) / span) * 32;
  const path = trend.values.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = trend.values[trend.values.length - 1];
  const direction = !trend.significant ? "flat" : trend.slopePerDecade > 0 ? "up" : "down";

  return (
    <div className={`trend-card ${direction}`}>
      <span className="trend-label">{trend.label}</span>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <polygon
          className="trend-band"
          points={`${x(last.year)},${y(last.value)} ${x(trend.projectionYear)},${y(trend.high)} ${x(trend.projectionYear)},${y(trend.low)}`}
        />
        <path d={path} className="trend-line" />
        <line x1={x(last.year)} y1={y(last.value)} x2={x(trend.projectionYear)} y2={y(trend.projection)} className="trend-projection" />
      </svg>
      <strong>
        {trend.projection}
        {trend.unit === "%" ? "%" : ` ${trend.unit}`}
        <small> by {trend.projectionYear}</small>
      </strong>
      <span className="trend-range">
        range {trend.low}–{trend.high} · {trend.significant && trend.slopePerDecade > 0 ? "+" : ""}
        {trend.significant ? `${trend.slopePerDecade} per decade` : "no clear trend (average year shown)"}
      </span>
    </div>
  );
}

function Glossary() {
  const terms: [string, string][] = [
    ["Soil moisture", "How full the soil's pores are with water: 0% bone dry, 100% saturated. The root zone is the top metre crops drink from; the surface is the top 5 cm that satellites like SMAP sense."],
    ["Anomaly", "The difference from what is normal for this place and season. −15% means 15% drier than the same months in earlier years."],
    ["Evapotranspiration (ET)", "Water leaving the field as evaporation from soil plus transpiration from plants. Crops need roughly reference ET × a crop factor."],
    ["Water balance", "Rain minus crop water demand. Negative values mean crops rely on stored soil water or irrigation."],
    ["NDVI", "A greenness index from satellite images (−1 to 1). Healthy dense crops are around 0.6–0.9; bare soil is near 0.1–0.2."],
    ["Frost & heat days", `Days with a minimum at or below 0 °C (damages tender crops) and days with a maximum at or above ${THRESHOLDS.heatDayC} °C (stresses flowering and grain fill).`],
    ["Satellite vs ground data", "Satellites and models average over kilometres; ground sensors and soil tests are exact but only for one spot. Combining both gives the best picture."],
    ["Cover crop / nitrogen fixing", "Cover crops protect and feed the soil between cash crops. Legumes host bacteria that turn air nitrogen into fertiliser for the next crop."],
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
      <p className="faq-lead">
        Values are fetched live for your coordinates. SMAP's own soil-moisture files need an Earthdata login, so soil
        moisture comes from NASA POWER, which reports the same surface (0–5 cm) and root-zone (0–100 cm) layers; the
        SMAP documents below set the accuracy, depth and limitation rules used to interpret it. Crop requirements are
        general FAO-style ranges; the country used for market context comes from OpenStreetMap
        {a.country ? ` (${a.country.name})` : " (not identified for this point)"}.
      </p>
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
                {source.ok || source.pending ? source.detail : source.notApplicable ? `Not enabled: ${source.detail}` : `Unavailable: ${source.detail}`}
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
      <details className="smap-library">
        <summary>
          <FileText size={16} />
          Other resources reviewed · why they are or are not connected
        </summary>
        <ul className="resource-notes">
          {OTHER_RESOURCES.map((r) => (
            <li key={r.name}>
              <a href={r.url} target="_blank" rel="noreferrer">
                <strong>{r.name}</strong>
              </a>{" "}
              — {r.note}
            </li>
          ))}
        </ul>
      </details>
      <details className="smap-library">
        <summary>
          <FileText size={16} />
          NASA SMAP document library · {SMAP_DOCUMENTS.length} PDFs ({SMAP_DOCUMENTS.filter((d) => d.analysed).length} analysed in depth)
        </summary>
        {DOC_ORDER.map((kind) => {
          const docs = SMAP_DOCUMENTS.filter((d) => d.kind === kind);
          if (!docs.length) return null;
          return (
            <div key={kind} className="smap-library-group">
              <h4>
                {kind} <span>{docs.length}</span>
              </h4>
              <ul>
                {docs.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} target="_blank" rel="noreferrer">
                      {d.title}
                    </a>
                    {d.analysed && <em>analysed</em>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </details>
    </>
  );
}
