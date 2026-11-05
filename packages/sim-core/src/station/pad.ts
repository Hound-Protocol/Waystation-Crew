import { TileKind, createTilemap } from "./tilemap";
import type { Deco, Station } from "./starter";

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * The landing pad on the home planet, in its own local tile coordinates (the viewer places it on the planet's surface).
 * West to east: the ship berth (the ship parks nose-west like at the station dock), the stub of the outpost gate touching the ship's
 * stern gateway, then the loading apron with the same 28 cargo slots as the hold and a loader lane between its two banks.
 */
export const PAD = {
  w: 80, h: 48,
  pad: { x: 2, y: 3, w: 70, h: 42 } as Rect,        // the paved rectangle, hazard-framed on its edge
  berth: { x: 6, y: 12, w: 36, h: 23 } as Rect,     // exactly the ship's room (with its wall margin)
  gate: { x: 42, y: 19, w: 1, h: 9 } as Rect,       // outpost gate stub, right behind the ship's last column, centred on the berth
  laneY: 23,
};

const FLOOR_STYLE = 10;

export function buildPad(): Station {
  const map = createTilemap(PAD.w, PAD.h), floors = new Uint8Array(PAD.w * PAD.h), deco: Deco[] = [];
  const { x: px, y: py, w: pw, h: ph } = PAD.pad;
  for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) { map.set(x, y, TileKind.Floor); floors[y * PAD.w + x] = FLOOR_STYLE; }
  for (let i = 0; i < pw; i++) deco.push({ x: px + i, y: py, sprite: "floor:hazard", layer: "floor" }, { x: px + i, y: py + ph - 1, sprite: "floor:hazard", layer: "floor" });
  for (let j = 1; j < ph - 1; j++) deco.push({ x: px, y: py + j, sprite: "floor:hazard", layer: "floor" }, { x: px + pw - 1, y: py + j, sprite: "floor:hazard", layer: "floor" });
  for (let y = PAD.gate.y; y < PAD.gate.y + PAD.gate.h; y++) map.set(PAD.gate.x, y, TileKind.Airlock);
  // apron: loader lane and two mirrored banks of slots (4 large 2x2, 4 medium 2x1, 6 small per bank, every cell a square marker)
  for (let x = 44; x <= 68; x++) deco.push({ x, y: PAD.laneY, sprite: "floor:lane", layer: "floor" });
  const bank: Array<[number, number]> = [];
  for (const x of [46, 49]) for (const y of [8, 11]) bank.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]);
  for (const x of [54, 57]) for (const y of [8, 10]) bank.push([x, y], [x + 1, y]);
  for (const x of [61, 63, 65]) for (const y of [8, 10]) bank.push([x, y]);
  for (const [x, y] of bank) deco.push({ x, y, sprite: "floor:slot", layer: "floor" }, { x, y: 2 * PAD.laneY - y, sprite: "floor:slot", layer: "floor" });
  // approach beacons on the rim, just inside the hazard frame
  const spots: Array<[number, number]> = [[px + 1, py + 1], [px + pw - 2, py + 1], [px + 1, py + ph - 2], [px + pw - 2, py + ph - 2], [px + 1, PAD.laneY], [px + pw - 2, PAD.laneY]];
  for (const x of [14, 26, 38, 50, 62]) spots.push([x, py + 1], [x, py + ph - 2]);
  for (const [x, y] of spots) { map.set(x, y, TileKind.Prop); deco.push({ x, y, sprite: "prop:beacon", layer: "prop" }); }
  return { map, rooms: [{ id: 0, name: "Landing Pad", x: px, y: py, w: pw, h: ph, kind: "pad" }], furniture: [], deco, floors };
}
