/**
 * The docked ship's pre-departure routine, as a pure function of sim time. A stand-in until real flights drive the ship:
 * idle -> bars lower -> locked (nozzles warm) -> burn (main thrusters fire) -> bars raise (nozzles cool) -> idle.
 * bars: 0 raised / open .. 1 locked. thrust: main-engine plume. glow: nozzle heat (lingers after the burn).
 * gate: the heavy gateways, 0 shut .. 1 open. They move only on this schedule (never for passers-by): open all the time the ship is docked,
 * closing for the minute before the bars lower, opening again a minute after the burn. A swing is three beats: crack, pause, slow heave.
 */
export const CYCLE = 1800;
export type ShipPhase = "docked" | "restraining" | "locked" | "burn" | "releasing";
export interface ShipState { phase: ShipPhase; bars: number; thrust: number; glow: number; gate: number; gateMoving: boolean }

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Gate opening profile over p in 0..1: crack open to 10%, hold, then heave open slowly. */
export const gateProfile = (p: number) => (p < 0.15 ? 0.1 * ease(p / 0.15) : p < 0.3 ? 0.1 : 0.1 + 0.9 * ease((p - 0.3) / 0.7));

function gateAt(t: number): { gate: number; gateMoving: boolean } {
  if (t < 1140) return { gate: 1, gateMoving: false };
  if (t < 1200) return { gate: gateProfile(1 - (t - 1140) / 60), gateMoving: true };
  if (t < 1500) return { gate: 0, gateMoving: false };
  if (t < 1560) return { gate: gateProfile((t - 1500) / 60), gateMoving: true };
  return { gate: 1, gateMoving: false };
}

export function shipState(tick: number): ShipState {
  const t = ((tick % CYCLE) + CYCLE) % CYCLE, gate = gateAt(t);
  return { ...base(t), ...gate };
}

function base(t: number): Omit<ShipState, "gate" | "gateMoving"> {
  if (t < 1200) return { phase: "docked", bars: 0, thrust: 0, glow: 0 };
  if (t < 1260) { const k = ease((t - 1200) / 60); return { phase: "restraining", bars: k, thrust: 0, glow: 0.5 * k }; }
  if (t < 1380) return { phase: "locked", bars: 1, thrust: 0, glow: 0.5 };
  if (t < 1440) {
    const up = clamp01((t - 1380) / 20), down = clamp01((1440 - t) / 20);
    return { phase: "burn", bars: 1, thrust: ease(Math.min(up, down)), glow: 0.5 + 0.5 * ease(up) };
  }
  if (t < 1500) { const k = ease((t - 1440) / 60); return { phase: "releasing", bars: 1 - k, thrust: 0, glow: 1 - k }; }
  return { phase: "docked", bars: 0, thrust: 0, glow: 0 };
}
