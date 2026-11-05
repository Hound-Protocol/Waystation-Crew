import { describe, it, expect } from "vitest";
import { Department, TileKind } from "@wc/sim-core";
import { PALETTE, OUT, hex } from "./palette";
import { drawHuman, drawTile } from "./index";
import { buildAtlas } from "./atlas";

const px = (img: { data: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * 16 + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
};
const key = (p: { r: number; g: number; b: number }) => (p.r << 16) | (p.g << 8) | p.b;
const OUTK = (() => { const o = hex("#07080b"); return (o[0] << 16) | (o[1] << 8) | o[2]; })();

describe("sprites", () => {
  const people = [Department.Command, Department.Engineering, Department.Medical, Department.Security, Department.Supply, Department.Service]
    .map((dept) => drawHuman({ skin: "#b57a52", hair: "#1d1710", dept }));

  it("is exactly 16x16 RGBA", () => {
    for (const s of people) { expect(s.w).toBe(16); expect(s.h).toBe(16); expect(s.data.length).toBe(16 * 16 * 4); }
  });
  it("outlines every silhouette edge with #07080b", () => {
    for (const s of people) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (px(s, x, y).a !== 0) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx > 15 || ny > 15) continue;
          const n = px(s, nx, ny);
          if (n.a) expect(key(n), `edge at ${x},${y}`).toBe(OUTK);
        }
      }
    }
  });
  it("only uses palette colours", () => {
    const tiles = [TileKind.Floor, TileKind.Wall, TileKind.Door, TileKind.Bed, TileKind.Console, TileKind.Table, TileKind.Plant, TileKind.Airlock].map(drawTile);
    for (const s of [...people, ...tiles]) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const p = px(s, x, y); if (p.a) expect(PALETTE.has(key(p)), `#${key(p).toString(16)}`).toBe(true);
    }
    expect(OUT).toBeTruthy();
  });
  it("different departments look different", () => {
    const k = people.map((s) => Array.from(s.data).join(","));
    expect(new Set(k).size).toBe(6);
  });
});

describe("atlas", () => {
  it("has frames for every tile kind and every department suit", () => {
    const a = buildAtlas();
    for (let k = 0; k <= 8; k++) expect(a.frames[`tile:${k}`], `tile ${k}`).toBeTruthy();
    for (let d = 0; d < 6; d++) for (let v = 0; v < 4; v++) expect(a.frames[`char:${d}:${v}`], `char ${d}:${v}`).toBeTruthy();
    expect(a.data.length).toBe(a.width * a.height * 4);
  });
});

describe("cargo slot markers", () => {
  // Plain closed squares: orientation-proof (the ship blueprint is rotated when stamped), and never read as hooked corner shapes.
  const names = ["floor:slot", "floor:slot-ml", "floor:slot-mr", "floor:slot-tl", "floor:slot-tr", "floor:slot-bl", "floor:slot-br"];
  it("are all the same closed square outline with an empty middle", async () => {
    const { DECALS } = await import("./mounts");
    const ref = DECALS["floor:slot"]();
    for (const n of names) {
      const im = DECALS[n]();
      expect(Array.from(im.data), n).toEqual(Array.from(ref.data));
      for (let i = 2; i <= 13; i++) for (const [x, y] of [[i, 2], [i, 13], [2, i], [13, i]]) expect(px(im, x, y).a, `${n} edge ${x},${y}`).toBe(255);
      for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) expect(px(im, x, y).a, `${n} middle ${x},${y}`).toBe(0);
    }
  });
});

describe("hazard stripe tiles", () => {
  it("are full square frames whose diagonal stripes line up across neighbouring tiles (period divides 16)", async () => {
    const { DECALS } = await import("./mounts");
    const im = DECALS["floor:hazard"](), Y = key({ r: 0xb8, g: 0x94, b: 0x1f }), K = key({ r: 0x15, g: 0x17, b: 0x1b });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const p = px(im, x, y), ring = x < 2 || x > 13 || y < 2 || y > 13;
      expect(p.a, `${x},${y}`).toBe(ring ? 255 : 0);
      if (ring) expect(key(p), `${x},${y}`).toBe((x + y) % 8 < 4 ? Y : K);
    }
  });
});

describe("rear ramp tile", () => {
  it("is one diagonal hazard pattern with no tile borders: colour depends only on (x + y) mod 8, so every tile joins its neighbours seamlessly", async () => {
    const { DECALS } = await import("./mounts");
    const im = DECALS["floor:ramp"](), A = key({ r: 0xc8, g: 0x60, b: 0x1a }), B = key({ r: 0x24, g: 0x1f, b: 0x1b });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) expect(key(px(im, x, y)), `${x},${y}`).toBe((x + y) % 8 < 4 ? A : B);
  });
});
