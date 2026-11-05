import type { World } from "../world";
import type { Station } from "../station/starter";
import { TileKind } from "../station/tilemap";
import { Department } from "./departments";
import { Rank } from "./ranks";

export type Shift = "day" | "swing" | "night";
export const SHIFTS: Shift[] = ["day", "swing", "night"];

export interface JobPost { id: number; dept: Department; minRank: Rank; workstationFurnitureId: number; shift: Shift }

const ROOM_DEPT: Record<string, Department> = {
  Bridge: Department.Command, Engineering: Department.Engineering, Medbay: Department.Medical,
  Security: Department.Security, Cargo: Department.Supply, Arrivals: Department.Supply, Galley: Department.Service, "Cargo Ship": Department.Flight,
};

/** Sim starts at 06:00 station time. Day 06-14, swing 14-22, night 22-06. */
export function shiftOf(tick: number): Shift {
  const hour = (tick / 3600 + 6) % 24;
  return hour >= 6 && hour < 14 ? "day" : hour >= 14 && hour < 22 ? "swing" : "night";
}

/** Job posts for the given workstation furniture: consoles and tables, one post per shift. Ids continue from `startId`. */
export function postsFor(station: Station, furnitureIds: Iterable<number>, startId = 0): JobPost[] {
  const posts: JobPost[] = [], ids = [...furnitureIds];
  for (const shift of SHIFTS)
    for (const id of ids) {
      const f = station.furniture[id];
      if (f.kind !== TileKind.Console && f.kind !== TileKind.Table) continue;     // consoles and desks/tables are workstations
      const dept = ROOM_DEPT[station.rooms[f.roomId]?.name ?? ""];
      if (dept === undefined) continue;
      posts.push({ id: startId + posts.length, dept, minRank: dept === Department.Command ? Rank.Specialist : Rank.Trainee, workstationFurnitureId: f.id, shift });
    }
  return posts;
}

export function buildJobPosts(station: Station): JobPost[] {
  return postsFor(station, station.furniture.keys());
}

export function jobOf(world: World, id: number): JobPost | null {
  const j = world.chars.job[id];
  return j >= 0 ? world.posts[j] : null;
}

function take(world: World, id: number, dept: Department | null): boolean {
  for (const p of world.posts) {
    if ((dept !== null && p.dept !== dept) || world.postHolder.has(p.id) || world.chars.rank[id] < p.minRank) continue;
    world.postHolder.set(p.id, id);
    world.chars.job[id] = p.id;
    return true;
  }
  return false;
}

/** Fill open posts for unassigned characters: own department first, then Service, then any open post their rank allows, else stay unassigned. */
export function assignJobs(world: World, posts: JobPost[] = world.posts): void {
  void posts;
  const c = world.chars;
  for (let id = 0; id < c.count; id++) {
    if (c.job[id] >= 0) continue;
    if (take(world, id, c.dept[id])) continue;
    if (c.dept[id] !== Department.Service && take(world, id, Department.Service)) continue;
    take(world, id, null);     // last resort: any open post whose rank gate they meet
  }
}
