import "./MapPage.css";
import {
  ArrowRight,
  Bug,
  Coins,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Droplet,
  Droplets,
  Flame,
  Haze,
  Leaf,
  MapPin,
  Mountain,
  MousePointerClick,
  Search,
  Snowflake,
  Sprout,
  Square,
  Shovel,
  Thermometer,
  ThermometerSun,
  Tractor,
  TrendingDown,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MapView from "../components/MapView";
import type { AreaUnit, FarmerConstraints, FieldSelection, IndicatorId, PriorityId } from "../types";
import { CROP_BY_ID, SELECTABLE_CROPS } from "../data/crops";
import { readIndicators } from "../data/layers";
import { startSource } from "../services/sourceStore";

const readConstraints = (): FarmerConstraints => {
  try {
    const raw = sessionStorage.getItem("farmrotate:constraints");
    if (raw) return { irrigation: false, livestock: false, currentCrops: [], ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { irrigation: false, livestock: false, currentCrops: [] };
};

const priorityOptions: {
  id: PriorityId;
  label: string;
  icon: typeof Droplets;
}[] = [
  { id: "water", label: "Save water", icon: Droplets },
  { id: "soil", label: "Build soil health", icon: Sprout },
  { id: "heat", label: "Handle heat", icon: Flame },
  { id: "erosion", label: "Protect soil", icon: Mountain },
  { id: "pest", label: "Break pest cycles", icon: Bug },
  { id: "income", label: "Protect income", icon: Coins },
];

const indicatorOptions: {
  id: IndicatorId;
  label: string;
  icon: typeof Droplets;
}[] = [
  { id: "temperature", label: "Temperature", icon: Thermometer },
  { id: "heatStress", label: "Heat stress", icon: ThermometerSun },
  { id: "rainfall", label: "Rainfall", icon: CloudRain },
  { id: "soilMoisture", label: "Soil moisture", icon: Droplet },
  { id: "evaporation", label: "Evaporation", icon: Haze },
  { id: "frostRisk", label: "Frost risk", icon: Snowflake },
  { id: "extremePrecipitation", label: "Extreme precipitation", icon: CloudRainWind },
  { id: "vegetationStress", label: "Vegetation stress", icon: Leaf },
  { id: "waterTrends", label: "Long-term water trends", icon: TrendingDown },
  { id: "slopeErosion", label: "Slope & erosion", icon: Mountain },
  { id: "soilProperties", label: "Soil properties", icon: Shovel },
];

const unitLabels: Record<AreaUnit, string> = {
  m2: "m²",
  ha: "ha",
  km2: "km²",
  acres: "acres",
  ft2: "ft²",
};

function convertArea(squareMeters: number, unit: AreaUnit) {
  if (unit === "ha") return squareMeters / 10_000;
  if (unit === "km2") return squareMeters / 1_000_000;
  if (unit === "acres") return squareMeters / 4046.8564224;
  if (unit === "ft2") return squareMeters * 10.7639104167;
  return squareMeters;
}

type PanelId = "location" | "priorities" | "indicators" | "farm";

export default function MapPage() {
  const navigate = useNavigate();
  const [field, setField] = useState<FieldSelection | null>(null);
  const [unit] = useState<AreaUnit>("ha");
  const [priorities, setPriorities] = useState<PriorityId[]>([
    "water",
    "soil",
  ]);

  const [locationSlot, setLocationSlot] = useState<HTMLDivElement | null>(null);
  const [openPanel, setOpenPanel] = useState<PanelId | null>("location");

  const togglePanel = (panel: PanelId) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [indicators, setIndicators] = useState<IndicatorId[]>(readIndicators);

  // Start the soil lookup as soon as a point is chosen; the analysis page reuses this result.
  useEffect(() => {
    if (!field) return;
    startSource("soil", field.latitude, field.longitude);
  }, [field]);
  const [constraints, setConstraints] = useState<FarmerConstraints>(readConstraints);

  const addCrop = (id: string) => {
    if (!id) return;
    setConstraints((current) =>
      current.currentCrops.length >= 4 ? current : { ...current, currentCrops: [...current.currentCrops, id] },
    );
  };

  const removeCrop = (index: number) =>
    setConstraints((current) => ({
      ...current,
      currentCrops: current.currentCrops.filter((_, i) => i !== index),
    }));

  const toggleIndicator = (id: IndicatorId) => {
    setIndicators((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const togglePriority = (id: PriorityId) => {
    setPriorities((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const displayArea =
    field?.selectionType === "area"
      ? `${convertArea(field.area, unit).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} ${unitLabels[unit]}`
      : null;

  const analyze = () => {
    if (!field) return;

    sessionStorage.setItem(
      "farmrotate:field",
      JSON.stringify({ ...field, areaUnit: unit }),
    );
    sessionStorage.setItem("farmrotate:priorities", JSON.stringify(priorities));
    sessionStorage.setItem("farmrotate:indicators", JSON.stringify(indicators));
    sessionStorage.setItem("farmrotate:constraints", JSON.stringify(constraints));
    sessionStorage.setItem("farmrotate:note", "");
    navigate("/analysis");
  };

  return (
    <div className="map-page-shell">
      <main className="map-page">
        <MapView onFieldSelected={setField} coordinatesContainer={locationSlot} />

        <div className="map-island-dock">
          {openPanel === "location" && (
            <section
              id="island-panel-location"
              className="island-panel"
              role="dialog"
              aria-label="Find a location"
            >
              <div className="island-panel-header">
                <div>
                  <span className="eyebrow">Navigate</span>
                </div>
                <button
                  className="island-close"
                  onClick={() => setOpenPanel(null)}
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>
              <div ref={setLocationSlot} />
            </section>
          )}

          {openPanel === "priorities" && (
            <section
              id="island-panel-priorities"
              className="island-panel"
              role="dialog"
              aria-label="Farmer priorities"
            >
              <div className="island-panel-header">
                <div>
                  <span className="eyebrow">Farmer priorities</span>
                </div>
                <button
                  className="island-close"
                  onClick={() => setOpenPanel(null)}
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="priority-mini-grid">
                {priorityOptions.map(({ id, label, icon: Icon }) => {
                  const active = priorities.includes(id);
                  return (
                    <button
                      key={id}
                      className={active ? "mini-priority active" : "mini-priority"}
                      onClick={() => togglePriority(id)}
                      aria-pressed={active}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {openPanel === "indicators" && (
            <section
              id="island-panel-indicators"
              className="island-panel"
              role="dialog"
              aria-label="Climate indicators"
            >
              <div className="island-panel-header">
                <div>
                  <span className="eyebrow">Climate indicators</span>
                </div>
                <button
                  className="island-close"
                  onClick={() => setOpenPanel(null)}
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="indicator-actions">
                <button onClick={() => setIndicators(indicatorOptions.map((option) => option.id))}>
                  Select all
                </button>
                <button onClick={() => setIndicators([])}>Clear</button>
              </div>

              <div className="priority-mini-grid">
                {indicatorOptions.map(({ id, label, icon: Icon }) => {
                  const active = indicators.includes(id);
                  return (
                    <button
                      key={id}
                      className={active ? "mini-priority active" : "mini-priority"}
                      onClick={() => toggleIndicator(id)}
                      aria-pressed={active}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {openPanel === "farm" && (
            <section
              id="island-panel-farm"
              className="island-panel"
              role="dialog"
              aria-label="Your farm"
            >
              <div className="island-panel-header">
                <div>
                  <span className="eyebrow">Your farm · optional</span>
                </div>
                <button
                  className="island-close"
                  onClick={() => setOpenPanel(null)}
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {constraints.currentCrops.length > 0 && (
                <>
                  <div className="farm-section-heading">
                    <span>Your rotation</span>
                    <div className="indicator-actions">
                      <button onClick={() => setConstraints({ ...constraints, currentCrops: [] })}>Clear</button>
                    </div>
                  </div>
                  <div className="crop-chips">
                    {constraints.currentCrops.map((id, index) => (
                      <span key={`${id}-${index}`} className="crop-chip">
                        <span className="crop-chip-step">{index + 1}</span>
                        {CROP_BY_ID[id]?.emoji} {CROP_BY_ID[id]?.name ?? id}
                        <button type="button" aria-label="Remove crop" onClick={() => removeCrop(index)}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="farm-section-heading">
                <span>Add crops</span>
              </div>
              <div className="priority-mini-grid farm-crop-grid">
                {SELECTABLE_CROPS.map((crop) => {
                  const inRotation = constraints.currentCrops.includes(crop.id);
                  const full = constraints.currentCrops.length >= 4;
                  return (
                    <button
                      key={crop.id}
                      className={inRotation ? "mini-priority active" : "mini-priority"}
                      onClick={() => addCrop(crop.id)}
                      disabled={full}
                      title={full ? "Rotation is full: remove a crop first" : `Add ${crop.name}`}
                    >
                      <span className="farm-crop-emoji" aria-hidden="true">{crop.emoji}</span>
                      {crop.name}
                    </button>
                  );
                })}
              </div>

              <div className="farm-section-heading">
                <span>Farm conditions</span>
              </div>
              <div className="priority-mini-grid">
                <button
                  className={constraints.irrigation ? "mini-priority active" : "mini-priority"}
                  onClick={() => setConstraints({ ...constraints, irrigation: !constraints.irrigation })}
                  aria-pressed={constraints.irrigation}
                >
                  <Droplets size={16} />
                  Irrigation available
                </button>
                <button
                  className={constraints.livestock ? "mini-priority active" : "mini-priority"}
                  onClick={() => setConstraints({ ...constraints, livestock: !constraints.livestock })}
                  aria-pressed={constraints.livestock}
                >
                  <Sprout size={16} />
                  Livestock / forage needed
                </button>
              </div>
            </section>
          )}

          <nav className="map-island" aria-label="Map controls">
            <button
              className={openPanel === "location" ? "island-icon-button active" : "island-icon-button"}
              onClick={() => togglePanel("location")}
              aria-expanded={openPanel === "location"}
              aria-controls="island-panel-location"
              aria-label="Find a location"
              title="Find a location"
            >
              <Search size={19} />
            </button>

            <button
              className={openPanel === "priorities" ? "island-icon-button active" : "island-icon-button"}
              onClick={() => togglePanel("priorities")}
              aria-expanded={openPanel === "priorities"}
              aria-controls="island-panel-priorities"
              aria-label="Farmer priorities"
              title="Farmer priorities"
            >
              <Sprout size={19} />
              {priorities.length > 0 && (
                <span className="island-badge">{priorities.length}</span>
              )}
            </button>

            <button
              className={openPanel === "indicators" ? "island-icon-button active" : "island-icon-button"}
              onClick={() => togglePanel("indicators")}
              aria-expanded={openPanel === "indicators"}
              aria-controls="island-panel-indicators"
              aria-label="Climate indicators"
              title="Climate indicators"
            >
              <CloudSun size={19} />
              {indicators.length > 0 && (
                <span className="island-badge">{indicators.length}</span>
              )}
            </button>

            <button
              className={openPanel === "farm" ? "island-icon-button active" : "island-icon-button"}
              onClick={() => togglePanel("farm")}
              aria-expanded={openPanel === "farm"}
              aria-controls="island-panel-farm"
              aria-label="Your farm"
              title="Your farm: current rotation, irrigation, livestock"
            >
              <Tractor size={19} />
              {(constraints.currentCrops.length > 0 || constraints.irrigation || constraints.livestock) && (
                <span className="island-badge">✓</span>
              )}
            </button>

            <span className="island-divider" aria-hidden="true" />

            <div
              className={field ? "island-status ready" : "island-status"}
              role="status"
              title={
                field
                  ? field.selectionType === "area"
                    ? `Field selected · ${displayArea}`
                    : `Point selected · ${field.latitude.toFixed(4)}°, ${field.longitude.toFixed(4)}°`
                  : "Nothing selected yet: click the map or draw a field"
              }
            >
              {field ? (
                field.selectionType === "area" ? <Square size={17} /> : <MapPin size={17} />
              ) : (
                <MousePointerClick size={17} />
              )}
              <span className="visually-hidden">
                {field ? "Selection ready" : "Nothing selected yet"}
              </span>
            </div>

            <button
              className="island-go-button"
              disabled={!field}
              onClick={analyze}
              aria-label="Continue to analysis"
              title={field ? "Continue to analysis" : "Select a point or field first"}
            >
              <ArrowRight size={19} />
            </button>
          </nav>
        </div>
      </main>
    </div>
  );
}
