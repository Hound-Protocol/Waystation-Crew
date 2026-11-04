import { EMISSIVE_KEYS } from "./sprites/palette";

export interface Light { x: number; y: number; r: number; i: number; c: [number, number, number] }
const LEVELS = [0.16, 0.28, 0.44, 0.62, 0.82, 1.0];

/** Bakes 6-step quantized point lighting into RGBA pixels. Emissive colours pass through unchanged. */
export function bakeLighting(data: Uint8ClampedArray, W: number, H: number, lights: Light[], ambient = 0.3): void {
  const L = new Float32Array(W * H).fill(ambient), TR = new Float32Array(W * H), TG = new Float32Array(W * H), TB = new Float32Array(W * H);
  for (const l of lights) {
    const x0 = Math.max(0, Math.floor(l.x - l.r)), x1 = Math.min(W - 1, Math.ceil(l.x + l.r));
    const y0 = Math.max(0, Math.floor(l.y - l.r)), y1 = Math.min(H - 1, Math.ceil(l.y + l.r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - l.x, y - l.y);
      if (d >= l.r) continue;
      const f = (1 - d / l.r) ** 2 * l.i, i = y * W + x;
      L[i] += f; TR[i] += l.c[0] * f; TG[i] += l.c[1] * f; TB[i] += l.c[2] * f;
    }
  }
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (data[o + 3] === 0) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    if (EMISSIVE_KEYS.has((r << 16) | (g << 8) | b)) continue;
    let q = LEVELS[0], best = Infinity;
    for (const v of LEVELS) { const d = Math.abs(v - L[i]); if (d < best) { best = d; q = v; } }
    data[o] = Math.min(255, r * q + TR[i] * 0.12); data[o + 1] = Math.min(255, g * q + TG[i] * 0.12); data[o + 2] = Math.min(255, b * q + TB[i] * 0.12);
  }
}
