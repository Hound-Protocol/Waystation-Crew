import type { World } from "../world";
import { ActionKind } from "./affordances";

/** What a character is busy with, for displays: the kind of task (an ActionKind, or 0 for none), the tick it started (-1 while still walking to it) and its length in ticks. */
export interface Task { kind: number; began: number; total: number }
export const NO_TASK: Task = { kind: 0, began: -1, total: 0 };

const SHOWN = new Set<ActionKind>([ActionKind.Eat, ActionKind.Sleep, ActionKind.Relax, ActionKind.Work, ActionKind.Build, ActionKind.Watch, ActionKind.Service, ActionKind.Refuel, ActionKind.Restart]);

export function taskOf(world: World, id: number): Task {
  const a = world.actions[id];
  if (!a || !SHOWN.has(a.kind)) return NO_TASK;
  return { kind: a.kind, began: a.began ?? -1, total: a.total ?? 0 };
}
