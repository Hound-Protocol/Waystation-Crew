import type { LightBudget } from "./pass";

const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** Light-pass cost limits per device and zoom. The light count is fixed (a count switch would pop); shadow ray steps ease from full at 8 px per tile down to none at 5, where lights are tiny and shadows invisible. */
export function lightBudget(d: { mobile: boolean; scale: number }): LightBudget {
  const full = d.mobile ? 8 : 24, steps = d.scale < 5 ? 1 : Math.max(1, Math.round(1 + (full - 1) * smooth((d.scale - 5) / 3)));
  return { maxLights: d.mobile ? 16 : 48, steps, shadows: steps > 1 };
}
