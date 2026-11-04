import { TileKind, createTilemap, isWalkable, type Point, type Tilemap } from "./tilemap";

export interface Room { id: number; name: string; x: number; y: number; w: number; h: number }
export interface Furniture { id: number; kind: TileKind; x: number; y: number; roomId: number }
export interface Station { map: Tilemap; rooms: Room[]; furniture: Furniture[] }

/** Where a character stands to use furniture: the bed tile itself, else a walkable neighbour. */
export function interactionPoint(map: Tilemap, f: Furniture): Point | null {
  if (isWalkable(f.kind)) return { x: f.x, y: f.y };
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    if (isWalkable(map.get(f.x + dx, f.y + dy)) && map.get(f.x + dx, f.y + dy) !== TileKind.Door)
      return { x: f.x + dx, y: f.y + dy };
  }
  return null;
}

export function buildStarterStation(): Station {
  const map = createTilemap(60, 40);
  const rooms: Room[] = [];
  const furniture: Furniture[] = [];
  const room = (name: string, x: number, y: number, w: number, h: number): Room => {
    const r = { id: rooms.length, name, x, y, w, h };
    rooms.push(r);
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const edge = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1;
        map.set(xx, yy, edge ? TileKind.Wall : TileKind.Floor);
      }
    return r;
  };
  const put = (r: Room, kind: TileKind, x: number, y: number) => {
    map.set(x, y, kind);
    furniture.push({ id: furniture.length, kind, x, y, roomId: r.id });
  };
  // spine corridor rows 18-19
  for (let x = 1; x < 59; x++) for (const y of [18, 19]) map.set(x, y, TileKind.Floor);
  // top row rooms (walls rows 2..17, door toward corridor at bottom wall y=17)
  const top = (name: string, x: number, w: number) => {
    const r = room(name, x, 2, w, 16);
    map.set(x + (w >> 1), 17, TileKind.Door);
    return r;
  };
  const bottom = (name: string, x: number, w: number, h: number) => {
    const r = room(name, x, 20, w, h);
    map.set(x + (w >> 1), 20, TileKind.Door);
    return r;
  };
  const bridge = top("Bridge", 1, 12);
  for (let i = 0; i < 4; i++) put(bridge, TileKind.Console, 3 + i * 2, 4);
  const eng = top("Engineering", 13, 14);
  for (let i = 0; i < 4; i++) put(eng, TileKind.Console, 15 + i * 3, 4);
  const med = top("Medbay", 27, 12);
  for (let i = 0; i < 4; i++) put(med, TileKind.Bed, 29 + i * 2, 4);
  put(med, TileKind.Console, 29, 10);
  const sec = top("Security", 39, 10);
  for (let i = 0; i < 3; i++) put(sec, TileKind.Console, 41 + i * 2, 4);
  const dock = top("Docking", 49, 10);
  put(dock, TileKind.Console, 51, 4);
  for (let x = 50; x < 58; x++) map.set(x, 2, TileKind.Airlock);
  // bottom row
  const cargo = bottom("Cargo", 1, 12, 19);
  for (let i = 0; i < 3; i++) put(cargo, TileKind.Console, 3 + i * 3, 22);
  const galley = bottom("Galley", 13, 14, 19);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) put(galley, TileKind.Table, 15 + i * 4, 23 + j * 4);
  put(galley, TileKind.Plant, 15, 36);
  const hab = bottom("Habitation", 27, 32, 19);
  for (let row = 0; row < 8; row++)
    for (let c = 0; c < 15; c++) put(hab, TileKind.Bed, 28 + c * 2, 22 + row * 2);
  put(hab, TileKind.Plant, 29, 21);
  return { map, rooms, furniture };
}
