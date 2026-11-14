import "./MapPage.css";
import {
  ArrowRight,
  Check,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Droplet,
  Droplets,
  Flame,
  Haze,
  Info,
  Leaf,
  MapPin,
  Mountain,
  MousePointerClick,
  Search,
  Snowflake,
  Sprout,
  Square,
  Thermometer,
  ThermometerSun,
  TrendingDown,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MapView from "../components/MapView";
import type { AreaUnit, FieldSelection, IndicatorId, PriorityId } from "../types";

const priorityOptions: {
  id: PriorityId;
  label: string;
  icon: typeof Droplets;
}[] = [
  { id: "water", label: "Save water", icon: Droplets },
  { id: "soil", label: "Build soil health", icon: Sprout },
  { id: "heat", label: "Handle heat", icon: Flame },
  { id: "erosion", label: "Protect soil", icon: Mountain },
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

type PanelId = "location" | "info" | "priorities" | "indicators";

export default function MapPage() {
  const navigate = useNavigate();
  const [field, setField] = useState<FieldSelection | null>(null);
  const [unit, setUnit] = useState<AreaUnit>("ha");
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

  const [indicators, setIndicators] = useState<IndicatorId[]>([
    "temperature",
    "rainfall",
    "soilMoisture",
  ]);

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
                  <span className="eyebrow">NAVIGATE</span>
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

          {openPanel === "info" && (
            <section
              id="island-panel-info"
              className="island-panel"
              role="dialog"
              aria-label="Location and indications"
            >
              <div className="island-panel-header">
                <div>
                  <span className="eyebrow">FIELD EXPLORER</span>
                </div>
                <button
                  className="island-close"
                  onClick={() => setOpenPanel(null)}
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="selection-mode-info">
                <div className="mode-item">
                  <div>
                    <strong>Point analysis</strong>
                    <p>Click one location to inspect local conditions. No field boundary required.</p>
                  </div>
                </div>
                <div className="mode-item">
                  <div>
                    <strong>Field area</strong>
                    <p>Draw a polygon or rectangle to calculate the selected area.</p>
                  </div>
                </div>
              </div>

              {field ? (
                <div className="selection-card">
                  <div className="selection-card-top">
                    <span className="selection-type">
                      {field.selectionType === "point" ? "POINT SELECTED" : "FIELD SELECTED"}
                    </span>
                    <Check size={16} />
                  </div>

                  <div className="coordinate-readout">
                    <div>
                      <span>Latitude</span>
                      <strong>{field.latitude.toFixed(6)}°</strong>
                    </div>
                    <div>
                      <span>Longitude</span>
                      <strong>{field.longitude.toFixed(6)}°</strong>
                    </div>
                  </div>

                  {field.selectionType === "area" && (
                    <div className="area-control">
                      <div>
                        <span>Measured area</span>
                        <strong>{displayArea}</strong>
                      </div>
                      <label>
                        Unit
                        <select value={unit} onChange={(event) => setUnit(event.target.value as AreaUnit)}>
                          <option value="ha">Hectares (ha)</option>
                          <option value="m2">Square metres (m²)</option>
                          <option value="km2">Square kilometres (km²)</option>
                          <option value="acres">Acres</option>
                          <option value="ft2">Square feet (ft²)</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-selection">
                  <div>
                    <strong>Choose a point or draw a field</strong>
                    <p>Use the map tools on the left, or search coordinates with the 🔍 button.</p>
                  </div>
                </div>
              )}
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
                  <span className="eyebrow">FARMER PRIORITIES</span>
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
                  <span className="eyebrow">CLIMATE INDICATORS</span>
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
              className={openPanel === "info" ? "island-icon-button active" : "island-icon-button"}
              onClick={() => togglePanel("info")}
              aria-expanded={openPanel === "info"}
              aria-controls="island-panel-info"
              aria-label="Location and indications"
              title="Location & indications"
            >
              <Info size={19} />
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
