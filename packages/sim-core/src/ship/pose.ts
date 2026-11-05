import { shipPhase, PREP_STEPS, type Phase, type Where } from "./timeline";

/**
 * The ship's pose as a pure function of sim time (see timeline.ts for the phases).
 * s: 0 at the station berth .. 1 at the pad berth (progress along the flight line). turn: how far the ship has turned from its berth heading toward
 * its travel direction, 0..1. dir: +1 flying out to the pad, -1 flying back, 0 at rest.
 * bars: shoulder restraint bars, 0 raised .. 1 locked. thrust: main-engine plume. glow: nozzle heat.
 * Gates: the heavy gateways at the station dock and at the pad stub, 0 shut .. 1 open, moving only while swinging. They move only on schedule
 * (never for passers-by): open while the ship is docked, closing for the minute before the bars lower, opening in the minute after it docks.
 */
export interface GateLevel { v: number; moving: boolean }
export interface ShipPose { phase: Phase; at: Where; s: number; turn: number; dir: -1 | 0 | 1; bars: number; thrust: number; glow: number; stationGate: GateLevel; padGate: GateLevel }

export const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Gate opening profile over p in 0..1: crack open to 10%, hold, then heave open slowly. */
export const gateProfile = (p: number) => (p < 0.15 ? 0.1 * ease(p / 0.15) : p < 0.3 ? 0.1 : 0.1 + 0.9 * ease((p - 0.3) / 0.7));

const OPEN: GateLevel = { v: 1, moving: false }, SHUT: GateLevel = { v: 0, moving: false };
const OPENING_TICKS = PREP_STEPS[0][1];

/** Gate at the dock the ship is sitting at; `arrival` is the phase that follows the ship's arrival there. */
function dockGate(phase: Phase, t: number, u: number, arrival: Phase): GateLevel {
  if (phase === arrival) return t < OPENING_TICKS ? { v: gateProfile(t / OPENING_TICKS), moving: true } : OPEN;
  if (phase === "gate-closing") return { v: gateProfile(1 - u), moving: true };
  return SHUT;
}

function prepLevels(phase: Phase, t: number, u: number): { bars: number; thrust: number; glow: number } {
  switch (phase) {
    case "restraining": { const k = ease(u); return { bars: k, thrust: 0, glow: 0.5 * k }; }
    case "locked": return { bars: 1, thrust: 0, glow: 0.5 };
    case "burn": { const up = clamp01(t / 20), down = clamp01((60 - t) / 20); return { bars: 1, thrust: ease(Math.min(up, down)), glow: 0.5 + 0.5 * ease(up) }; }
    case "releasing": { const k = ease(u); return { bars: 1 - k, thrust: 0, glow: 1 - k }; }
    default: return { bars: 0, thrust: 0, glow: 0 };
  }
}

export function shipPose(tick: number): ShipPose {
  const ph = shipPhase(tick), { phase, at, leg, t, u } = ph;
  const stationGate = at === "station" ? dockGate(phase, t, u, "docked") : SHUT;
  const padGate = at === "pad" ? dockGate(phase, t, u, "landed") : SHUT;
  if (phase !== "flight") return { phase, at, s: at === "pad" ? 1 : 0, turn: 0, dir: 0, ...prepLevels(phase, t, u), stationGate, padGate };
  const e = ease(u), out = leg === "out";
  const turn = ease(clamp01(u / 0.2)) * ease(clamp01((1 - u) / 0.2));
  const accel = ease(Math.min(clamp01(u / 0.03), clamp01((0.4 - u) / 0.3)));
  const retro = 0.4 * Math.sin(Math.PI * clamp01((u - 0.85) / 0.15));
  const glow = ease(clamp01(u / 0.05)) * (1 - ease(clamp01(u / 0.7)));
  return { phase, at, s: out ? e : 1 - e, turn, dir: out ? 1 : -1, bars: 0, thrust: Math.min(1, accel + retro), glow, stationGate, padGate };
}
