export type RGB = [number, number, number];
/** Every colour the art generators may emit, as r<<16|g<<8|b. */
export const PALETTE = new Set<number>();
const reg = (c: RGB): RGB => { PALETTE.add((c[0] << 16) | (c[1] << 8) | c[2]); return c; };

export const hex = (s: string): RGB => reg([parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]);
export const mul = (c: RGB, f: number): RGB => reg([Math.min(255, Math.floor(c[0] * f)), Math.min(255, Math.floor(c[1] * f)), Math.min(255, Math.floor(c[2] * f))]);

export const OUT = hex("#07080b");
export const CYAN = hex("#4de1ff"), ORANGE = hex("#ff8a2a"), GREENE = hex("#7dffb0"), RED = hex("#ff4040"), LAMP = hex("#ffd866");
export const EMISSIVE_KEYS = new Set([CYAN, ORANGE, GREENE, RED, LAMP, hex("#3fd98a"), hex("#2aa0bd")].map((c) => (c[0] << 16) | (c[1] << 8) | c[2]));
