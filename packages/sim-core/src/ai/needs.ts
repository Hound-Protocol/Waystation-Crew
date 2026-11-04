import type { World } from "../world";

/** per-tick decay (1 tick = 1 sim second) */
const DECAY = { hunger: 1 / 21_600, energy: 1 / 57_600, social: 1 / 43_200, hygiene: 1 / 57_600, fun: 1 / 36_000 };

export function decayNeeds(world: World): void {
  const c = world.chars;
  for (let i = 0; i < c.count; i++) {
    c.hunger[i] = Math.max(0, c.hunger[i] - DECAY.hunger);
    c.energy[i] = Math.max(0, c.energy[i] - DECAY.energy);
    c.social[i] = Math.max(0, c.social[i] - DECAY.social);
    c.hygiene[i] = Math.max(0, c.hygiene[i] - DECAY.hygiene);
    c.fun[i] = Math.max(0, c.fun[i] - DECAY.fun);
  }
}
