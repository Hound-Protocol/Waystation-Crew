import { Canvas, Shapes, type Blueprint } from "./blueprint";
import type { Rng } from "../rng";

export type ModuleKind = "arrivals" | "command" | "medical" | "security" | "engineering" | "supply" | "galley" | "habitation";
export const MODULE_KINDS: ModuleKind[] = ["arrivals", "command", "medical", "security", "engineering", "supply", "galley", "habitation"];

/**
 * The room kit. Each room type is a generator: sizes and layout vary with the rng, so every room comes out unique.
 * Rooms are boxy (rectangles, chamfered corners). The door is always bottom centre and its approach is kept clear.
 */
export interface RoomType { id: string; kind: ModuleKind; make(rng: Rng): Blueprint }

const R = (rng: Rng, a: number, b: number) => rng.int(a, b);
const rect = (w: number, h: number) => new Canvas(w, h, () => true);
const box = (rng: Rng, w: number, h: number) => (rng.int(0, 2) === 0 ? rect(w, h) : Shapes.octagon(w, h, 2));

export const ROOM_TYPES: RoomType[] = [
  // ---- arrivals ----
  { id: "arrivals_hall", kind: "arrivals", make: (r) => { const w = R(r, 15, 19), h = R(r, 9, 11), c = box(r, w, h).airlocks(3, w - 4).hline(2, w - 3, 2, "k", 4).hline(2, w - 3, 5, "Q", 4).put(w >> 1, 4, "*").sym("N", [0, 1]).sym("P", [1, h - 3]).sym("V", [0, h - 4]); return c.done(); } },
  // ---- habitation ----
  { id: "cabin", kind: "habitation", make: (r) => { const w = R(r, 5, 7), h = R(r, 5, 6), c = box(r, w, h).hline(1, w - 2, 1, "B", 2).put(0, 0, "L").put(w - 1, 0, "P"); if (r.int(0, 1)) c.put(w - 1, 3, "N"); return c.done(); } },
  { id: "bunkroom", kind: "habitation", make: (r) => { const w = R(r, 9, 11), h = R(r, 7, 9), c = box(r, w, h).hline(1, w - 2, 1, "B", 2).hline(1, w - 2, 3, "B", 2); if (h >= 8) c.hline(1, w - 2, 5, "B", 2); c.put(0, 0, "L").put(w - 1, 0, "L").put(0, h - 2, "P"); return c.done(); } },
  { id: "lounge", kind: "habitation", make: (r) => { const w = R(r, 7, 9), h = R(r, 6, 7), c = box(r, w, h).hline(1, w - 2, 0, "Q", 3).put(w >> 1, 2, "t").sym("P", [0, 1]).sym("Y", [1, h - 3]).put(0, 3, "V"); return c.done(); } },
  // ---- medical ----
  { id: "ward", kind: "medical", make: (r) => { const w = R(r, 9, 11), h = R(r, 7, 8), c = box(r, w, h).hline(1, w - 2, 1, "B", 2).hline(1, w - 2, 3, "B", 2).sym("i", [0, 2]).put(w - 1, 5, "m").put(0, 5, "a").put(0, 0, "N"); return c.done(); } },
  { id: "surgery", kind: "medical", make: (r) => { const w = R(r, 7, 9), h = R(r, 6, 7), c = box(r, w, h).put(w >> 1, 2, "u").sym("m", [0, 0]).sym("i", [2, 2]).put(w >> 1, 0, "M").put(0, 3, "a").put(w - 1, 3, "F"); return c.done(); } },
  { id: "pharmacy", kind: "medical", make: (r) => { const w = R(r, 6, 8), h = R(r, 5, 6), c = box(r, w, h).hline(0, w - 1, 0, "a", 2).put(w - 2, 2, "m").put(1, 2, "T").put(0, 4, "F"); return c.done(); } },
  { id: "reception_med", kind: "medical", make: (r) => { const w = R(r, 7, 9), h = R(r, 5, 6), c = box(r, w, h).hline(1, w - 2, 1, "m", 3).put(w >> 1, 2, "T").sym("P", [0, 0]).put(0, 3, "d"); return c.done(); } },
  // ---- security ----
  { id: "sec_office", kind: "security", make: (r) => { const w = R(r, 8, 10), h = R(r, 6, 7), c = box(r, w, h).hline(1, w - 2, 0, "s", 3).put(w >> 1, 2, "T").sym("L", [0, 2]).put(w - 1, 4, "q"); return c.done(); } },
  { id: "brig", kind: "security", make: (r) => { const w = R(r, 9, 11), h = R(r, 7, 8), c = box(r, w, h).hline(2, w - 3, 1, "J", 2).hline(2, w - 3, 2, "B", 2).hline(2, w - 3, 4, "J", 2).hline(2, w - 3, 5, "B", 2).put(0, 3, "s").put(w - 1, 3, "s"); return c.done(); } },
  { id: "armory", kind: "security", make: (r) => { const w = R(r, 6, 8), h = R(r, 6, 7), c = box(r, w, h).hline(0, w - 1, 0, "R", 2).vline(0, 2, 3, "w").put(w - 1, 2, "s").put(w - 1, 4, "L"); return c.done(); } },
  // ---- command ----
  { id: "bridge", kind: "command", make: (r) => { const w = R(r, 11, 13), h = R(r, 8, 9), c = box(r, w, h).hline(1, w - 2, 0, "C", 2).put(w >> 1, 1, "n").put(w >> 1, 4, "O").sym("C", [1, 3]).sym("P", [0, h - 3]); return c.done(); } },
  { id: "office_cmd", kind: "command", make: (r) => { const w = R(r, 7, 9), h = R(r, 6, 7), c = box(r, w, h).hline(1, w - 2, 0, "C", 3).put(w >> 1, 2, "T").sym("P", [0, 2]).put(w - 1, 4, "Y"); return c.done(); } },
  { id: "comms", kind: "command", make: (r) => { const w = R(r, 6, 8), h = R(r, 5, 6), c = box(r, w, h).hline(0, w - 1, 0, "C", 2).put(w >> 1, 2, "T").put(0, 3, "S"); return c.done(); } },
  // ---- engineering ----
  { id: "engine", kind: "engineering", make: (r) => { const w = R(r, 9, 11), h = R(r, 8, 9), c = box(r, w, h).put(w >> 1, 2, "E").sym("G", [1, 1]).sym("U", [0, 3]).hline(1, w - 2, h - 4, "e", 3).sym("I", [0, 5]); return c.done(); } },
  { id: "workshop", kind: "engineering", make: (r) => { const w = R(r, 8, 10), h = R(r, 6, 7), c = box(r, w, h).hline(0, w - 1, 0, "W", 2).sym("l", [1, 2]).sym("f", [0, 3]).put(w >> 1, 2, "p").put((w >> 1) + 2, 4, "e").put((w >> 1) - 2, 4, "e"); return c.done(); } },
  { id: "atmos", kind: "engineering", make: (r) => { const w = R(r, 6, 8), h = R(r, 6, 7), c = box(r, w, h).vline(0, 0, 3, "I", 2).sym("v", [1, 1]).put(w - 1, 3, "$").put(w >> 1, 2, "e"); return c.done(); } },
  // ---- supply ----
  { id: "cargo_bay", kind: "supply", make: (r) => { const w = R(r, 11, 13), h = R(r, 8, 9), c = box(r, w, h).hline(1, w - 2, 1, "X", 3).hline(1, w - 2, 4, "X", 4).put(w - 1, 2, "g").put(0, 2, "k").put(w - 1, 5, "C").put(0, 0, "S"); return c.done(); } },
  { id: "storage", kind: "supply", make: (r) => { const w = R(r, 7, 9), h = R(r, 6, 7), c = box(r, w, h).hline(0, w - 1, 0, "S", 2).vline(0, 2, 3, "X").put(w - 1, 3, "C").put(w >> 1, 2, "X"); return c.done(); } },
  { id: "cargo_office", kind: "supply", make: (r) => { const w = R(r, 6, 8), h = R(r, 5, 6), c = box(r, w, h).hline(0, w - 1, 0, "C", 2).put(w >> 1, 2, "T").put(0, 3, "j").put(w - 1, 3, "N"); return c.done(); } },
  // ---- galley ----
  { id: "mess", kind: "galley", make: (r) => { const w = R(r, 11, 13), h = R(r, 8, 9), c = box(r, w, h).hline(1, w - 2, 1, "T", 3).hline(1, w - 2, 4, "T", 3).put(0, 6, "V").put(w - 1, 6, "%").put(w - 1, 0, "P").put(0, 0, "P"); return c.done(); } },
  { id: "kitchen", kind: "galley", make: (r) => { const w = R(r, 8, 10), h = R(r, 6, 7), c = box(r, w, h).hline(0, w - 1, 0, "&", 3).hline(1, w - 2, 1, "K", 3).put(w >> 1, 3, "T").put(0, 3, "F").put(w - 1, 3, "F"); return c.done(); } },
  { id: "pantry", kind: "galley", make: (r) => { const w = R(r, 6, 8), h = R(r, 5, 6), c = box(r, w, h).hline(0, w - 1, 0, "F", 2).put(w >> 1, 2, "T").put(0, 3, "S").put(w - 1, 3, "%"); return c.done(); } },
];

/** Wing recipes: the order rooms are added to a department as it grows (cycled). */
export const WINGS: Record<ModuleKind, string[]> = {
  arrivals: ["arrivals_hall"],
  command: ["bridge", "office_cmd", "comms", "office_cmd"],
  medical: ["ward", "surgery", "pharmacy", "ward", "reception_med"],
  security: ["sec_office", "brig", "armory", "sec_office"],
  engineering: ["engine", "workshop", "atmos", "workshop"],
  supply: ["cargo_bay", "storage", "cargo_office", "storage"],
  galley: ["mess", "kitchen", "pantry", "mess"],
  habitation: ["bunkroom", "bunkroom", "cabin", "bunkroom", "lounge", "bunkroom"],
};

export const typeOf = (id: string): RoomType => { const t = ROOM_TYPES.find((x) => x.id === id); if (!t) throw new Error(`unknown room type ${id}`); return t; };
export const typeIndex = (id: string): number => ROOM_TYPES.findIndex((x) => x.id === id);
export const nextInWing = (kind: ModuleKind, built: number): string => WINGS[kind][built % WINGS[kind].length];
