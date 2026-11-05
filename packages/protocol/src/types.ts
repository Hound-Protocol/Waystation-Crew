export interface Point { x: number; y: number }
export interface Viewport { x: number; y: number; w: number; h: number; zoom: number }
export interface CharSnap { id: number; name: string; dept: number; rank: number; x: number; y: number; state: number; job: number }
export interface FurnitureSnap { id: number; kind: number; x: number; y: number; roomId: number; style?: string }
/** Visual-only decoration: floor markings, standing props and wall mounts. */
export interface DecoSnap { x: number; y: number; sprite: string; layer: "floor" | "prop" | "wall" }
export interface RoomSnap { id: number; name: string; x: number; y: number; w: number; h: number; kind?: string }
/** A character walks `path`; path[i] is reached at tick startTick + 1 + i. */
export interface Move { id: number; startTick: number; from: Point; path: Point[] }
export interface StateChange { id: number; state: number }
export interface Clock { speed: number; paused: boolean }
export type DevCmd =
  | { c: "speed"; mult: number }
  | { c: "pause" }
  | { c: "spawn"; count: number; dept?: number }
  | { c: "reset"; seed: number };
