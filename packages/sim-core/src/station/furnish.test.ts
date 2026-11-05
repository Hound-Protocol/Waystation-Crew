import { describe, it, expect } from "vitest";
import { buildStarterStation } from "./layout";
import { TileKind, isWalkable } from "./tilemap";

const D = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // facing 0=N 1=E 2=S 3=W

describe("furnishing: every item faces a side, workstations get seats", () => {
  const st = buildStarterStation(1);
  const seated = st.furniture.filter((f) => (f.kind === TileKind.Console || f.kind === TileKind.Table) && f.style !== "console:kiosk");
  it("every furniture piece has a facing 0..3", () => {
    for (const f of st.furniture) expect([0, 1, 2, 3]).toContain(f.facing);
  });
  it("a console or table faces an open walkable tile, and that tile holds a chair facing back at it", () => {
    expect(seated.length).toBeGreaterThan(20);
    for (const f of seated) {
      const [dx, dy] = D[f.facing!], sx = f.x + dx, sy = f.y + dy;
      expect(isWalkable(st.map.get(sx, sy))).toBe(true);
      const chair = st.deco!.find((d) => d.x === sx && d.y === sy && d.sprite.startsWith("chair:"));
      expect(chair, `chair for ${f.style}@${f.x},${f.y}`).toBeTruthy();
      expect(chair!.sprite).toBe(`chair:${(f.facing! + 2) % 4}`);
    }
  });
  it("beds put their head against a wall when one is adjacent", () => {
    const beds = st.furniture.filter((f) => f.kind === TileKind.Bed);
    let withWall = 0, ok = 0;
    for (const f of beds) {
      const [dx, dy] = D[f.facing!], hx = f.x - dx, hy = f.y - dy; // head is opposite the foot (facing)
      if (D.some(([ax, ay]) => st.map.get(f.x + ax, f.y + ay) === TileKind.Wall)) { withWall++; if (st.map.get(hx, hy) === TileKind.Wall || st.map.get(hx, hy) === TileKind.Bed) ok++; }
    }
    expect(ok / Math.max(1, withWall)).toBeGreaterThan(0.7);
  });
  it("chairs never sit on blocked tiles or on doors", () => {
    for (const d of st.deco!.filter((d) => d.sprite.startsWith("chair:"))) {
      expect(st.map.get(d.x, d.y)).toBe(TileKind.Floor);
    }
  });
});
