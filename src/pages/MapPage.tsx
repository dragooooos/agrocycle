import {
  ArrowRight,
  Bug,
  Check,
  Coins,
  Droplets,
  Flame,
  Mountain,
  Sprout,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import MapView from "../components/MapView";
import type { AreaUnit, FarmerConstraints, FieldSelection, PriorityId } from "../types";
import { CROP_BY_ID, SELECTABLE_CROPS } from "../data/crops";
import { ALL_LAYERS, LAYERS, readLayers, saveLayers } from "../data/layers";
import type { LayerId } from "../types";

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

const readConstraints = (): FarmerConstraints => {
  try {
    const raw = sessionStorage.getItem("farmrotate:constraints");
    if (raw) return { irrigation: false, livestock: false, currentCrops: [], ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { irrigation: false, livestock: false, currentCrops: [] };
};

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

  const [constraints, setConstraints] = useState<FarmerConstraints>(readConstraints);
  const [layers, setLayers] = useState<LayerId[]>(readLayers);
  const allSelected = layers.length === ALL_LAYERS.length;

  const toggleLayer = (id: LayerId) =>
    setLayers((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

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
    sessionStorage.setItem("farmrotate:constraints", JSON.stringify(constraints));
    saveLayers(layers);
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

          <div className="layer-picker">
            <div className="priority-mini-heading">
              <div>
                <span className="eyebrow">DATA TO ANALYSE</span>
                <h2>What do you want to see?</h2>
              </div>
              <button
                type="button"
                className="layer-all"
                onClick={() => setLayers(allSelected ? [] : [...ALL_LAYERS])}
                aria-pressed={allSelected}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="layer-grid">
              {LAYERS.map((layer) => {
                const active = layers.includes(layer.id);
                return (
                  <button
                    key={layer.id}
                    type="button"
                    className={active ? "layer-option active" : "layer-option"}
                    onClick={() => toggleLayer(layer.id)}
                    aria-pressed={active}
                  >
                    <span className="layer-emoji">{layer.emoji}</span>
                    <span className="layer-text">
                      <strong>{layer.label}</strong>
                      <small>{layer.description}</small>
                    </span>
                    <span className="layer-check">{active && <Check size={13} />}</span>
                  </button>
                );
              })}
            </div>
            <small className="farm-hint">
              Your choices load first. Everything else keeps loading in the background, so you can add it
              later on the analysis page without waiting.
            </small>
          </div>

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

          <div className="farm-inputs">
            <div className="priority-mini-heading">
              <div>
                <span className="eyebrow">YOUR FARM</span>
                <h2>Current rotation & constraints</h2>
              </div>
              <span>optional</span>
            </div>

            <label className="farm-label" htmlFor="current-crop">
              Crops in your current rotation, in order
            </label>
            <div className="crop-chips">
              {constraints.currentCrops.map((id, index) => (
                <span key={`${id}-${index}`} className="crop-chip">
                  {CROP_BY_ID[id]?.emoji} {CROP_BY_ID[id]?.name ?? id}
                  <button type="button" aria-label="Remove crop" onClick={() => removeCrop(index)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              {constraints.currentCrops.length < 4 && (
                <select
                  id="current-crop"
                  value=""
                  onChange={(event) => addCrop(event.target.value)}
                >
                  <option value="">+ Add crop</option>
                  {SELECTABLE_CROPS.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.emoji} {crop.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {constraints.currentCrops.length === 0 && (
              <small className="farm-hint">
                Leave empty and AgroCycle assumes the most common local rotation as the baseline.
              </small>
            )}

            <div className="farm-toggles">
              <label className={constraints.irrigation ? "farm-toggle active" : "farm-toggle"}>
                <input
                  type="checkbox"
                  checked={constraints.irrigation}
                  onChange={(event) => setConstraints({ ...constraints, irrigation: event.target.checked })}
                />
                <Droplets size={15} /> Irrigation available
              </label>
              <label className={constraints.livestock ? "farm-toggle active" : "farm-toggle"}>
                <input
                  type="checkbox"
                  checked={constraints.livestock}
                  onChange={(event) => setConstraints({ ...constraints, livestock: event.target.checked })}
                />
                <Sprout size={15} /> Livestock / forage needed
              </label>
            </div>
          </div>

          <button
            className="primary-button map-analyze-button"
            disabled={!field || layers.length === 0}
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
