import { HUB } from "@wc/sim-core";

/** Sim ticks in one day. The home planet makes a whole circuit of the sun in this time. */
export const DAY = 86400;

export interface Body {
  name: string;
  planet: number;   // index into PLANETS (sprite)
  orbit: number;    // orbital radius, tiles
  radius: number;   // body radius, tiles
  phase: number;    // starting angle, radians
  home?: boolean;   // the station sits beside this one
}

export const SUN_RADIUS = 1800;
/** Distance of the station from its home planet's centre, tiles. */
const STATION_OFFSET = { x: 1400, y: -1040 };

export const BODIES: Body[] = [
  { name: "Cinder", planet: 2, orbit: 5000, radius: 70, phase: 2.2 },
  { name: "Home", planet: 1, orbit: 9000, radius: 170, phase: 0.6, home: true },
  { name: "Halo", planet: 3, orbit: 15000, radius: 260, phase: 4.1 },
  { name: "Goliath", planet: 0, orbit: 24000, radius: 380, phase: 5.3 },
];

const HOME = BODIES.find((b) => b.home)!;

/** Kepler's third law, scaled so the home planet's year is exactly one day. */
export const periodOf = (b: Body) => DAY * Math.pow(b.orbit / HOME.orbit, 1.5);

/** Position relative to the sun, tiles. */
export function helio(b: Body, tick: number): { x: number; y: number } {
  const a = b.phase + (2 * Math.PI * tick) / periodOf(b);
  return { x: Math.cos(a) * b.orbit, y: Math.sin(a) * b.orbit };
}

/** Everything in world (map-tile) coordinates, with the station fixed where it always is. */
export function stationFrame(tick: number) {
  const h = helio(HOME, tick);
  const sx = h.x + STATION_OFFSET.x, sy = h.y + STATION_OFFSET.y;     // station, heliocentric
  const ox = HUB.x - sx, oy = HUB.y - sy;                              // heliocentric -> world
  return {
    station: { x: HUB.x, y: HUB.y },
    sun: { x: ox, y: oy },
    body: (b: Body) => { const p = helio(b, tick); return { x: p.x + ox, y: p.y + oy }; },
  };
}

/** Bounds of the whole system in world tiles (for camera clamping), generous margin. */
export const SYSTEM_EXTENT = 24000 + 380 + 6000;
