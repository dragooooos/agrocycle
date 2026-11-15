import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import area from "@turf/area";

import "@geoman-io/leaflet-geoman-free";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

import type { FieldSelection } from "../types";
import { outlineOf } from "../services/selection";
import { MapPin, Minus, Pentagon, Plus, Square, X } from "lucide-react";
import CoordinatesBox from "./CoordinatesBox";
import { prefetchZoomOut } from "../utils/tilePrefetch";

const IMAGERY_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const BORDER_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const MAX_NATIVE_ZOOM = 19;

interface MapViewProps {
  onFieldSelected: (selection: FieldSelection) => void;
  onSelectionCleared?: () => void;
  initialSelection?: FieldSelection | null;
  initialLocation?: { latitude: number; longitude: number } | null;
  coordinatesContainer?: HTMLElement | null;
}

const WORLD_EDGE_LAT = 85.0511;
const FLOOR_ZOOM = 2;

function WorldLimits() {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(L.latLngBounds([-WORLD_EDGE_LAT, -1e6], [WORLD_EDGE_LAT, 1e6]));
    map.options.maxBoundsViscosity = 1;

    const fitMinZoom = () => {
      const height = map.getSize().y;
      if (!height) return;
      map.setMinZoom(Math.max(FLOOR_ZOOM, Math.ceil(Math.log2(height / 256))));
    };
    fitMinZoom();
    map.on("resize", fitMinZoom);
    return () => {
      map.off("resize", fitMinZoom);
    };
  }, [map]);

  return null;
}

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const resize = () => setTimeout(() => map.invalidateSize(), 100);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [map]);

  return null;
}

function MapController({
  target,
}: {
  target: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.latitude, target.longitude], 16, {
      duration: 0.9,
    });
  }, [map, target]);

  return null;
}

function LocationMarker({
  location,
}: {
  location: { latitude: number; longitude: number } | null;
}) {
  if (!location) return null;

  return (
    <LMarker latitude={location.latitude} longitude={location.longitude} />
  );
}

function LMarker({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    const marker = L.circleMarker([latitude, longitude], {
      radius: 8,
      weight: 3,
      color: "#ffffff",
      fillColor: "#218a58",
      fillOpacity: 1,
    }).addTo(map);

    return () => {
      marker.remove();
    };
  }, [map, latitude, longitude]);

  return null;
}

function MapClickHandler({
  onLocation,
  disabled,
}: {
  onLocation: (latitude: number, longitude: number) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click(event) {
      if (disabled) return;

      onLocation(
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6)),
      );
    },
  });

  return null;
}

function selectionFromLayer(layer: L.Polygon): FieldSelection {
  const geoJson = layer.toGeoJSON();
  const center = layer.getBounds().getCenter();
  return {
    area: area(geoJson),
    latitude: Number(center.lat.toFixed(6)),
    longitude: Number(center.lng.toFixed(6)),
    selectionType: "area",
    areaUnit: "m2",
    geoJson,
  };
}

export type SelectionTool = "point" | "rectangle" | "polygon";

const SHAPE_STYLE: L.PathOptions = { color: "#3388ff", weight: 3 };

function DrawingTools({
  tool,
  onToolChange,
  onAreaSelected,
  onShapeReplaced,
  initialOutline,
  selectedShape,
}: {
  tool: SelectionTool;
  onToolChange: (tool: SelectionTool) => void;
  onAreaSelected: (selection: FieldSelection) => void;
  onShapeReplaced: () => void;
  initialOutline: [number, number][][] | null;
  selectedShape: MutableRefObject<L.Polygon | null>;
}) {
  const map = useMap();
  const restored = useRef(false);

  const callbacks = useRef({ onToolChange, onAreaSelected, onShapeReplaced });
  callbacks.current = { onToolChange, onAreaSelected, onShapeReplaced };

  const selectLayer = useCallback((layer: L.Polygon) => {
    selectedShape.current = layer;
    callbacks.current.onAreaSelected(selectionFromLayer(layer));
  }, [selectedShape]);

  // Make the shape resizable right away: drag a corner (or a vertex of a
  // polygon) to reshape it. Rectangles stay rectangular while resizing.
  const makeEditable = useCallback((layer: L.Polygon) => {
    layer.on("pm:edit", () => selectLayer(layer));
    (layer as any).pm?.enable({ allowSelfIntersection: false });
  }, [selectLayer]);

  const replaceSelectedShape = useCallback(() => {
    const old = selectedShape.current;
    if (!old) return;
    selectedShape.current = null;
    old.remove();
    callbacks.current.onShapeReplaced();
  }, [selectedShape]);

  useEffect(() => {
    const handleCreate = (event: any) => {
      const layer = event.layer;
      if (!(layer instanceof L.Polygon)) return;
      selectLayer(layer);
      makeEditable(layer);
    };
    map.on("pm:create", handleCreate);

    if (initialOutline && !restored.current) {
      restored.current = true;
      const layer = L.polygon(initialOutline, SHAPE_STYLE).addTo(map);
      selectedShape.current = layer;
      makeEditable(layer);
    }

    return () => {
      map.off("pm:create", handleCreate);
    };
  }, [map, selectLayer, makeEditable]);

  useEffect(() => {
    const pm = (map as any).pm;
    const container = map.getContainer();
    let cancelShape = () => false;

    if (tool === "polygon" && pm) {
      const draw = pm.Draw.Polygon;
      const firstCorner = () => map.once("click", replaceSelectedShape);
      map.on("pm:drawstart", firstCorner);
      pm.enableDraw("Polygon", {
        continueDrawing: true,
        finishOn: "dblclick",
        allowSelfIntersection: false,
        pathOptions: SHAPE_STYLE,
      });
      cancelShape = () => {
        if (!draw._layer || draw._layer.getLatLngs().length === 0) return false;
        pm.disableDraw();
        pm.enableDraw("Polygon");
        return true;
      };
      const keys = (event: KeyboardEvent) => {
        if (isTyping(event)) return;
        if (event.key === "Backspace" && draw._layer?.getLatLngs().length) {
          event.preventDefault();
          draw._removeLastVertex();
        } else if (event.key === "Enter" && draw._layer?.getLatLngs().length > 2) {
          draw._finishShape();
        }
      };
      window.addEventListener("keydown", keys);
      const stopPolygon = () => {
        window.removeEventListener("keydown", keys);
        map.off("pm:drawstart", firstCorner);
        map.off("click", replaceSelectedShape);
        pm.disableDraw();
      };
      return withCancelKeys(map, () => cancelShape(), () => callbacks.current.onToolChange("point"), stopPolygon);
    }

    if (tool === "rectangle") {
      let phase: "idle" | "pressing" | "dragging" | "placing" = "idle";
      let start: L.LatLng | null = null;
      let startPoint: L.Point | null = null;
      let preview: L.Rectangle | null = null;

      map.dragging.disable();
      map.boxZoom.disable();
      container.classList.add("map-drawing");

      const latLngOf = (event: PointerEvent) => map.mouseEventToLatLng(event as unknown as MouseEvent);
      const reset = () => {
        preview?.remove();
        preview = null;
        phase = "idle";
        start = startPoint = null;
      };
      const finish = (corner: L.LatLng) => {
        const a = map.latLngToContainerPoint(start!);
        const b = map.latLngToContainerPoint(corner);
        const bounds = L.latLngBounds(start!, corner);
        reset();
        if (Math.abs(a.x - b.x) < 6 || Math.abs(a.y - b.y) < 6) return;
        const layer = L.rectangle(bounds, SHAPE_STYLE).addTo(map);
        selectLayer(layer);
        makeEditable(layer);
      };

      let panFrom: L.Point | null = null;
      const pointOf = (event: PointerEvent) => L.point(event.clientX, event.clientY);

      const down = (event: PointerEvent) => {
        if (event.button === 1 && isOnMap(event)) {
          event.preventDefault();
          panFrom = pointOf(event);
          container.setPointerCapture?.(event.pointerId);
          container.classList.add("map-panning");
          return;
        }
        if (event.button !== 0 || !isOnMap(event)) return;
        if (phase === "placing") return;
        event.preventDefault();
        start = latLngOf(event);
        startPoint = map.mouseEventToContainerPoint(event as unknown as MouseEvent);
        phase = "pressing";
        replaceSelectedShape();
        preview = L.rectangle(L.latLngBounds(start, start), { ...SHAPE_STYLE, dashArray: "6 6", interactive: false }).addTo(map);
        container.setPointerCapture?.(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (panFrom) {
          const point = pointOf(event);
          map.panBy(panFrom.subtract(point), { animate: false });
          panFrom = point;
        }
        if (phase === "idle" || !start || !preview) return;
        preview.setBounds(L.latLngBounds(start, latLngOf(event)));
        if (phase === "pressing" && startPoint) {
          const point = map.mouseEventToContainerPoint(event as unknown as MouseEvent);
          if (point.distanceTo(startPoint) > 5) phase = "dragging";
        }
      };
      const up = (event: PointerEvent) => {
        if (event.button === 1 && panFrom) {
          panFrom = null;
          container.classList.remove("map-panning");
          return;
        }
        if (event.button !== 0) return;
        if (phase === "dragging" || phase === "placing") finish(latLngOf(event));
        else if (phase === "pressing") phase = "placing";
      };

      const noAutoscroll = (event: MouseEvent) => {
        if (event.button === 1) event.preventDefault();
      };
      container.addEventListener("mousedown", noAutoscroll);
      container.addEventListener("pointerdown", down);
      container.addEventListener("pointermove", move);
      container.addEventListener("pointerup", up);
      cancelShape = () => {
        if (phase === "idle") return false;
        reset();
        return true;
      };
      const stopRectangle = () => {
        container.removeEventListener("mousedown", noAutoscroll);
        container.removeEventListener("pointerdown", down);
        container.removeEventListener("pointermove", move);
        container.removeEventListener("pointerup", up);
        container.classList.remove("map-drawing", "map-panning");
        reset();
        map.dragging.enable();
        map.boxZoom.enable();
      };
      return withCancelKeys(map, () => cancelShape(), () => callbacks.current.onToolChange("point"), stopRectangle);
    }

    return undefined;
  }, [map, tool, replaceSelectedShape, selectLayer, makeEditable]);

  return null;
}

const isTyping = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
};

const isOnMap = (event: PointerEvent) =>
  !(event.target as HTMLElement).closest(".leaflet-control, .leaflet-marker-icon, .leaflet-marker-pane");

function withCancelKeys(map: L.Map, cancel: () => boolean, backToPoint: () => void, stopTool: () => void) {
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || isTyping(event)) return;
    if (!cancel()) backToPoint();
  };
  const contextmenu = () => {
    cancel();
  };
  window.addEventListener("keydown", keydown);
  map.on("contextmenu", contextmenu);
  return () => {
    window.removeEventListener("keydown", keydown);
    map.off("contextmenu", contextmenu);
    stopTool();
  };
}

const TOOLS: { id: SelectionTool; label: string; hint: string; Icon: typeof MapPin }[] = [
  { id: "point", label: "Point", hint: "Click the map to pick a point", Icon: MapPin },
  { id: "rectangle", label: "Rectangle", hint: "Drag across your field · Esc cancels", Icon: Square },
  { id: "polygon", label: "Polygon", hint: "Click each corner, double-click to finish · Esc cancels", Icon: Pentagon },
];

export default function MapView({
  onFieldSelected,
  onSelectionCleared,
  initialSelection = null,
  initialLocation = null,
  coordinatesContainer,
}: MapViewProps) {
  const defaultLocation = initialSelection ?? initialLocation ?? {
    latitude: 45.9432,
    longitude: 24.9668,
  };
  const [initialOutline] = useState(() => outlineOf(initialSelection));
  const [initialBounds] = useState(() => (initialOutline ? L.polygon(initialOutline).getBounds() : null));
  const selectedShape = useRef<L.Polygon | null>(null);

  const [target, setTarget] = useState<{ latitude: number; longitude: number } | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialSelection?.selectionType === "point" ? initialSelection : null);
  const [tool, setTool] = useState<SelectionTool>("point");

  const [map, setMap] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  const prefetchTiles = useCallback(() => {
    if (map) prefetchZoomOut(map, [IMAGERY_TILES, BORDER_TILES], MAX_NATIVE_ZOOM);
  }, [map]);
  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoomend zoomlevelschange", update);
    return () => {
      map.off("zoomend zoomlevelschange", update);
    };
  }, [map]);
  const [hasSelection, setHasSelection] = useState(initialSelection !== null);
  const activeTool = TOOLS.find((option) => option.id === tool)!;

  const removeShape = useCallback(() => {
    selectedShape.current?.remove();
    selectedShape.current = null;
  }, []);

  const handleAreaSelected = useCallback((selection: FieldSelection) => {
    setClickedLocation(null);
    setHasSelection(true);
    onFieldSelected(selection);
  }, [onFieldSelected]);

  const handleCleared = useCallback(() => {
    setHasSelection(false);
    onSelectionCleared?.();
  }, [onSelectionCleared]);

  const handleClear = useCallback(() => {
    removeShape();
    setClickedLocation(null);
    handleCleared();
  }, [removeShape, handleCleared]);

  const handleGoTo = useCallback((latitude: number, longitude: number) => {
    const location = { latitude, longitude };
    removeShape();
    setHasSelection(true);
    setTarget(location);
    setClickedLocation(location);
    onFieldSelected({
      area: 0,
      latitude,
      longitude,
      selectionType: "point",
    });
  }, [onFieldSelected, removeShape]);

  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    const location = { latitude, longitude };
    removeShape();
    setHasSelection(true);
    setClickedLocation(location);
    // Crucially: no setTarget() here. Clicking the map should not trigger
    // MapController.flyTo(), which was the source of the visual jump.
    onFieldSelected({
      area: 0,
      latitude,
      longitude,
      selectionType: "point",
    });
  }, [onFieldSelected, removeShape]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleGoTo(
          Number(position.coords.latitude.toFixed(6)),
          Number(position.coords.longitude.toFixed(6)),
        );
      },
      () => {
        // Browser denied/unavailable. The coordinate form remains available.
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [handleGoTo]);

  return (
    <div className="map-wrapper fullscreen-map">
      <MapContainer
        {...(initialBounds
          ? { bounds: initialBounds, boundsOptions: { padding: [60, 60] as [number, number], maxZoom: 18 } }
          : { center: [defaultLocation.latitude, defaultLocation.longitude] as [number, number], zoom: 16 })}
        minZoom={FLOOR_ZOOM}
        maxZoom={20}
        scrollWheelZoom
        worldCopyJump
        zoomControl={false}
        ref={setMap}
        className="map"
      >
        <TileLayer
          attribution="Imagery © Esri, Maxar, Earthstar Geographics"
          url={IMAGERY_TILES}
          maxNativeZoom={MAX_NATIVE_ZOOM}
          maxZoom={20}
          updateWhenZooming={false}
          keepBuffer={4}
          eventHandlers={{ load: prefetchTiles }}
        />

        {/* Country and region borders (plus place names) as pre-rendered Esri
            tiles: same provider as the imagery, so it costs almost nothing to draw. */}
        <TileLayer
          attribution="Boundaries © Esri, HERE, Garmin, OpenStreetMap contributors"
          url={BORDER_TILES}
          maxNativeZoom={MAX_NATIVE_ZOOM}
          maxZoom={20}
          updateWhenZooming={false}
          keepBuffer={4}
          opacity={0.85}
          zIndex={2}
        />

        <MapResizeFix />
        <WorldLimits />
        <MapController target={target} />
        <MapClickHandler onLocation={handleMapClick} disabled={tool !== "point"} />
        <DrawingTools
          tool={tool}
          onToolChange={setTool}
          onAreaSelected={handleAreaSelected}
          onShapeReplaced={handleCleared}
          initialOutline={initialOutline}
          selectedShape={selectedShape}
        />
        <LocationMarker location={clickedLocation} />
      </MapContainer>

      <div className="map-tools">
        <div className="map-tools-bar">
          <div className="map-tools-switch" role="radiogroup" aria-label="Selection tool">
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={tool === id}
                aria-label={label}
                title={label}
                className={`map-tool${tool === id ? " active" : ""}`}
                onClick={() => setTool(id)}
              >
                <Icon size={19} aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="map-tool map-tool-clear"
            onClick={handleClear}
            disabled={!hasSelection}
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X size={19} aria-hidden="true" />
          </button>
          <span className="map-tools-divider" aria-hidden="true" />
          <button
            type="button"
            className="map-tool"
            onClick={() => map?.zoomIn()}
            disabled={!map || zoom === null || zoom >= map.getMaxZoom()}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="map-tool"
            onClick={() => map?.zoomOut()}
            disabled={!map || zoom === null || zoom <= map.getMinZoom()}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="map-tools-hint">
          <strong>{activeTool.label}</strong>
          {activeTool.hint}
        </div>
      </div>

      {coordinatesContainer === undefined ? (
        <div className="map-top-card">
          <CoordinatesBox
            onGoTo={handleGoTo}
            onUseMyLocation={handleUseMyLocation}
          />
        </div>
      ) : (
        coordinatesContainer &&
        createPortal(
          <CoordinatesBox
            onGoTo={handleGoTo}
            onUseMyLocation={handleUseMyLocation}
          />,
          coordinatesContainer,
        )
      )}

      <div className="map-overlay">
        <div className="map-title">Field Explorer</div>
        <div className="map-subtitle">
          Pick Point, Rectangle or Polygon on the left, then click or draw on the map.
          Satellite imagery is used as the basemap.
        </div>

        {clickedLocation && (
          <div className="map-coordinates">
            <span>{clickedLocation.latitude.toFixed(6)}°</span>
            <span>{clickedLocation.longitude.toFixed(6)}°</span>
          </div>
        )}
      </div>

      <div className="map-attribution-note">
        Basemap: Esri World Imagery
      </div>
    </div>
  );
}
