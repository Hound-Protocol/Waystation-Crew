import type { World } from "../world";
import { TileKind } from "../station/tilemap";
import { lampsOf } from "../light/coverage";
import { createReactor, stepReactor, type ReactorState } from "./reactor";

/** Units: the reactor's maximum output is 1. Demand is the sum of what the station draws. */
export const GRID = {
  lamp: 0.002, machine: 0.005, /** life support and doors: the load the battery covers in a blackout */ base: 0.08,
  /** ticks a full battery lasts at the base load, and ticks to charge it from empty with spare supply */ batteryTicks: 1800, chargeTicks: 600,
};

export interface PowerGrid {
  reactor: ReactorState;
  /** battery bank charge, 0..1 */ battery: number;
  demand: number; supply: number;
  /** supply as a share of demand, 0..1: lamps dim and machines slow by this */ supplyLevel: number;
  /** doors, airlock panels and life support have power (supply covers them, or the battery does) */ doorsPowered: boolean;
  /** the battery is empty during a blackout */ lifeSupportDown: boolean;
  /** fuel waiting in storage for engineers to load, 0..1 */ fuelStore: number;
  /** cached counts, refreshed when the station changes */ cacheRev: number; lamps: number; machines: number;
}

export const createGrid = (): PowerGrid => ({ reactor: createReactor(), battery: 1, demand: 0, supply: 0, supplyLevel: 1, doorsPowered: true, lifeSupportDown: false, fuelStore: 0.3, cacheRev: -1, lamps: 0, machines: 0 });

/** Total draw: lamps, machines (consoles) and the base load. Counts are cached until the station changes. */
export function demand(w: World): number {
  const g = w.power;
  if (g.cacheRev !== w.stationRev) { g.cacheRev = w.stationRev; g.lamps = lampsOf(w.station).length; g.machines = w.station.furniture.filter((f) => f.kind === TileKind.Console).length; }
  return g.lamps * GRID.lamp + g.machines * GRID.machine + GRID.base;
}

/** One tick: the reactor runs, supply meets demand, and the battery covers the base load in a blackout or recharges from spare supply. */
export function stepGrid(w: World): void {
  const g = w.power; stepReactor(g.reactor);
  g.demand = demand(w); g.supply = Math.max(0, g.reactor.output - g.reactor.fieldDraw);
  g.supplyLevel = g.demand <= 0 ? 1 : Math.min(1, Math.max(0, g.supply / g.demand));
  const shortfall = GRID.base > 0 ? Math.max(0, GRID.base - g.supply) / GRID.base : 0;     // 0..1 of the base load the reactor fails to cover
  if (shortfall > 0) g.battery = Math.max(0, g.battery - shortfall / GRID.batteryTicks);
  else if (g.supply >= g.demand && g.battery < 1) g.battery = Math.min(1, g.battery + 1 / GRID.chargeTicks);
  g.doorsPowered = shortfall === 0 || g.battery > 0;
  g.lifeSupportDown = !g.doorsPowered;
}
