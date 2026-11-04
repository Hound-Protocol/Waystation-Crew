import type { World } from "../world";
import { DEPARTMENT_NAMES } from "../org/departments";
import { RANK_NAMES } from "../org/ranks";
import { jobOf } from "../org/jobs";
import { ActionKind } from "./affordances";
import { scoreOptions } from "./decide";

/** Human-readable "why did they do that". Read-only: uses a forked rng and never touches world state. */
export function explain(world: World, id: number): string[] {
  const c = world.chars;
  if (id < 0 || id >= c.count) return ["No such character"];
  const a = world.actions[id];
  const lines: string[] = [];
  lines.push(`Now: ${a ? ActionKind[a.kind] : "Idle"}${a && a.furnitureId >= 0 ? ` (furniture #${a.furnitureId}, ${a.path.length} tiles away)` : ""}`);
  lines.push(`${c.name(id)} — ${DEPARTMENT_NAMES[c.dept[id]]} ${RANK_NAMES[c.rank[id]]}`);
  const job = jobOf(world, id);
  lines.push(`Job: ${job ? `${DEPARTMENT_NAMES[job.dept]}, ${job.shift} shift, workstation #${job.workstationFurnitureId}` : "none"}`);
  lines.push(`Needs: hunger ${c.hunger[id].toFixed(2)} · energy ${c.energy[id].toFixed(2)} · social ${c.social[id].toFixed(2)} · fun ${c.fun[id].toFixed(2)}`);
  const opts = scoreOptions(world, id, world.rng.fork(`explain:${world.tick}:${id}`)).slice(0, 3);
  if (opts.length === 0) lines.push("Option: nothing pressing — wandering or idling");
  opts.forEach((o, i) => lines.push(`Option ${i + 1}: ${ActionKind[o.action.kind]} (score ${o.score.toFixed(2)}) — ${o.why}`));
  return lines;
}
