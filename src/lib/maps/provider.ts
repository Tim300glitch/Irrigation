/**
 * Aerial / map background providers.
 *
 * `MapProvider` isolates geocoding + imagery so paid providers (Google, Mapbox,
 * Nearmap…) can be added with user-supplied keys — no credentials are hard-coded.
 * The built-in provider uses OpenStreetMap Nominatim for geocoding and Esri World
 * Imagery tiles; both are subject to their providers' usage terms and attribution.
 *
 * Scale: Web-Mercator ground resolution = 156543.03392 × cos(lat) / 2^zoom m/px.
 */
export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

export interface AerialImage {
  dataUrl: string;
  pxWidth: number;
  pxHeight: number;
  ftPerPx: number;
  attribution: string;
}

export interface MapProvider {
  id: string;
  name: string;
  geocode(query: string): Promise<GeocodeResult[]>;
  aerial(lat: number, lon: number, widthFt: number, heightFt: number): Promise<AerialImage>;
}

const M_TO_FT = 3.28084;

export function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

function lonLatToTile(lon: number, lat: number, z: number) {
  const n = Math.pow(2, z);
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`tile failed: ${url}`));
    img.src = url;
  });
}

export const esriProvider: MapProvider = {
  id: "esri",
  name: "Esri World Imagery + OpenStreetMap geocoding",
  async geocode(query) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`Geocoding failed (${r.status})`);
    const j = (await r.json()) as { lat: string; lon: string; display_name: string }[];
    return j.map((x) => ({ lat: +x.lat, lon: +x.lon, label: x.display_name }));
  },
  async aerial(lat, lon, widthFt, heightFt) {
    const z = 20;
    const mpp = metersPerPixel(lat, z);
    const ftPerPx = mpp * M_TO_FT;
    const wPx = Math.min(2560, Math.ceil(widthFt / ftPerPx));
    const hPx = Math.min(2560, Math.ceil(heightFt / ftPerPx));
    const c = lonLatToTile(lon, lat, z);
    const cx = c.x * 256;
    const cy = c.y * 256;
    const x0 = cx - wPx / 2;
    const y0 = cy - hPx / 2;
    const canvas = document.createElement("canvas");
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext("2d")!;
    const tx0 = Math.floor(x0 / 256);
    const ty0 = Math.floor(y0 / 256);
    const tx1 = Math.floor((x0 + wPx) / 256);
    const ty1 = Math.floor((y0 + hPx) / 256);
    const jobs: Promise<void>[] = [];
    for (let tx = tx0; tx <= tx1; tx++)
      for (let ty = ty0; ty <= ty1; ty++) {
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
        jobs.push(
          loadImage(url)
            .then((img) => ctx.drawImage(img, tx * 256 - x0, ty * 256 - y0))
            .catch(() => undefined),
        );
      }
    await Promise.all(jobs);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.86), pxWidth: wPx, pxHeight: hPx, ftPerPx, attribution: "Imagery © Esri, Maxar, Earthstar Geographics · Geocoding © OpenStreetMap contributors" };
  },
};

export const MAP_PROVIDERS: MapProvider[] = [esriProvider];
