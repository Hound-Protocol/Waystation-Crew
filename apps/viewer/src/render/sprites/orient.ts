import { TileKind } from "@wc/sim-core";

const wallLike = (k: number) => k === TileKind.Wall || k === TileKind.Door || k === TileKind.Airlock;

function run(tiles: ArrayLike<number>, w: number, h: number, x: number, y: number, dx: number, dy: number): number {
  let n = 0;
  for (let cx = x, cy = y; cx >= 0 && cy >= 0 && cx < w && cy < h && wallLike(tiles[cy * w + cx]); cx += dx, cy += dy) n++;
  return n;
}

/** A wall tile is vertical when the wall run through it is longer top-to-bottom than left-to-right (thick walls included). */
export function wallIsVertical(tiles: ArrayLike<number>, w: number, h: number, x: number, y: number): boolean {
  const hr = run(tiles, w, h, x, y, -1, 0) + run(tiles, w, h, x, y, 1, 0) - 1;
  const vr = run(tiles, w, h, x, y, 0, -1) + run(tiles, w, h, x, y, 0, 1) - 1;
  return vr > hr;
}

/** Which face of a vertical wall this tile shows: outer left, outer right, the inside of a thick wall, or a lone 1-wide wall. */
export function wallSide(tiles: ArrayLike<number>, w: number, h: number, x: number, y: number): "single" | "left" | "mid" | "right" {
  const at = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && wallLike(tiles[yy * w + xx]);
  const l = at(x - 1, y), r = at(x + 1, y);
  return l && r ? "mid" : l ? "right" : r ? "left" : "single";
}
