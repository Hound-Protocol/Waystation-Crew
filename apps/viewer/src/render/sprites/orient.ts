import { TileKind } from "@wc/sim-core";

const wallLike = (k: number) => k === TileKind.Wall || k === TileKind.Door || k === TileKind.Airlock;

/** A wall tile runs vertically when it joins walls above/below but none left/right. */
export function wallIsVertical(tiles: ArrayLike<number>, w: number, h: number, x: number, y: number): boolean {
  const at = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? -1 : tiles[yy * w + xx]);
  if (wallLike(at(x - 1, y)) || wallLike(at(x + 1, y))) return false;
  return wallLike(at(x, y - 1)) || wallLike(at(x, y + 1));
}
