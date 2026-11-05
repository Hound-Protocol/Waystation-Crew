import type { World } from "../world";
import { DEPARTMENT_NAMES } from "../org/departments";
import { RANK_NAMES } from "../org/ranks";
import { jobOf, shiftOf, type Shift } from "../org/jobs";
import { ActionKind } from "./affordances";
import { scoreOptions } from "./decide";

export interface CharProfile {
  id: number; name: string; dept: string; rank: string;
  /** What they are doing right now, in plain words. */
  activity: string;
  /** The room they are standing in ("Corridor" outside any room). */
  place: string;
  /** 0 = desperate, 1 = fully satisfied. */
  needs: { hunger: number; energy: number; social: number; fun: number };
  /** Worst need as a short status. */
  condition: string;
  job: { dept: string; shift: Shift; room: string; onShift: boolean } | null;
  shiftNow: Shift;
  /** Top reasons behind what they want next. */
  thoughts: string[];
}

const DOING: Record<number, string> = {
  [ActionKind.Idle]: "Standing by", [ActionKind.Wander]: "Wandering the station", [ActionKind.Eat]: "Eating",
  [ActionKind.Sleep]: "Sleeping", [ActionKind.Relax]: "Relaxing", [ActionKind.Work]: "Working",
};
const WORST: Record<string, [string, string]> = { hunger: ["Hungry", "Starving"], energy: ["Tired", "Exhausted"], social: ["Lonely", "Isolated"], fun: ["Bored", "Restless"] };

function roomName(world: World, x: number, y: number): string {
  for (const r of world.station.rooms) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.name;
  return "Corridor";
}

/** Read-only snapshot for the PDA: structured, so the viewer never parses text. */
export function profileOf(world: World, id: number): CharProfile | null {
  const c = world.chars;
  if (id < 0 || id >= c.count) return null;
  const a = world.actions[id];
  const needs = { hunger: c.hunger[id], energy: c.energy[id], social: c.social[id], fun: c.fun[id] };
  const [worst, v] = (Object.entries(needs) as Array<[keyof typeof needs, number]>).sort((p, q) => p[1] - q[1])[0];
  const condition = v >= 0.4 ? "Fine" : WORST[worst][v < 0.15 ? 1 : 0];
  const job = jobOf(world, id);
  const shiftNow = shiftOf(world.tick);
  const f = job ? world.station.furniture[job.workstationFurnitureId] : null;
  const thoughts = scoreOptions(world, id, world.rng.fork(`pda:${world.tick}:${id}`)).slice(0, 3).map((o) => `${DOING[o.action.kind]}: ${o.why}`);
  return {
    id, name: c.name(id), dept: DEPARTMENT_NAMES[c.dept[id]], rank: RANK_NAMES[c.rank[id]],
    activity: DOING[a ? a.kind : ActionKind.Idle] ?? "Standing by",
    place: roomName(world, Math.floor(c.x[id]), Math.floor(c.y[id])),
    needs, condition,
    job: job && f ? { dept: DEPARTMENT_NAMES[job.dept], shift: job.shift, room: roomName(world, f.x, f.y), onShift: job.shift === shiftNow } : null,
    shiftNow,
    thoughts: thoughts.length ? thoughts : ["Nothing pressing"],
  };
}
