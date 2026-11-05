import { Img } from "./sprites/image";
import { hex, type RGB } from "./sprites/palette";

/** Status icons above heads: a round pixel bubble with a 7x7 glyph. Which one, how far along, and the little hop when a task starts. */
export interface TaskLike { kind: number; began: number; total: number }

const EAT = 2, SLEEP = 3, RELAX = 4, WORK = 5;
export const ICON_W = 15, ICON_H = 16;
export const DEPT_ICON_KEYS = [0, 1, 2, 3, 4, 5, 6].map((d) => `work:${d}`);
export const ICON_KEYS = ["eat", "sleep", "relax", ...DEPT_ICON_KEYS];

/** The icon for a task, or null when there is nothing to show. Work depends on the character's department (0 Command .. 6 Flight). */
export function iconKey(t: TaskLike, dept: number): string | null {
  switch (t.kind) { case EAT: return "eat"; case SLEEP: return "sleep"; case RELAX: return "relax"; case WORK: return `work:${dept}`; default: return null; }
}

export const GLYPHS: Record<string, string[]> = {
  eat: ["..#.#..", ".#.#...", ".......", "#######", ".#####.", "..###..", "......."],
  sleep: [".#####.", ".....#.", "....#..", "...#...", "..#....", ".#.....", ".#####."],
  relax: [".#...#.", ".#...#.", ".......", "#.....#", ".#...#.", "..###..", "......."],
  "work:0": ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", ".#...#."],
  "work:1": [".#.#.#.", ".#####.", "##...##", "#.....#", "##...##", ".#####.", ".#.#.#."],
  "work:2": ["..###..", "..###..", "#######", "#######", "#######", "..###..", "..###.."],
  "work:3": ["#######", "#######", "#######", "#######", ".#####.", "..###..", "...#..."],
  "work:4": ["#######", "#.....#", "#######", "#..#..#", "#..#..#", "#..#..#", "#######"],
  "work:5": [".#####.", ".#...#.", ".#...##", ".#...##", ".#####.", "..###..", ".#####."],
  "work:6": ["...#...", "...#...", "#######", ".#####.", "...#...", "..###..", "...#..."],
};

const GLYPH_COLOR: Record<string, RGB> = {
  eat: hex("#ffb02e"), sleep: hex("#b58cff"), relax: hex("#7dffb0"),
  "work:0": hex("#ffd866"), "work:1": hex("#ff8a2a"), "work:2": hex("#3fd98a"), "work:3": hex("#ff4040"), "work:4": hex("#4de1ff"), "work:5": hex("#9fb4c4"), "work:6": hex("#c9f6ff"),
};
/** Ring colour per icon, as 0xRRGGBB for the viewer's Graphics. */
export const iconColor = (key: string): number => { const c = GLYPH_COLOR[key] ?? [255, 255, 255]; return (c[0] << 16) | (c[1] << 8) | c[2]; };

const FILL = hex("#0b1420"), RIM = hex("#2a3a4a");

/** A round bubble (15x16 with a little tail) with the glyph centred in it. The progress ring is drawn around it by the layer. */
export function drawIcon(key: string): Img {
  const im = new Img(ICON_W, ICON_H), cx = 7, cy = 7;
  for (let y = 0; y < 14; y++) for (let x = 0; x < ICON_W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 6.7) im.px(x, y, d > 5.6 ? RIM : FILL);
  }
  im.rect(6, 13, 8, 13, FILL); im.rect(6, 14, 8, 14, FILL); im.px(7, 15, FILL); im.px(6, 14, RIM); im.px(8, 14, RIM); im.px(7, 15, RIM);
  const g = GLYPHS[key], c = GLYPH_COLOR[key];
  if (g && c) for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (g[y][x] === "#") im.px(4 + x, 4 + y, c);
  return im;
}

/** 0 while the character is still walking to the task, then 0..1 over the task's length, holding at 1 if it runs a little over. */
export function taskProgress(t: TaskLike, tick: number): number {
  if (t.began < 0 || t.total <= 0) return 0;
  return Math.max(0, Math.min(1, (tick - t.began) / t.total));
}

/** Height of the little hop (in tiles) `age` seconds after a task starts or changes. */
export const hop = (age: number) => (age <= 0 || age >= 0.3 ? 0 : 0.2 * Math.sin((Math.PI * age) / 0.3));
