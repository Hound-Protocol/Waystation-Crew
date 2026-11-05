import type { World } from "../world";
import type { Action } from "../ai/affordances";
import { ActionKind } from "../ai/affordances";
import { isWalkable, TileKind, type Point } from "../station/tilemap";
import { findPath } from "../station/nav";
import { engineeringLead, onShiftEngineers, isFree, interrupt } from "../light/ops";
import { startRestart, TUNING } from "./reactor";

/** Engineers run the reactor: the Chief (or the on-shift Senior) commands, one engineer keeps watch at the console, others refuel, service and restart it. */
export const WATCH_TICKS = 60, REFUEL_TICKS = 40, SERVICE_TICKS = 120, RESTART_TICKS = 15;
const ASSIGN_EVERY = 10, NUDGE = 0.05, REFUEL_BELOW = 0.4, REFUEL_AMOUNT = 0.25, SERVICE_ABOVE = 0.15, SERVICE_AMOUNT = 0.2;

type Duty = "restart" | "refuel" | "service" | "watch";
const DUTIES: Duty[] = ["restart", "refuel", "service", "watch"];            // priority, highest first
const KIND: Record<Duty, ActionKind> = { restart: ActionKind.Restart, refuel: ActionKind.Refuel, service: ActionKind.Service, watch: ActionKind.Watch };
const TICKS: Record<Duty, number> = { restart: RESTART_TICKS, refuel: REFUEL_TICKS, service: SERVICE_TICKS, watch: WATCH_TICKS };

export const isPowerKind = (k: ActionKind) => k === ActionKind.Watch || k === ActionKind.Service || k === ActionKind.Refuel || k === ActionKind.Restart;

/** Who decides what happens at the reactor: the highest-ranked engineer on shift, or -1. */
export const commandAuthority = (w: World): number => engineeringLead(w);

/** A walkable tile beside the reactor prop (the console), or null if the station has no reactor. */
export function reactorSite(w: World): Point | null {
  const prop = w.station.deco?.find((d) => d.sprite === "prop:reactor"); if (!prop) return null;
  const map = w.station.map;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const x = prop.x + dx, y = prop.y + dy;
    if (map.inBounds(x, y) && isWalkable(map.get(x, y)) && map.get(x, y) !== TileKind.Door) return { x, y };
  }
  return null;
}

function needed(w: World, d: Duty): boolean {
  const g = w.power, r = g.reactor;
  switch (d) {
    case "restart": return (r.status === "scram" || r.status === "offline") ? r.fuel > 0.02 : r.status === "starting";
    case "refuel": return r.fuel < REFUEL_BELOW && g.fuelStore > 0.05 && r.fuel < 1;
    case "service": return r.wear > SERVICE_ABOVE;
    case "watch": return r.status === "running" || r.status === "starting";
  }
}

/** The lead's standing orders, every few ticks: keep each needed duty on one free engineer. */
export function stepPower(w: World): void {
  if (w.tick % ASSIGN_EVERY !== 0) return;
  const g = w.power, crew = onShiftEngineers(w);
  if (!crew.length) { g.assign = { watch: -1, refuel: -1, service: -1, restart: -1 }; return; }
  const lead = engineeringLead(w), site = reactorSite(w); if (!site) return;
  const onShift = new Set(crew), held = () => new Set(Object.values(g.assign).filter((v) => v >= 0));
  for (const d of DUTIES) {
    const cur = g.assign[d];
    if (!needed(w, d) || !onShift.has(cur)) g.assign[d] = -1;
    if (g.assign[d] >= 0 || !needed(w, d)) continue;
    const taken = held(), others = crew.filter((id) => id !== lead), pool = others.length ? others : [lead];
    let best = -1, bd = Infinity;
    for (const id of pool) { if (taken.has(id) || !isFree(w, id)) continue; const dist = Math.abs(w.chars.x[id] - site.x) + Math.abs(w.chars.y[id] - site.y); if (dist < bd) { bd = dist; best = id; } }
    if (best < 0) continue;
    g.assign[d] = best; interrupt(w, best);
  }
}

/** The reactor duty for an engineer holding one: walk to the console, then do it. */
export function powerAction(w: World, id: number, from: Point, blocked: (x: number, y: number) => boolean): { action: Action; score: number; why: string } | null {
  const g = w.power;
  const duty = DUTIES.find((d) => g.assign[d] === id && needed(w, d));
  if (!duty) return null;
  const site = reactorSite(w); if (!site) return null;
  const path = from.x === site.x && from.y === site.y ? [] : findPath(w.station.map, from, site, blocked);
  if (!path) return null;
  return { action: { kind: KIND[duty], furnitureId: -1, path, ticksLeft: TICKS[duty] }, score: 0.5 - 0.0005 * path.length, why: `reactor duty: ${duty}` };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const toward = (v: number, target: number) => clamp01(v + Math.max(-NUDGE, Math.min(NUDGE, target - v)));

/** The lead's adjustments on a watch: temperature in the band, containment above what temperature demands, feed steady. */
function nudge(w: World): void {
  const r = w.power.reactor, T = TUNING;
  if (r.status !== "running") return;
  r.feed = toward(r.feed, 0.6);
  if (r.temp > T.band[1] - 0.05) r.coolant = clamp01(r.coolant + NUDGE); else if (r.temp < T.band[0] + 0.05) r.coolant = clamp01(r.coolant - NUDGE);
  r.field = toward(r.field, clamp01(r.temp * T.fieldPerTemp + 0.2));
}

function advanceRestart(w: World): void {
  const r = w.power.reactor;
  if (r.status === "scram" || r.status === "offline") { if (startRestart(r)) r.field = Math.max(r.field, 0.7); return; }
  if (r.status !== "starting") return;
  if (r.step >= 1 && r.coolant < TUNING.stepSetpoint) r.coolant = 0.5;
  if (r.step >= 3 && r.feed < TUNING.stepSetpoint) r.feed = 0.6;
}

/** A duty is done. */
export function finishPower(w: World, a: Action, _id: number): void {
  const g = w.power, r = g.reactor;
  if (a.kind === ActionKind.Watch) { if (engineeringLead(w) >= 0) nudge(w); }
  else if (a.kind === ActionKind.Refuel) { const amt = Math.min(g.fuelStore, 1 - r.fuel, REFUEL_AMOUNT); r.fuel += amt; g.fuelStore -= amt; }
  else if (a.kind === ActionKind.Service) r.wear = Math.max(0, r.wear - SERVICE_AMOUNT);
  else if (a.kind === ActionKind.Restart) advanceRestart(w);
}
