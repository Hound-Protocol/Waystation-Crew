import { TileKind } from "./tilemap";
import { Department } from "../org/departments";
import { postsFor } from "../org/jobs";
import type { Station } from "./starter";
import type { ModuleKind } from "./kit";

/** Crew mix by department (shares of the population); keep in step with population.ts. */
const SHARE: Array<[Department, number, ModuleKind]> = [
  [Department.Command, 3, "command"], [Department.Engineering, 12, "engineering"], [Department.Medical, 8, "medical"],
  [Department.Security, 8, "security"], [Department.Supply, 10, "supply"], [Department.Service, 19, "galley"],
];
const TOTAL = SHARE.reduce((s, [, n]) => s + n, 0);

/** What the station should build next for `pop` crew: Arrivals first, then beds, then the department furthest short of posts. */
export function nextBuild(st: Station, pop: number): ModuleKind | null {
  if (!st.rooms.some((r) => r.kind === "arrivals")) return "arrivals";
  const beds = st.furniture.filter((f) => f.kind === TileKind.Bed).length;
  if (beds < Math.ceil(pop * 1.1)) return "habitation";
  const posts = new Map<Department, number>();
  for (const p of postsFor(st, st.furniture.keys())) posts.set(p.dept, (posts.get(p.dept) ?? 0) + 1);
  let worst: { kind: ModuleKind; gap: number } | null = null;
  for (const [dept, share, kind] of SHARE) {
    const need = Math.ceil((pop * share) / TOTAL), gap = (need - (posts.get(dept) ?? 0)) / need;
    if (gap > 0 && (!worst || gap > worst.gap)) worst = { kind, gap };
  }
  return worst?.kind ?? null;
}
