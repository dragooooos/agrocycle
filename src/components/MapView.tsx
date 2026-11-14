import { useCallback, useEffect, useState } from "react";
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
import CoordinatesBox from "./CoordinatesBox";

interface MapViewProps {
  onFieldSelected: (selection: FieldSelection) => void;
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

function DrawingTools({
  onFieldSelected,
  onDrawingStateChange,
}: {
  onFieldSelected: (selection: FieldSelection) => void;
  onDrawingStateChange: (drawing: boolean) => void;
}) {
  const map = useMap();

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

    const handleCreate = (event: any) => {
      const layer = event.layer;
      if (!(layer instanceof L.Polygon)) return;

      const geoJson = layer.toGeoJSON();
      const squareMeters = area(geoJson);
      const center = layer.getBounds().getCenter();

      onFieldSelected({
        area: squareMeters,
        latitude: Number(center.lat.toFixed(6)),
        longitude: Number(center.lng.toFixed(6)),
        selectionType: "area",
        areaUnit: "m2",
        geoJson,
      });
    };

    const handleDrawStart = () => {
      onDrawingStateChange(true);
      // Explicitly disable Leaflet panning while Geoman is drawing.
      // Geoman normally handles this, but making it explicit avoids a
      // one-frame drag/jump on some browsers and touchpads.
      map.dragging.disable();
    };

    const handleDrawEnd = () => {
      onDrawingStateChange(false);
      map.dragging.enable();
    };

    map.on("pm:create", handleCreate);
    map.on("pm:drawstart", handleDrawStart);
    map.on("pm:drawend", handleDrawEnd);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:drawstart", handleDrawStart);
      map.off("pm:drawend", handleDrawEnd);
      map.dragging.enable();
      try {
        pm.removeControls();
      } catch {
        // cleanup
      }
    };
  }, [map, onFieldSelected]);

  return null;
}

export default function MapView({
  onFieldSelected,
  initialLocation = null,
  coordinatesContainer,
}: MapViewProps) {
  const defaultLocation = initialLocation ?? {
    latitude: 45.9432,
    longitude: 24.9668,
  };

  const [target, setTarget] = useState(defaultLocation);
  const [clickedLocation, setClickedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleGoTo = useCallback((latitude: number, longitude: number) => {
    const location = { latitude, longitude };
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
        center={[defaultLocation.latitude, defaultLocation.longitude]}
        zoom={16}
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

        <MapResizeFix />
        <MapController target={target} />
        <MapClickHandler onLocation={handleMapClick} disabled={isDrawing} />
        <DrawingTools onFieldSelected={onFieldSelected} onDrawingStateChange={setIsDrawing} />
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
