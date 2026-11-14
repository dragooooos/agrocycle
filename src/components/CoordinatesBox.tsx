import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";

interface CoordinatesBoxProps {
  initialLatitude?: number;
  initialLongitude?: number;
  onGoTo: (latitude: number, longitude: number) => void;
}

export default function CoordinatesBox({
  initialLatitude = 45.9432,
  initialLongitude = 24.9668,
  onGoTo,
}: CoordinatesBoxProps) {
  const [latitude, setLatitude] = useState(
    String(initialLatitude),
  );

  const [longitude, setLongitude] = useState(
    String(initialLongitude),
  );

  const [error, setError] = useState("");

  const handleSubmit = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setError(
        "Please enter valid coordinates.",
      );
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

      <div className="coordinate-inputs">
        <label>
          Latitude
          <input
            value={latitude}
            onChange={(event) =>
              setLatitude(event.target.value)
            }
            placeholder="45.9432"
          />
        </label>

        <label>
          Longitude
          <input
            value={longitude}
            onChange={(event) =>
              setLongitude(event.target.value)
            }
            placeholder="24.9668"
          />
        </label>
      </div>

      <button
        className="secondary-button coordinates-button"
        onClick={handleSubmit}
      >
        <Navigation size={15} />
        Go to location
      </button>

      {error && (
        <div className="coordinate-error">
          {error}
        </div>
      )}
    </div>
  );
}