import "./MapPage.css";
import {
  ArrowRight,
  Check,
  Droplets,
  Flame,
  Mountain,
  Sprout,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import MapView from "../components/MapView";
import type { AreaUnit, FieldSelection, PriorityId } from "../types";

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

export default function MapPage() {
  const navigate = useNavigate();
  const [field, setField] = useState<FieldSelection | null>(null);
  const [unit, setUnit] = useState<AreaUnit>("ha");
  const [priorities, setPriorities] = useState<PriorityId[]>([
    "water",
    "soil",
  ]);

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
    sessionStorage.setItem("farmrotate:note", "");
    navigate("/analysis");
  };

  return (
    <div className="map-page-shell">
      <Header selected />

      <main className="map-page">
        <MapView onFieldSelected={setField} />

        <aside className="map-control-panel">
          <div className="map-panel-header">
            <div>
              <span className="eyebrow">FIELD EXPLORER</span>
              <h1>Select your location</h1>
            </div>
            <span className="map-live-badge">LIVE MAP</span>
          </div>

          <div className="selection-mode-info">
            <div className="mode-item">
              <span className="mode-dot point" />
              <div>
                <strong>Point analysis</strong>
                <p>Click one location to inspect local conditions. No field boundary required.</p>
              </div>
            </div>
            <div className="mode-item">
              <span className="mode-dot area" />
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
              <span>1</span>
              <div>
                <strong>Choose a point or draw a field</strong>
                <p>Use the map controls on the left, or enter coordinates above.</p>
              </div>
            </div>
          )}

          <div className="priority-mini">
            <div className="priority-mini-heading">
              <div>
                <span className="eyebrow">FARMER PRIORITIES</span>
                <h2>What matters most?</h2>
              </div>
              <span>{priorities.length} selected</span>
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
          </div>

          <button
            className="primary-button map-analyze-button"
            disabled={!field}
            onClick={analyze}
          >
            Continue to analysis
            <ArrowRight size={18} />
          </button>

          <p className="map-disclaimer">
            Satellite imagery is a visual basemap. It is not itself a field measurement.
            NASA indicators shown in the next step are decision-support signals and should
            be validated with local observations.
          </p>
        </aside>
      </main>
    </div>
  );
}
