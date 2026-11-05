import type { World } from "./world";
import { addCharacter } from "./ecs";
import { generateName } from "./names";
import { Department } from "./org/departments";
import { Rank } from "./org/ranks";
import { assignJobs } from "./org/jobs";
import { TileKind } from "./station/tilemap";

const MIX: Array<[Department, number]> = [
  [Department.Command, 3], [Department.Engineering, 12], [Department.Medical, 8],
  [Department.Security, 8], [Department.Supply, 10], [Department.Service, 19],
  [Department.Flight, 2],
];

function dockingSpot(world: World): { x: number; y: number } {
  const room = world.station.rooms.find((r) => r.name === "Arrivals");
  const rng = world.rng.fork("spawn" + world.chars.count);
  if (!room) return { x: 1, y: 1 };
  for (let i = 0; i < 40; i++) {
    const x = rng.int(room.x + 1, room.x + room.w - 2), y = rng.int(room.y + 1, room.y + room.h - 2);
    if (world.station.map.get(x, y) === TileKind.Floor) return { x, y };
  }
  return { x: room.x + 1, y: room.y + room.h - 2 };
}

/** A character arrives at the docking bay and takes a job. */
export function arrive(world: World, dept: Department, rank: Rank = Rank.Trainee): number {
  const p = dockingSpot(world);
  const id = addCharacter(world, { name: generateName(world.rng), dept, rank, x: p.x, y: p.y });
  assignJobs(world);
  return id;
}

export function seedPopulation(world: World, n: number): void {
  const total = MIX.reduce((s, [, k]) => s + k, 0);
  const seen = new Map<Department, number>();
  for (let i = 0; i < n; i++) {
    let r = world.rng.int(0, total - 1), dept = Department.Service;
    for (const [d, k] of MIX) { if (r < k) { dept = d; break; } r -= k; }
    const idx = seen.get(dept) ?? 0; seen.set(dept, idx + 1);
    const rank = idx === 0 ? Rank.Chief : idx < 3 ? Rank.Senior : (world.rng.int(0, 2) as Rank);
    arrive(world, dept, rank);
  }
}
