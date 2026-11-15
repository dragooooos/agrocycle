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
import CoordinatesBox from "./CoordinatesBox";

interface MapViewProps {
  onFieldSelected: (selection: FieldSelection) => void;
  /** Called when the selected field outline is deleted with the toolbar's removal tool. */
  onSelectionCleared?: () => void;
  /** A saved selection to show again (point marker or editable outline), e.g. when coming back from the analysis page. */
  initialSelection?: FieldSelection | null;
  initialLocation?: { latitude: number; longitude: number } | null;
  /**
   * When provided, the "Find a location" box is rendered inside this element
   * (e.g. a panel of the floating island) instead of floating over the map.
   * Pass null while that panel is closed.
   */
  coordinatesContainer?: HTMLElement | null;
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
      // Geoman emits map clicks while drawing. Never treat those clicks as
      // point selections, otherwise MapController can fly the map underneath
      // the polygon/rectangle and create a visible jump/glitch.
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

function DrawingTools({
  onFieldSelected,
  onDrawingStateChange,
  onSelectionCleared,
  initialOutline,
  selectedShape,
}: {
  onFieldSelected: (selection: FieldSelection) => void;
  onDrawingStateChange: (drawing: boolean) => void;
  onSelectionCleared?: () => void;
  initialOutline: [number, number][][] | null;
  /** The outline that is the current selection (null when a point is selected). */
  selectedShape: MutableRefObject<L.Polygon | null>;
}) {
  const map = useMap();
  const restored = useRef(false);

  useEffect(() => {
    const pm = (map as any).pm;
    if (!pm) return;

    pm.addControls({
      position: "topleft",
      drawText: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      removalMode: true,
      rotateMode: false,
      cutPolygon: false,
    });

    const selectLayer = (layer: L.Polygon) => {
      selectedShape.current = layer;
      onFieldSelected(selectionFromLayer(layer));
    };

    // Make the shape resizable right away: drag a corner (or a vertex of a
    // polygon) to reshape it. Rectangles stay rectangular while resizing.
    // Re-measure the area whenever the shape changes, including edits made
    // later through the toolbar's edit tool.
    const makeEditable = (layer: L.Polygon) => {
      layer.on("pm:edit", () => selectLayer(layer));
      (layer as any).pm?.enable({ allowSelfIntersection: false });
    };

    const handleCreate = (event: any) => {
      const layer = event.layer;
      if (!(layer instanceof L.Polygon)) return;

      selectLayer(layer);
      makeEditable(layer);
    };

    // Deleting the outline that is the current selection clears the selection.
    const handleRemove = (event: any) => {
      if (event.layer && event.layer === selectedShape.current) {
        selectedShape.current = null;
        onSelectionCleared?.();
      }
    };

    // Coming back to the map: redraw the saved outline once, already selected and editable.
    if (initialOutline && !restored.current) {
      restored.current = true;
      const layer = L.polygon(initialOutline).addTo(map);
      selectedShape.current = layer;
      makeEditable(layer);
    }

    // Placing the first corner of a new outline replaces the selected one.
    // (Geoman places that corner on a map click, for rectangles and polygons alike.)
    const replaceSelectedShape = () => {
      const old = selectedShape.current;
      if (!old) return;
      selectedShape.current = null;
      map.removeLayer(old);
      onSelectionCleared?.();
    };

    const handleDrawStart = () => {
      onDrawingStateChange(true);
      map.once("click", replaceSelectedShape);
      // Explicitly disable Leaflet panning while Geoman is drawing.
      // Geoman normally handles this, but making it explicit avoids a
      // one-frame drag/jump on some browsers and touchpads.
      map.dragging.disable();
    };

    const handleDrawEnd = () => {
      map.off("click", replaceSelectedShape); // drawing cancelled before any corner was placed
      onDrawingStateChange(false);
      map.dragging.enable();
    };

    map.on("pm:create", handleCreate);
    map.on("pm:remove", handleRemove);
    map.on("pm:drawstart", handleDrawStart);
    map.on("pm:drawend", handleDrawEnd);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:remove", handleRemove);
      map.off("pm:drawstart", handleDrawStart);
      map.off("pm:drawend", handleDrawEnd);
      map.off("click", replaceSelectedShape);
      map.dragging.enable();
      try {
        pm.removeControls();
      } catch {
        // cleanup
      }
    };
    // initialOutline is only used on the first run (guarded by `restored`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, onFieldSelected, onSelectionCleared]);

  return null;
}

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
  // Read once: the saved outline is only redrawn when the map first opens.
  const [initialOutline] = useState(() => outlineOf(initialSelection));
  const [initialBounds] = useState(() => (initialOutline ? L.polygon(initialOutline).getBounds() : null));
  const selectedShape = useRef<L.Polygon | null>(null);

  const [target, setTarget] = useState<{ latitude: number; longitude: number } | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialSelection?.selectionType === "point" ? initialSelection : null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Starting a new shape clears the point marker left by an earlier click.
  const handleDrawingStateChange = useCallback((drawing: boolean) => {
    setIsDrawing(drawing);
    if (drawing) setClickedLocation(null);
  }, []);

  const handleGoTo = useCallback((latitude: number, longitude: number) => {
    const location = { latitude, longitude };
    selectedShape.current = null; // a point is now the selection, not an outline
    setTarget(location);
    setClickedLocation(location);
    onFieldSelected({
      area: 0,
      latitude,
      longitude,
      selectionType: "point",
    });
  }, [onFieldSelected]);

  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    const location = { latitude, longitude };
    selectedShape.current = null; // a point is now the selection, not an outline
    setClickedLocation(location);
    // Crucially: no setTarget() here. Clicking the map should not trigger
    // MapController.flyTo(), which was the source of the visual jump.
    onFieldSelected({
      area: 0,
      latitude,
      longitude,
      selectionType: "point",
    });
  }, [onFieldSelected]);

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
        minZoom={2}
        maxZoom={20}
        scrollWheelZoom
        worldCopyJump
        zoomControl
        className="map"
      >
        <TileLayer
          attribution="Imagery © Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={19}
          maxZoom={20}
        />

        {/* Country and region borders (plus place names) as pre-rendered Esri
            tiles: same provider as the imagery, so it costs almost nothing to draw. */}
        <TileLayer
          attribution="Boundaries © Esri, HERE, Garmin, OpenStreetMap contributors"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={19}
          maxZoom={20}
          opacity={0.85}
          zIndex={2}
        />

        <MapResizeFix />
        <MapController target={target} />
        <MapClickHandler onLocation={handleMapClick} disabled={isDrawing} />
        <DrawingTools
          onFieldSelected={onFieldSelected}
          onDrawingStateChange={handleDrawingStateChange}
          onSelectionCleared={onSelectionCleared}
          initialOutline={initialOutline}
          selectedShape={selectedShape}
        />
        <LocationMarker location={clickedLocation} />
      </MapContainer>

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
          Click once for point analysis, or use the polygon tools to measure a field.
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
