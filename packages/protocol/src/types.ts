export interface Point { x: number; y: number }
export interface Viewport { x: number; y: number; w: number; h: number; zoom: number }
/** What a character is busy with: an ActionKind (0 = nothing worth showing), the tick it began (-1 while still walking there) and its length in ticks. */
export interface TaskSnap { kind: number; began: number; total: number }
export interface CharSnap { id: number; name: string; dept: number; rank: number; x: number; y: number; state: number; job: number; task?: TaskSnap }
export interface FurnitureSnap { id: number; kind: number; x: number; y: number; roomId: number; style?: string; facing?: 0 | 1 | 2 | 3 }
/** Visual-only decoration: floor markings, standing props and wall mounts. */
export interface DecoSnap { x: number; y: number; sprite: string; layer: "floor" | "prop" | "wall" }
export interface RoomSnap { id: number; name: string; x: number; y: number; w: number; h: number; kind?: string }
/** A character walks `path`; path[i] is reached at tick startTick + 1 + i. */
export interface Move { id: number; startTick: number; from: Point; path: Point[] }
export interface StateChange { id: number; state: number }
export interface TaskChange { id: number; task: TaskSnap }
export interface Clock { speed: number; paused: boolean }
export type DevCmd =
  | { c: "speed"; mult: number }
  | { c: "pause" }
  | { c: "spawn"; count: number; dept?: number }
  | { c: "reset"; seed: number };

/** Live status card for the PDA. Needs run 0 (desperate) to 1 (satisfied). */
export interface Profile {
  id: number; name: string; dept: string; rank: string; activity: string; place: string;
  needs: { hunger: number; energy: number; social: number; fun: number };
  condition: string;
  job: { dept: string; shift: "day" | "swing" | "night"; room: string; onShift: boolean } | null;
  shiftNow: "day" | "swing" | "night";
  thoughts: string[];
}

/** The cargo ship's deck as a chunk of its own (local tile coordinates); `berth` is where it parks in the station map. */
export interface ShipChunkSnap { w: number; h: number; tiles: number[]; furniture: FurnitureSnap[]; rooms: RoomSnap[]; deco: DecoSnap[]; floors: number[]; berth: { x: number; y: number; w: number; h: number } }

/** Station-wide numbers for the overview card, refreshed every few seconds. */
export interface StatsSnap { needs: { hunger: number; energy: number; social: number; hygiene: number; fun: number }; lamps: number; dark: number; orders: number; built: number; rooms: number }
/** The cargo ship's schedule state: `slip` ticks late; `holding` while it waits at the door for its pilots. */
export interface ShipStatus { slip: number; holding: boolean; /** crew locked aboard for the trip */ aboard: number }
