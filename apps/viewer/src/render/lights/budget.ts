import type { LightBudget } from "./pass";

/** Light-pass cost limits per device and zoom. Far out (under 5 px per tile, the planet zoom levels) lights are tiny and shadows invisible, so they are skipped. */
export function lightBudget(d: { mobile: boolean; scale: number }): LightBudget {
  if (d.scale < 5) return { maxLights: 8, steps: 1, shadows: false };
  return d.mobile ? { maxLights: 16, steps: 8, shadows: true } : { maxLights: 48, steps: 24, shadows: true };
}
