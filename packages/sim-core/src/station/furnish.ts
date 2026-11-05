import { TileKind, isWalkable } from "./tilemap";
import type { Room, Station } from "./starter";

/** facing 0=N 1=E 2=S 3=W: the side a piece fronts onto (where you stand/sit; a bed's foot). */
export const FACING: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Orient every piece in a room and put a chair where each workstation is used from. Deterministic, no rng. */
export function furnishRoom(st: Station, room: Room): void {
  const map = st.map, deco = st.deco!;
  const inRoom = (x: number, y: number) => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
  const occupied = (x: number, y: number) => st.furniture.some((g) => g.x === x && g.y === y) || deco.some((d) => d.x === x && d.y === y && d.layer !== "wall" && (d.layer !== "floor" || d.sprite.startsWith("chair:")));
  const solid = (x: number, y: number) => { const k = map.get(x, y); return k === TileKind.Wall || k === TileKind.Void || (!isWalkable(k) && k !== TileKind.Door); };
  const openCount = (x: number, y: number) => FACING.filter(([ax, ay]) => map.get(x + ax, y + ay) === TileKind.Floor && !occupied(x + ax, y + ay)).length;

  for (const f of st.furniture) {
    if (f.roomId !== room.id || f.facing !== undefined) continue;
    if (f.kind === TileKind.Bed) {
      // head against a wall, foot into the room
      let best = 2, bs = -1;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = FACING[d];
        const score = (solid(f.x - dx, f.y - dy) ? 2 : 0) + (map.get(f.x + dx, f.y + dy) === TileKind.Floor ? 1 : 0);
        if (score > bs) { bs = score; best = d; }
      }
      f.facing = best as 0 | 1 | 2 | 3; continue;
    }
    if (f.kind === TileKind.Console || f.kind === TileKind.Table) {
      let best = -1, bs = -1;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = FACING[d], sx = f.x + dx, sy = f.y + dy;
        if (map.get(sx, sy) !== TileKind.Floor || occupied(sx, sy) || openCount(sx, sy) < 1) continue;   // never seat someone in a dead-end pocket
        const score = (solid(f.x - dx, f.y - dy) ? 10 : 0) + (inRoom(sx, sy) ? 5 : 0) + openCount(sx, sy);
        if (score > bs) { bs = score; best = d; }
      }
      if (best < 0) { f.facing = 2; continue; }
      f.facing = best as 0 | 1 | 2 | 3;
      const [dx, dy] = FACING[best], sx = f.x + dx, sy = f.y + dy;
      if (f.style !== "console:kiosk" && inRoom(sx, sy) && !deco.some((d) => d.x === sx && d.y === sy && d.sprite.startsWith("chair:")))
        deco.push({ x: sx, y: sy, sprite: `chair:${(best + 2) % 4}`, layer: "floor" });
      continue;
    }
    f.facing = 2;
  }
}
