import type { World } from "../world";
import type { Station } from "../station/starter";
import type { Action } from "../ai/affordances";
import { ActionKind } from "../ai/affordances";
import { Department } from "../org/departments";
import { shiftOf } from "../org/jobs";
import { findPath } from "../station/nav";
import { inShip } from "../ship/ops";
import { LAMP_SPRITE, addLamp, buildCoverage } from "./coverage";
import { MAX_ORDERS, surveyOrders } from "./survey";

/** Engineering lights the station: the lead surveys for dark gaps on a timer and hands build orders to the crew; they walk there and fit a wall lamp. */
export const SURVEY_INTERVAL = 1200;      // 20 sim minutes
export const BUILD_TICKS = 240;           // 4 sim minutes per lamp
const STALE_TICKS = 600;                  // an order its engineer has not started by now goes back to the queue
const MAX_TRIES = 3;                      // after this many failed hand-outs the spot is struck off

export interface LightOrder { id: number; x: number; y: number; gain: number; /** assigned engineer, or -1 */ by: number; since: number; tries: number }
export interface LightOps { /** lamps lighting each tile */ cover: Uint8Array; coverRev: number; orders: LightOrder[]; /** spots struck off, as y * width + x */ bad: Set<number>; nextId: number; built: number }

export const createLightOps = (st: Station): LightOps => ({ cover: buildCoverage(st), coverRev: 0, orders: [], bad: new Set(), nextId: 1, built: 0 });

const onShiftEngineers = (w: World): number[] => {
  const out: number[] = [], s = shiftOf(w.tick), c = w.chars;
  for (let id = 0; id < c.count; id++) if (c.dept[id] === Department.Engineering && c.job[id] >= 0 && w.posts[c.job[id]]?.shift === s) out.push(id);
  return out;
};

/** The highest-ranked Engineering character on shift (lowest id breaks a tie), or -1. Only the lead decides what gets built. */
export function engineeringLead(w: World): number {
  let lead = -1;
  for (const id of onShiftEngineers(w)) if (lead < 0 || w.chars.rank[id] > w.chars.rank[lead]) lead = id;
  return lead;
}

const standTile = (o: LightOrder) => ({ x: o.x, y: o.y + 1 });
const isFree = (w: World, id: number) => { const a = w.actions[id]; return !a || a.kind === ActionKind.Work || a.kind === ActionKind.Idle || a.kind === ActionKind.Wander; };

/** An engineer given a build order drops their ordinary work for it. */
function interrupt(w: World, id: number): void {
  const a = w.actions[id];
  if (a && a.furnitureId >= 0 && w.reservations.get(a.furnitureId) === id) w.reservations.delete(a.furnitureId);
  w.actions[id] = null; w.chars.nextDecideTick[id] = w.tick;
}

/** Per tick (cheap: most ticks return at once): keep the coverage cache valid, return stale orders, survey on the timer, and hand out orders. */
export function stepLights(w: World): void {
  const L = w.light;
  if (L.coverRev !== w.stationRev) { L.cover = buildCoverage(w.station); L.coverRev = w.stationRev; }
  const surveyNow = w.tick % SURVEY_INTERVAL === 0;
  if (!L.orders.length && !surveyNow) return;
  const crew = onShiftEngineers(w), onShift = new Set(crew);
  for (const o of L.orders.slice()) {
    if (o.by < 0) continue;
    const a = w.actions[o.by];
    if (a?.kind === ActionKind.Build && a.order === o.id) continue;
    if (!onShift.has(o.by) || w.tick - o.since > STALE_TICKS) { o.by = -1; if (++o.tries >= MAX_TRIES) { L.bad.add(o.y * w.station.map.w + o.x); L.orders.splice(L.orders.indexOf(o), 1); } }
  }
  const lead = engineeringLead(w);
  if (lead < 0) return;
  const w0 = w.station.map.w;
  if (surveyNow && L.orders.length < MAX_ORDERS) {
    const taken = new Set<number>(L.bad); for (const o of L.orders) taken.add(o.y * w0 + o.x);
    for (const p of surveyOrders(w.station, L.cover, { max: MAX_ORDERS - L.orders.length, skip: (x, y) => inShip(w, x, y), taken })) L.orders.push({ id: L.nextId++, x: p.x, y: p.y, gain: p.gain, by: -1, since: 0, tries: 0 });
  }
  if (w.tick % 10 !== 0) return;
  const holding = new Set(L.orders.filter((o) => o.by >= 0).map((o) => o.by));
  const pool = crew.filter((id) => id !== lead); if (!pool.length) pool.push(lead);   // the lead builds himself only when nobody else is on shift
  for (const o of L.orders) {
    if (o.by >= 0) continue;
    const st = standTile(o); let best = -1, bd = Infinity;
    for (const id of pool) { if (holding.has(id) || !isFree(w, id)) continue; const d = Math.abs(w.chars.x[id] - st.x) + Math.abs(w.chars.y[id] - st.y); if (d < bd) { bd = d; best = id; } }
    if (best < 0) continue;
    o.by = best; o.since = w.tick; holding.add(best); interrupt(w, best);
  }
}

/** The build option for an engineer holding an order: walk to the floor in front of the spot, then fit the lamp. Null if there is none or the spot is unreachable. */
export function buildAction(w: World, id: number, from: { x: number; y: number }, blocked: (x: number, y: number) => boolean): { action: Action; score: number; why: string } | null {
  const o = w.light.orders.find((q) => q.by === id);
  if (!o) return null;
  const st = standTile(o), path = from.x === st.x && from.y === st.y ? [] : findPath(w.station.map, from, st, blocked);
  if (!path) return null;
  return { action: { kind: ActionKind.Build, furnitureId: -1, path, ticksLeft: BUILD_TICKS, order: o.id }, score: 0.45 - 0.0005 * path.length, why: `build order: lamp at ${o.x},${o.y} lights ${o.gain} dark tiles` };
}

/** The lamp goes up: the station map changes (viewers rebake and fade it in) and the coverage cache is updated in place. */
export function finishBuild(w: World, a: Action): void {
  const L = w.light, i = L.orders.findIndex((o) => o.id === a.order);
  if (i < 0) return;
  const o = L.orders.splice(i, 1)[0], deco = w.station.deco!;
  if (deco.some((d) => d.layer === "wall" && d.x === o.x && d.y === o.y)) return;
  deco.push({ x: o.x, y: o.y, sprite: LAMP_SPRITE, layer: "wall" });
  addLamp(L.cover, w.station, o.x, o.y); L.built++;
  const synced = L.coverRev === w.stationRev; w.stationRev += 1; if (synced) L.coverRev = w.stationRev;
}
