import { describe, it, expect } from "vitest";
import { GLYPHS, iconKey, drawIcon, ICON_W, ICON_H, taskProgress, hop, ICON_KEYS } from "./icons";

const EAT = 2, SLEEP = 3, RELAX = 4, WORK = 5;

describe("iconKey", () => {
  it("maps tasks to icons, work by department, and nothing for no task", () => {
    expect(iconKey({ kind: 0, began: -1, total: 0 }, 1)).toBeNull();
    expect(iconKey({ kind: EAT, began: -1, total: 0 }, 1)).toBe("eat");
    expect(iconKey({ kind: SLEEP, began: 5, total: 9 }, 1)).toBe("sleep");
    expect(iconKey({ kind: RELAX, began: 5, total: 9 }, 1)).toBe("relax");
    for (let d = 0; d < 7; d++) expect(iconKey({ kind: WORK, began: 0, total: 5 }, d)).toBe(`work:${d}`);
    expect(iconKey({ kind: 6, began: 0, total: 240 }, 5)).toBe("build");
  });
});

describe("glyphs", () => {
  it("has a 7x7 glyph for every key, all different, none empty", () => {
    expect(ICON_KEYS).toHaveLength(11);
    const seen = new Set<string>();
    for (const k of ICON_KEYS) {
      const g = GLYPHS[k]; expect(g, k).toBeDefined();
      expect(g).toHaveLength(7); for (const row of g) expect(row, k).toHaveLength(7);
      expect(g.join("").includes("#"), k).toBe(true);
      seen.add(g.join("/"));
    }
    expect(seen.size).toBe(ICON_KEYS.length);
  });
  it("draws a bubble with the glyph inside, a transparent corner and an opaque centre", () => {
    for (const k of ICON_KEYS) {
      const im = drawIcon(k);
      expect([im.w, im.h]).toEqual([ICON_W, ICON_H]);
      expect(im.alpha(0, 0)).toBe(0);
      expect(im.alpha(ICON_W >> 1, 7)).toBe(255);
    }
  });
});

describe("taskProgress", () => {
  it("is 0 while walking there, then fills from the start tick to the end, and holds at 1", () => {
    expect(taskProgress({ kind: WORK, began: -1, total: 0 }, 100)).toBe(0);
    expect(taskProgress({ kind: WORK, began: 100, total: 200 }, 100)).toBe(0);
    expect(taskProgress({ kind: WORK, began: 100, total: 200 }, 150)).toBeCloseTo(0.25, 9);
    expect(taskProgress({ kind: WORK, began: 100, total: 200 }, 400)).toBe(1);
    expect(taskProgress({ kind: WORK, began: 100, total: 200 }, 50)).toBe(0);
  });
});

describe("hop", () => {
  it("is a short hop when a task starts: 0 at the start, a peak around the middle, 0 after 0.3 s", () => {
    expect(hop(0)).toBe(0); expect(hop(0.15)).toBeCloseTo(0.2, 6); expect(hop(0.3)).toBeCloseTo(0, 6); expect(hop(2)).toBe(0);
  });
});
