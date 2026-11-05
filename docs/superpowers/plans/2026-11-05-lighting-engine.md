# Lighting Engine (slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the baked tile lighting with a GPU light engine: point/spot/area/sun lights, full shadows from everything solid, six quantized bands with soft edges at close zoom, lit characters, and a reduced mode for phones.

**Architecture:** The viewer derives a static `LightSource[]` and a solid-tile mask from the station snapshot (pure, tested code). The tile canvas is drawn unlit. One shader pass renders a light buffer for the visible area, marching a ray per fragment to each nearby light through the mask, then a composite step quantizes and multiplies it over the world. A CPU reference (`castLight`) is the oracle the shader is checked against.

**Tech Stack:** TypeScript, PixiJS v8 (custom `Filter`/`Mesh` with GLSL), Vitest, Playwright screenshots for visual checks.

**Spec:** `docs/superpowers/specs/2026-11-05-dynamic-lighting-design.md`

## Global Constraints
- Smooth UI, no pop-ins (CLAUDE.md, spec section 10b): every light change (lamp built, station grown, door opened) eases; first load fades in.
- Six brightness bands: `LEVELS = [0.16, 0.28, 0.44, 0.62, 0.82, 1.0]`; ambient floor `0.5` before shadows, never darker than `0.16`.
- Emissive colours (`EMISSIVE_KEYS`) are never darkened.
- Everything solid blocks light; open doors and windows pass it. Lamps from the sim (`wall:light` deco) are lights like any other.
- TDD; run `pnpm test` and `pnpm typecheck` before each commit. Desktop first; reduced mode caps lights at 16 and drops shadow rays to 8 steps.
- Lights are not sent over the wire: derived in the viewer from the snapshot, recomputed when `stationRev` changes.

## Review Focus
- A light inside a closed room must not leak through walls or closed doors (and must pass an open door).
- Station growth mid-session rebuilds lights and mask without a flash (old and new fade).
- A lamp built by Engineering fades in over about 1 s, no pop.
- Zoomed far out (Z4+) the pass costs near nothing: banded, no soft edges, no per-light work beyond the cap.
- Lit characters keep a minimum brightness so they never vanish in the dark.

---

### Task 1: Light sources from the station
**Files:** Create `apps/viewer/src/render/lights/sources.ts`, `sources.test.ts`. Modify `render/sprites/library.ts` (glow table becomes the kinds table; keep `glowOf`).

**Interfaces:**
- Produces: `type LightKind = "point" | "spot" | "area" | "sun"`; `interface LightSource { id: number; kind: LightKind; x: number; y: number; r: number; i: number; c: [number, number, number]; dir?: number; cone?: number; w?: number; h?: number }` (x, y, r in tiles); `deriveLights(inp: BakeInput): LightSource[]`.

- [ ] **Step 1: Tests.** `deriveLights` on a small fixture: a `wall:light` deco at (5,2) yields a point light at (5.5, 3.5-ish tile centre in front of the wall) with `r === 5` and warm colour; a console yields a cool-cyan light; each room yields one ceiling light per 36 floor tiles (a 6x6 room yields 1, 6x12 yields 2); ids are stable between calls on the same input; same input twice returns equal arrays.
- [ ] **Step 2: Run, expect FAIL** (module missing).
- [ ] **Step 3: Implement** `deriveLights` using the kinds table (reuse today's `glowOf` values; convert px radius to tiles by `/16`), room defaults, and today's sparse corridor grid (every 9 tiles on floor styles 0 and 8).
- [ ] **Step 4: Run, expect PASS.** Commit `feat(viewer): derive light sources from the station`.

### Task 2: Solid mask
**Files:** Create `render/lights/occluders.ts`, `occluders.test.ts`.

**Interfaces:**
- Produces: `solidMask(inp: BakeInput, openDoors?: Set<number>): Uint8Array` (one byte per tile, 1 = blocks light; index `y * w + x`).

- [ ] **Step 1: Tests.** Wall, closed door, closed airlock cell and solid furniture (console, table, bed, locker) are 1; floor, plant, floor decals, open door (index in `openDoors`) and `wall:canopy` window cells are 0; void is 1.
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement.** **Step 4: Run, expect PASS.** Commit.

### Task 3: CPU reference light model
**Files:** Create `render/lights/model.ts`, `model.test.ts`.

**Interfaces:**
- Produces: `castLight(mask: Uint8Array, w: number, l: LightSource, px: number, py: number): number` (intensity 0..1 at tile-space point, 0 if the segment to the light crosses a solid tile other than the light's own cell); `falloff(d, r)` = `(1 - d / r) ** 2`; `quantize(v: number, soft: number): number` (six bands; `soft` 0..1 is the edge blend width as a fraction of a band); `softness(scale: number): number` (0 at scale <= 3 px/tile, rising to 1 at >= 48); spot cone and area handled in `castLight`.

- [ ] **Step 1: Tests.** Open line gives `falloff`; a wall between point and target gives 0; a closed room's light is 0 outside and positive through an open door gap; spot outside its cone is 0; `quantize(0.3, 0)` is exactly one of `LEVELS`; with `soft > 0` a value on a band edge lands strictly between the neighbouring levels; `softness(2) === 0`, `softness(48) === 1`, monotonic.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement. Step 4: Run, expect PASS.** Commit.

### Task 4: GPU light pass
**Files:** Create `render/lights/pass.ts`, `render/lights/shader.ts`. Modify `render/tiles.ts` (stop baking light; emit an unlit albedo canvas plus an emissive-mask canvas), `apps/viewer/src/main.ts` (add the pass above the world, below characters' labels and overlays).

**Interfaces:**
- Consumes: `deriveLights`, `solidMask`, `quantize`, `softness`.
- Produces: `class LightPass { constructor(opts: { maxLights: number; rayStepsMax: number }); setStation(inp: BakeInput): void; setOpenDoors(s: Set<number>): void; update(dt: number, cam: Camera, w: number, h: number): void; readonly container: Container }`; debug hook `__wc.lightAt(px, py): number` returning the buffer value at a tile point.

- [ ] **Step 1: Test the pure parts first** (`pass.test.ts`): `pickLights(all, view, cap)` returns at most `cap` lights, only those whose radius touches the view, nearest-to-centre first, and is stable under equal distances.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement `pickLights`.** Run, expect PASS.
- [ ] **Step 4: Implement the shader pass.** Fragment shader: for each uploaded light (uniform array), early-out beyond `r`, march from the fragment toward the light in half-tile steps through the mask texture (nearest filtering), accumulate `falloff * i * colour`; composite: `albedo * quantize(L, soft)` with soft edges from `softness(scale)`, emissive pixels pass through. Use the same constants as `model.ts` (export them, do not duplicate).
- [ ] **Step 5: Parity check.** In the browser harness read back 25 sample points on a fixture station and compare `__wc.lightAt` with `castLight` quantized (tolerance one band at band edges, exact elsewhere); the check is a Playwright script saved as `apps/viewer/e2e/light-parity.mjs` and its result pasted into the commit message.
- [ ] **Step 6: Screenshots** at Z1, Z2 and Z3 of the plaza, a closed room, and a corridor; confirm shadows behind consoles, no leaks through walls, soft edges at Z1 and banded at Z3. Commit `feat(viewer): GPU lighting pass with shadows`.

### Task 5: Smooth changes
**Files:** Modify `render/lights/pass.ts`; test `pass.test.ts`.

**Interfaces:**
- Produces: `class LightFade` per light id: `target(id, i)`, `step(dt)`, `value(id)`; new lights fade from 0 over 1 s, removed lights fade out over 1 s before being dropped; first load fades the whole buffer in over 0.6 s.

- [ ] **Step 1: Tests.** A new id starts at 0 and reaches its intensity in 1 s (within 1%); a removed id is still present at 0.5 s and gone after 1 s; a station rebuild that keeps ids unchanged causes no fade.
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement and use it in `setStation`/`update`. Step 4: Run, expect PASS.** Check on the running viewer that a built lamp fades in and station growth does not flash. Commit.

### Task 6: Lit characters
**Files:** Modify `render/characters.ts`, `render/lights/pass.ts`; test `characters` via a pure helper in `render/lights/model.ts`.

**Interfaces:**
- Produces: `characterLight(mask, w, lights, x, y): number` returning the quantized light at the character's feet, with a floor of `0.38` (the minimum so nobody vanishes); sprites are tinted by it (multiplicative), eased per character.

- [ ] **Step 1: Tests.** Floor of `0.38` in full darkness; equals the quantized level in a bright room; changes smoothly when `step` eases it (no jump larger than 0.1 per frame at 60 fps).
- [ ] **Step 2: Run, expect FAIL. Step 3: Implement and wire the tint in `characters.ts` (sprite layer only). Step 4: PASS.** Screenshot a character crossing a lit and a dark area. Commit.

### Task 7: Budget and reduced mode
**Files:** Create `render/lights/budget.ts`, `budget.test.ts`; modify `main.ts` to pick the budget.

**Interfaces:**
- Produces: `lightBudget(device: { mobile: boolean; scale: number }): { maxLights: number; rayStepsMax: number; shadows: boolean }`: desktop 48 lights / 24 steps; mobile 16 / 8; zoom below Z4 (scale < 5 px/tile) turns shadows off and `maxLights` to 8.

- [ ] **Step 1: Tests** for the three cases above. **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Measure.** Record frame time of the light pass at Z1/Z3/Z4 on the full 60-crew station in the commit message; if the pass costs over 3 ms at Z1 reduce `rayStepsMax` and note it. Commit.

### Task 8: Remove the baked lighting
**Files:** Delete `bakeLighting` from `render/light.ts` and its tests (keep `LEVELS`, moved into `lights/model.ts`); update `tiles.ts` and docs.

- [ ] **Step 1:** Grep for remaining users of `bakeLighting`/old `Light`; none may remain.
- [ ] **Step 2:** Full `pnpm test`, `pnpm typecheck`, screenshots of the whole station at Z1 through Z4 compared against the pre-change look (no pop-ins, no dark rooms).
- [ ] **Step 3:** Update the spec's slice list (slice 1 as built) and commit `refactor(viewer): drop baked lighting`; deploy.
