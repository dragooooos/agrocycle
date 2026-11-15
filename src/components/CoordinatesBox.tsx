import { Crosshair, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

interface CoordinatesBoxProps {
  initialLatitude?: number;
  initialLongitude?: number;
  onGoTo: (latitude: number, longitude: number, zoom?: number) => void;
  onUseMyLocation?: () => void;
}

interface Place {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function zoomForBox(box?: [string, string, string, string]) {
  if (!box) return 12;
  const [south, north, west, east] = box.map(Number);
  const span = Math.max(Math.abs(north - south), Math.abs(east - west), 0.0005);
  return clamp(Math.floor(Math.log2(1690 / span)), 4, 16);
}

const cache = new Map<string, Place[]>();

let lastNominatimCall = 0;

async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const key = `osm:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const wait = lastNominatimCall + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  const data = (await response.json()) as NominatimResult[];
  const places = data.map((r) => {
    const [name, ...rest] = r.display_name.split(", ");
    return {
      id: `osm-${r.place_id}`,
      name,
      detail: rest.slice(-3).join(", "),
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      zoom: zoomForBox(r.boundingbox),
    };
  });
  cache.set(key, places);
  return places;
}

type SearchStatus = "idle" | "loading" | "done" | "error";

export default function CoordinatesBox({
  initialLatitude = 45.9432,
  initialLongitude = 24.9668,
  onGoTo,
  onUseMyLocation,
}: CoordinatesBoxProps) {
  const [latitude, setLatitude] = useState(String(initialLatitude));
  const [longitude, setLongitude] = useState(String(initialLongitude));
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef<AbortController | null>(null);
  const listId = useId();

  const runSearch = () => {
    const text = query.trim();
    if (text.length < 2 || status === "loading") return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setStatus("loading");
    searchPlaces(text, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setPlaces(found);
        setActive(found.length ? 0 : -1);
        setStatus("done");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
  };

  useEffect(() => () => request.current?.abort(), []);

  const choose = (place: Place) => {
    setLatitude(place.latitude.toFixed(4));
    setLongitude(place.longitude.toFixed(4));
    setQuery(place.name);
    setOpen(false);
    setError("");
    onGoTo(place.latitude, place.longitude, place.zoom);
  };

  const showList = open && status !== "idle";

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, places.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (showList && places[active]) choose(places[active]);
      else runSearch();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

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

      <div className="place-search">
        <MapPin size={14} className="place-search-icon" aria-hidden="true" />
        <input
          className="place-search-input"
          type="search"
          value={query}
          placeholder="Search a city, village or region"
          enterKeyHint="search"
          role="combobox"
          aria-label="Search for a place"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && places[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            request.current?.abort();
            setQuery(event.target.value);
            setPlaces([]);
            setStatus("idle");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onSearchKey}
        />
        <button
          type="button"
          className="place-search-button"
          aria-label="Search"
          disabled={query.trim().length < 2 || status === "loading"}
          onMouseDown={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          {status === "loading" ? <Loader2 size={14} className="place-search-spinner" /> : <Search size={14} />}
        </button>

        {showList && (
          <div className="place-results">
            <ul id={listId} role="listbox" aria-label="Matching places">
              {places.map((place, index) => (
                <li
                  key={place.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "active" : ""}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(place);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  <strong>{place.name}</strong>
                  {place.detail && <span>{place.detail}</span>}
                </li>
              ))}
            </ul>

            {status === "loading" && <p className="place-results-note">Searching…</p>}
            {status === "done" && places.length === 0 && (
              <p className="place-results-note">No places found. Try adding the country, e.g. "Brasov, Romania".</p>
            )}
            {status === "error" && <p className="place-results-note">Search is unavailable right now.</p>}

            <p className="place-results-credit">
              Places © OpenStreetMap contributors
            </p>
          </div>
        )}
      </div>

      <div className="coordinate-help">
        Or use decimal degrees, e.g. 45.6579, 25.6012.
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

      <button className="location-button" onClick={handleSubmit}>
        <Navigation size={15} />
        Show on map
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
