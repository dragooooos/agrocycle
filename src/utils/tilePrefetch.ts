import L from "leaflet";

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
      const wrappedX = ((x % count) + count) % count;
      for (const template of templates) {
        urls.push(template.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(wrappedX)));
      }
    }
  }
  return urls;
}

export function prefetchZoomOut(map: L.Map, templates: string[], maxNativeZoom: number, levels = 2) {
  if (onSlowConnection()) return;

  const run = ++generation;
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
      const image = new Image();
      image.decoding = "async";
      image.onload = image.onerror = next;
      image.src = url;
    };
    for (let i = 0; i < MAX_PARALLEL; i++) next();
  });
}
