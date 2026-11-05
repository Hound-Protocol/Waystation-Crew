import type { World } from "../world";
import { growStation } from "./layout";
import { postsFor, assignJobs } from "../org/jobs";
import type { Room } from "./starter";

/** How often (sim seconds) the station checks whether the crew has outgrown it. */
export const GROWTH_INTERVAL = 3600;

/**
 * Autonomous growth: if the crew needs more beds or posts than the station has, the planner adds one room.
 * World indexes are extended (not rebuilt) so ids, reservations and held posts stay valid.
 */
export function growIfNeeded(world: World): Room | null {
  const st = world.station, before = st.furniture.length;
  const room = growStation(st, world.chars.count, world.rng.fork(`grow${world.tick}`));
  if (!room) return null;
  for (let i = before; i < st.furniture.length; i++) {
    const f = st.furniture[i], list = world.furnitureByKind.get(f.kind) ?? [];
    list.push(f.id); world.furnitureByKind.set(f.kind, list);
  }
  world.posts.push(...postsFor(st, Array.from({ length: st.furniture.length - before }, (_, k) => before + k), world.posts.length));
  assignJobs(world);
  world.stationRev += 1;
  return room;
}
