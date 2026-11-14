import { useCallback, useEffect, useState } from "react";
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
  onFieldSelected: (
    selection: FieldSelection,
  ) => void;
}

interface MapControllerProps {
  target: {
    latitude: number;
    longitude: number;
  } | null;
}

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const resize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, [map]);

  return null;
}

function MapController({
  target,
}: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    map.flyTo(
      [target.latitude, target.longitude],
      13,
      {
        duration: 0.8,
      },
    );
  }, [map, target]);

  return null;
}

function MapClickHandler({
  onLocation,
}: {
  onLocation: (
    latitude: number,
    longitude: number,
  ) => void;
}) {
  useMapEvents({
    click(event) {
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
}: MapViewProps) {
  const map = useMap();

  useEffect(() => {
    const pm = (map as any).pm;

    if (!pm) {
      console.warn(
        "Leaflet Geoman was not loaded.",
      );
      return;
    }

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

      if (!(layer instanceof L.Polygon)) {
        return;
      }

      const geoJson = layer.toGeoJSON();
      const squareMeters = area(geoJson);
      const hectares = squareMeters / 10000;

      const center = layer
        .getBounds()
        .getCenter();

      onFieldSelected({
        area: Number(hectares.toFixed(2)),
        latitude: Number(
          center.lat.toFixed(6),
        ),
        longitude: Number(
          center.lng.toFixed(6),
        ),
        geoJson,
      });
    };

    map.on("pm:create", handleCreate);

    return () => {
      map.off("pm:create", handleCreate);

      try {
        pm.removeControls();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [map, onFieldSelected]);

  return null;
}

export default function MapView({
  onFieldSelected,
}: MapViewProps) {
  const [target, setTarget] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [clickedLocation, setClickedLocation] =
    useState<{
      latitude: number;
      longitude: number;
    } | null>(null);

  const handleGoTo = useCallback(
    (latitude: number, longitude: number) => {
      setTarget({
        latitude,
        longitude,
      });

      setClickedLocation({
        latitude,
        longitude,
      });
    },
    [],
  );

  const handleMapClick = useCallback(
    (latitude: number, longitude: number) => {
      setClickedLocation({
        latitude,
        longitude,
      });
    },
    [],
  );

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[45.9432, 24.9668]}
        zoom={7}
        minZoom={2}
        maxZoom={19}
        scrollWheelZoom
        worldCopyJump
        zoomControl
        className="map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={19}
          noWrap={false}
        />

        <MapResizeFix />

        <MapController target={target} />

        <MapClickHandler
          onLocation={handleMapClick}
        />

        <DrawingTools
          onFieldSelected={onFieldSelected}
        />
      </MapContainer>

      <div className="map-top-card">
        <CoordinatesBox
          onGoTo={handleGoTo}
        />
      </div>

      <div className="map-overlay">
        <div className="map-title">
          Select your field
        </div>

        <div className="map-subtitle">
          Draw a polygon around the field, or click
          anywhere on the map to inspect a location.
        </div>

        {clickedLocation && (
          <div className="map-coordinates">
            <span>
              {clickedLocation.latitude.toFixed(6)}
            </span>
            <span>
              {clickedLocation.longitude.toFixed(6)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}