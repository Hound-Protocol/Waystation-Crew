import { TileKind, type Point } from "../station/tilemap";
import type { NeedKey } from "../ecs";

export enum ActionKind { Idle, Wander, Eat, Sleep, Relax, Work }
export enum CharState { Idle, Walking, Eating, Sleeping, Relaxing, Working }

export interface Action {
  kind: ActionKind;
  furnitureId: number; // -1 when none
  path: Point[];       // remaining steps; empty once arrived
  ticksLeft: number;
}

export interface Affordance {
  kind: ActionKind;
  furnitureKind: TileKind;
  satisfies: NeedKey;
  amountPerTick: number;
  durationTicks: number;
  weight: number;
}

export const AFFORDANCES: Affordance[] = [
  { kind: ActionKind.Eat, furnitureKind: TileKind.Table, satisfies: "hunger", amountPerTick: 0.7 / 600, durationTicks: 600, weight: 1.0 },
  { kind: ActionKind.Sleep, furnitureKind: TileKind.Bed, satisfies: "energy", amountPerTick: 0.9 / 28_800, durationTicks: 28_800, weight: 0.9 },
  { kind: ActionKind.Relax, furnitureKind: TileKind.Plant, satisfies: "fun", amountPerTick: 0.5 / 300, durationTicks: 300, weight: 0.4 },
];

export function stateForAction(kind: ActionKind, arrived: boolean): CharState {
  if (!arrived && kind !== ActionKind.Idle) return CharState.Walking;
  switch (kind) {
    case ActionKind.Eat: return CharState.Eating;
    case ActionKind.Sleep: return CharState.Sleeping;
    case ActionKind.Relax: return CharState.Relaxing;
    case ActionKind.Work: return CharState.Working;
    default: return CharState.Idle;
  }
}
