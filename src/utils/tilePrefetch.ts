import L from "leaflet";

/**
 * Zooming out shows tiles the browser has never loaded, so the edges of the
 * map stay blank until they arrive. Once the visible tiles have finished
 * loading, this quietly fetches the tiles you would see one and two zoom
 * levels further out, around the same spot. They land in the browser cache,
 * so zooming out then draws them straight away.
 *
 * Cost: about one screenful of small tiles per level, only while the map is
 * idle, never twice for the same tile in a session, and skipped entirely when
 * the browser reports a data saver or a slow (2G) connection.
 */

const TILE_SIZE = 256;
const MAX_PARALLEL = 4;
const MAX_REMEMBERED = 4000;

const requested = new Set<string>();
let generation = 0;

type ConnectionInfo = { saveData?: boolean; effectiveType?: string };

const onSlowConnection = () => {
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  return !!connection && (connection.saveData === true || /2g/.test(connection.effectiveType ?? ""));
};

const whenIdle = (task: () => void) => {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number })
    .requestIdleCallback;
  if (idle) idle(task, { timeout: 1500 });
  else setTimeout(task, 300);
};

/** Tile URLs covering one screen around the map's centre at zoom `z`, plus one tile of margin. */
function tilesAround(map: L.Map, templates: string[], z: number): string[] {
  const size = map.getSize();
  const centre = map.project(map.getCenter(), z);
  const half = size.divideBy(2);
  const min = centre.subtract(half).divideBy(TILE_SIZE).floor().subtract([1, 1]);
  const max = centre.add(half).divideBy(TILE_SIZE).floor().add([1, 1]);
  const count = 2 ** z;
  const urls: string[] = [];

  for (let y = Math.max(0, min.y); y <= Math.min(count - 1, max.y); y++) {
    for (let x = min.x; x <= max.x; x++) {
      const wrappedX = ((x % count) + count) % count; // the world repeats east-west
      for (const template of templates) {
        urls.push(template.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(wrappedX)));
      }
    }
  }
  return urls;
}

/**
 * Prefetch the tiles for the next `levels` zoom levels out.
 * `maxNativeZoom` is the deepest zoom the tile server has (beyond it the map
 * enlarges those tiles instead of loading new ones).
 */
export function prefetchZoomOut(map: L.Map, templates: string[], maxNativeZoom: number, levels = 2) {
  if (onSlowConnection()) return;

  const run = ++generation; // a newer call (the map moved again) stops this one
  const shown = Math.min(Math.round(map.getZoom()), maxNativeZoom);
  const lowest = Math.max(Math.ceil(map.getMinZoom()), shown - levels);

  whenIdle(() => {
    if (run !== generation) return;

    const queue: string[] = [];
    for (let z = shown - 1; z >= lowest; z--) {
      for (const url of tilesAround(map, templates, z)) {
        if (!requested.has(url)) queue.push(url);
      }
    }
    if (requested.size + queue.length > MAX_REMEMBERED) requested.clear();

    const next = () => {
      if (run !== generation) return;
      const url = queue.shift();
      if (!url) return;
      requested.add(url);
      // Loaded the same way Leaflet loads tiles (a plain <img>, no CORS mode),
      // so the cached copy is the one the map will use.
      const image = new Image();
      image.decoding = "async";
      image.onload = image.onerror = next;
      image.src = url;
    };
    for (let i = 0; i < MAX_PARALLEL; i++) next();
  });
}
