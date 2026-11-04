import { createRng } from "@wc/sim-core";

export interface PlanetSpec {
  name: string; radius: number; seed: number;
  /** dark -> light ramp (hex) */
  ramp: number[];
  bands?: number;       // horizontal banding strength (gas giants)
  craters?: number;     // dark spots (moons)
  ring?: { inner: number; outer: number; color: number } | null;
}
export interface PlanetImage { size: number; data: Uint8ClampedArray }

export const PLANETS: PlanetSpec[] = [
  { name: "gas giant", radius: 44, seed: 11, ramp: [0x3a2418, 0x6b4328, 0x9a6a3c, 0xc99a5e, 0xe8c58a], bands: 1 },
  { name: "ice world", radius: 30, seed: 23, ramp: [0x16304a, 0x25587a, 0x3f8aa8, 0x7cc4d4, 0xcfeef0] },
  { name: "moon", radius: 16, seed: 5, ramp: [0x2a2a30, 0x4a4a52, 0x6e6e78, 0x9a9aa4, 0xc4c4cc], craters: 7 },
  { name: "ringed planet", radius: 34, seed: 37, ramp: [0x3a1a2a, 0x6a2c44, 0x9a4a5a, 0xc87a74, 0xeab09a], bands: 0.5,
    ring: { inner: 1.35, outer: 1.85, color: 0xd9b98a } },
];

const STEPS = 5;

/** Pixel-art planet: quantized shading lit from the upper left, deterministic per seed. */
export function renderPlanet(spec: PlanetSpec): PlanetImage {
  const R = spec.radius;
  const pad = spec.ring ? Math.ceil(R * spec.ring.outer) : R;
  const size = pad * 2 + 2;
  const data = new Uint8ClampedArray(size * size * 4);
  const r = createRng(spec.seed);
  const rng = () => r.next();
  const craters = Array.from({ length: spec.craters ?? 0 }, () => {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 0.8;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.1 + rng() * 0.14 };
  });
  const phase = rng() * 6.28;
  const c = size / 2;
  const put = (x: number, y: number, col: number) => {
    const i = (y * size + x) * 4;
    data[i] = (col >> 16) & 255; data[i + 1] = (col >> 8) & 255; data[i + 2] = col & 255; data[i + 3] = 255;
  };
  const shade = (nx: number, ny: number, nz: number, detail: number) => {
    // light from upper-left-front
    const l = Math.max(0, nx * -0.55 + ny * -0.55 + nz * 0.63);
    const v = Math.min(1, Math.max(0, l * 0.95 + detail));
    return spec.ramp[Math.min(spec.ramp.length - 1, Math.floor(v * STEPS))];
  };
  const ringAt = (x: number, y: number) => {
    if (!spec.ring) return false;
    const dx = (x + 0.5 - c) / R, dy = ((y + 0.5 - c) / R) / 0.32; // flattened ellipse
    const d = Math.hypot(dx, dy);
    return d > spec.ring.inner && d < spec.ring.outer;
  };
  // back half of ring first, then planet, then front half
  const drawRing = (front: boolean) => {
    if (!spec.ring) return;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!ringAt(x, y)) continue;
      const isFront = y + 0.5 > c;
      if (isFront !== front) continue;
      put(x, y, (x + y) % 5 === 0 ? 0xb89868 : spec.ring.color);
    }
  };
  drawRing(false);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5 - c) / R, ny = (y + 0.5 - c) / R;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2);
    let detail = 0;
    if (spec.bands) detail += Math.sin(ny * 9 + Math.sin(nx * 3 + phase) * 0.6) * 0.07 * spec.bands;
    for (const k of craters) if (Math.hypot(nx - k.x, ny - k.y) < k.r) detail -= 0.18;
    put(x, y, shade(nx, ny, nz, detail));
  }
  drawRing(true);
  return { size, data };
}
