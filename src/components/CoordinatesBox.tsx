import { Crosshair, MapPin, Navigation } from "lucide-react";
import { useState } from "react";

interface CoordinatesBoxProps {
  initialLatitude?: number;
  initialLongitude?: number;
  onGoTo: (latitude: number, longitude: number) => void;
  onUseMyLocation?: () => void;
}

export default function CoordinatesBox({
  initialLatitude = 45.9432,
  initialLongitude = 24.9668,
  onGoTo,
  onUseMyLocation,
}: CoordinatesBoxProps) {
  const [latitude, setLatitude] = useState(String(initialLatitude));
  const [longitude, setLongitude] = useState(String(initialLongitude));
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const lat = Number(latitude.replace(",", "."));
    const lon = Number(longitude.replace(",", "."));

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setError("Please enter valid latitude and longitude.");
      return;
    }

    setError("");
    onGoTo(lat, lon);
  };

  return (
    <div className="coordinates-box">
      <div className="coordinates-title">
        <MapPin size={16} />
        Find a location
      </div>

      <div className="coordinate-help">
        Use decimal degrees, e.g. 45.6579, 25.6012.
      </div>

      <div className="coordinate-inputs">
        <label>
          Latitude
          <input
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="45.6579"
            inputMode="decimal"
          />
        </label>

        <label>
          Longitude
          <input
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="25.6012"
            inputMode="decimal"
          />
        </label>
      </div>

      <button className="secondary-button coordinates-button" onClick={handleSubmit}>
        <Navigation size={15} />
        Go to coordinates
      </button>

      {onUseMyLocation && (
        <button className="location-button" onClick={onUseMyLocation}>
          <Crosshair size={15} />
          Use my location
        </button>
      )}

      {error && <div className="coordinate-error">{error}</div>}
    </div>
  );
}
