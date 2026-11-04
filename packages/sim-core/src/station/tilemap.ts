export enum TileKind { Void, Floor, Wall, Door, Bed, Console, Table, Plant, Airlock }

export interface Point { x: number; y: number }

export interface Tilemap {
  w: number; h: number; tiles: Uint8Array;
  get(x: number, y: number): TileKind;
  set(x: number, y: number, k: TileKind): void;
  inBounds(x: number, y: number): boolean;
}

export function createTilemap(w: number, h: number): Tilemap {
  const tiles = new Uint8Array(w * h);
  return {
    w, h, tiles,
    get: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? TileKind.Void : tiles[y * w + x]),
    set: (x, y, k) => { tiles[y * w + x] = k; },
    inBounds: (x, y) => x >= 0 && y >= 0 && x < w && y < h,
  };
}

/** Walkable by characters. Beds are walkable (characters sleep on them). */
export function isWalkable(k: TileKind): boolean {
  return k === TileKind.Floor || k === TileKind.Door || k === TileKind.Bed || k === TileKind.Airlock;
}
