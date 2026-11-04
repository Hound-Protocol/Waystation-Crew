# Waystation Crew — Plan 1: Foundation and First Playable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable static site where ~60 autonomous characters live on a small starter station (needs, jobs, shifts, pathing), viewable with pan/zoom and six zoom levels, with a dev panel, running entirely in the browser (sim in a Web Worker).

**Architecture:** pnpm TypeScript monorepo. `sim-core` is a pure, deterministic, headless simulation (seeded RNG, 1 tick/s, typed-array entities, utility AI). `protocol` defines the snapshot/delta messages. The viewer (Vite + PixiJS) talks to the sim through a `SimTransport` interface; Plan 1 implements only the in-browser Web Worker transport. Server, Instagram, economy, medical, security and incidents are later plans.

**Tech Stack:** TypeScript 5, pnpm workspaces, Vitest, Vite, PixiJS v8, GitHub Actions, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-11-04-space-station-design.md`

## Plan Roadmap (not in this plan)
- Plan 2: Station self-assessment and expansion (audit loop, planner, construction, maintenance)
- Plan 3: Social layer (relationships, encounters, memory) and sound
- Plan 4: Medical, security, incident director, antagonists
- Plan 5: Economy (SC, payroll, shops, outfits)
- Plan 6: Node server, SQLite, WebSocket, Instagram claim flow, accounts, multi-station

## Global Constraints
- Station product and in-world name: `Waystation Crew`, defined once in `packages/protocol/src/config.ts` as `STATION_NAME`.
- Sim rate: 1 tick per second of sim time; deterministic for a given seed; no `Math.random` or `Date.now` inside `sim-core`.
- Decisions staggered: each character re-decides every 5–30 sim seconds, not every tick.
- Art grid: 16x16 tiles, top-down 3/4 view, nearest-neighbor scaling, 1px outline `#07080b`.
- Palette: cyan `#4de1ff`, orange `#ff8a2a`, green `#7dffb0`, red `#ff4040`, lamp `#ffd866`; emissive-only bright colors, desaturated cool metals elsewhere.
- Render target 60 FPS (30 FPS fallback), interpolation every frame, server/sim sends paths not positions.
- Six zoom levels: Z1 ~2px/tile dots, Z2 4px 2x3 columns, Z3 8px silhouettes, Z4 16px sprites, Z5 32px, Z6 64px.
- Capacity target: 100 human characters; bots/AI crew not counted. Characters cannot die.
- Departments: Command, Engineering, Medical, Security, Supply, Service. Ranks: Trainee, Technician, Specialist, Senior, Chief.
- Standalone dev mode must work as a static site with no backend.

## Review Focus
1. Same seed, same tick count, different wall-clock speed or tab throttling: identical world state.
2. Path blocked (door closed or tile removed) mid-walk: character re-paths or waits, never freezes forever or walks through walls.
3. More characters than beds, seats or jobs: extras idle or wander gracefully, no exception, no duplicate occupancy.
4. Tab hidden for minutes then shown: viewer catches up without a flood of animation or memory growth.
5. Zero characters, one character, and 10,000 characters all render and tick without errors.

---

## File Structure
- `packages/protocol/src/{config,messages,types}.ts` — shared constants and message types
- `packages/sim-core/src/{rng,world,ecs,tick}.ts` — deterministic core
- `packages/sim-core/src/station/{tilemap,nav,starter}.ts` — tiles, A*, starter layout
- `packages/sim-core/src/ai/{needs,affordances,decide,schedule}.ts` — utility AI
- `packages/sim-core/src/org/{departments,ranks,jobs}.ts` — org and job board
- `apps/viewer/src/{main,transport/worker,render/*,ui/*}.ts` — Pixi viewer, dev panel
- `apps/viewer/src/sim.worker.ts` — hosts sim-core
- `tools/bench/agents.bench.ts` — 10k-agent benchmark

---

### Task 1: Monorepo scaffold, CI, config

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.github/workflows/ci.yml`, `README.md`, `.gitignore`
- Create: `packages/protocol/{package.json,src/config.ts}`, `packages/sim-core/package.json`, `apps/viewer/package.json`
- Test: `packages/protocol/src/config.test.ts`

**Interfaces:**
- Produces: `export const STATION_NAME = "Waystation Crew"`, `export const TICK_SECONDS = 1`, `export const HUMAN_CAPACITY = 100` in `config.ts`.

- [ ] **Step 1: Failing test** `config.test.ts`: `expect(STATION_NAME).toBe("Waystation Crew")`, `expect(HUMAN_CAPACITY).toBe(100)`.
- [ ] **Step 2:** Run `pnpm -r test` → FAIL (no config).
- [ ] **Step 3:** Scaffold workspace (strict TS, ESM, Vitest per package); implement `config.ts`; CI workflow runs `pnpm i --frozen-lockfile`, `pnpm -r typecheck`, `pnpm -r test` on push and PR.
- [ ] **Step 4:** `pnpm -r test` → PASS.
- [ ] **Step 5:** Commit `chore: scaffold monorepo and CI`.

### Task 2: Deterministic RNG and world tick

**Files:**
- Create: `packages/sim-core/src/{rng,world,tick}.ts`
- Test: `packages/sim-core/src/world.test.ts`

**Interfaces:**
- Produces: `createRng(seed: number): Rng` with `next(): number` in [0,1), `int(min: number, max: number): number`, `fork(label: string): Rng`; `createWorld(seed: number): World` with `world.tick: number`, `world.rng: Rng`; `step(world: World): void` advances one sim second; `stepMany(world: World, n: number): void`.

- [ ] **Step 1: Failing tests:** (a) two RNGs with seed 42 produce identical first 1000 values; (b) `fork("a")` and `fork("b")` differ but each is reproducible; (c) two worlds, same seed, `stepMany(…, 5000)` give equal `hashWorld(world)`; (d) different seeds differ.
- [ ] **Step 2:** Run `pnpm --filter sim-core test` → FAIL.
- [ ] **Step 3:** Implement mulberry32 RNG (fork = hash of seed+label); `hashWorld` is an FNV-1a hash over tick and entity arrays (export for tests).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): deterministic rng and tick`.

### Task 3: Typed-array entity store

**Files:**
- Create: `packages/sim-core/src/ecs.ts`
- Test: `packages/sim-core/src/ecs.test.ts`

**Interfaces:**
- Consumes: `World` from Task 2.
- Produces: `addCharacter(world: World, init: {name: string; dept: Department; rank: Rank; x: number; y: number}): number` (returns id); `world.chars` with `Float32Array x,y`, `Uint8Array dept,rank,state`, `Float32Array[]`-backed needs `hunger,energy,social,hygiene,fun` (0–1), `name(id): string`, `count: number`, capacity grows by doubling.

- [ ] **Step 1: Failing tests:** adding 10,000 characters keeps ids unique and sequential; arrays grow without losing earlier data; `hashWorld` includes characters.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement store (struct-of-arrays, growth by doubling). **Step 4:** PASS. **Step 5:** Commit `feat(sim): typed-array character store`.

### Task 4: Tilemap, nav graph, starter station

**Files:**
- Create: `packages/sim-core/src/station/{tilemap,nav,starter}.ts`
- Test: `packages/sim-core/src/station/nav.test.ts`

**Interfaces:**
- Produces: `TileKind` enum (Floor, Wall, Door, Bed, Console, Table, Plant, Airlock…); `Tilemap {w,h,tiles: Uint8Array}` with `get/set`; `Furniture {kind, x, y, roomId}`; `findPath(map: Tilemap, from: Point, to: Point): Point[] | null` (A*, 4-neighbour, doors passable, walls and furniture blockers not); `buildStarterStation(): {map: Tilemap; furniture: Furniture[]; rooms: Room[]}` with rooms: Bridge, Engineering, Medbay, Security, Cargo, Galley/Mess, Habitation (≥100 beds), Airlock/Docking.

- [ ] **Step 1: Failing tests:** path across open floor is shortest; path through a door succeeds; path to enclosed tile returns `null`; every room reachable from Docking in the starter station; Habitation has ≥100 beds.
- [ ] **Step 2:** FAIL. **Step 3:** Implement A* with binary heap; starter layout authored as ASCII in `starter.ts` and parsed. **Step 4:** PASS. **Step 5:** Commit `feat(sim): tilemap, A* and starter station`.

### Task 5: Needs and affordance-based decisions

**Files:**
- Create: `packages/sim-core/src/ai/{needs,affordances,decide}.ts`
- Test: `packages/sim-core/src/ai/decide.test.ts`

**Interfaces:**
- Consumes: `World`, `Furniture`, `findPath`.
- Produces: `decayNeeds(world: World): void` (per tick); `Affordance {kind: ActionKind; furnitureId: number; satisfies: NeedKey; amountPerTick: number; durationTicks: number}`; `decide(world: World, id: number): Action` returns the best-scored action (urgency × distance penalty + seeded noise); `Action {kind, targetFurniture, path: Point[], ticksLeft}`; `stepAI(world: World): void` runs only characters whose `nextDecideTick <= world.tick`, then sets `nextDecideTick = tick + rng.int(5,30)`.

- [ ] **Step 1: Failing tests:** hungry character (hunger<0.2) selects a Table/Galley action; tired selects Bed; occupied furniture is skipped (no two characters on one bed); with zero furniture the character idles without throwing; staggering: over 30 ticks with 300 characters, no tick decides more than 60.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Reservation map `furnitureId → charId` released on action end. **Step 4:** PASS. **Step 5:** Commit `feat(ai): needs and affordance decisions`.

### Task 6: Movement along paths with re-pathing

**Files:**
- Create: `packages/sim-core/src/ai/move.ts`
- Test: `packages/sim-core/src/ai/move.test.ts`

**Interfaces:**
- Produces: `stepMovement(world: World): void` — moves each walking character one tile per tick along `path`; if next tile is blocked, re-run `findPath`; if still null, cancel action and release reservation; `world.events` receives `{type:'moved', id, from, to}` per move for delta output.

- [ ] **Step 1: Failing tests:** character reaches target in `path.length` ticks; tile blocked mid-walk causes re-path to alternate route; fully blocked target cancels action within 1 tick and frees the reservation (Review Focus #2).
- [ ] **Steps 2–5:** FAIL, implement, PASS, commit `feat(sim): movement and re-pathing`.

### Task 7: Departments, ranks, job board, shifts

**Files:**
- Create: `packages/sim-core/src/org/{departments,ranks,jobs}.ts`, `packages/sim-core/src/ai/schedule.ts`
- Test: `packages/sim-core/src/org/jobs.test.ts`

**Interfaces:**
- Produces: `Department`, `Rank` enums per Global Constraints; `JobPost {id, dept, minRank, workstationFurnitureId, shift: 'day'|'swing'|'night'}`; `assignJobs(world: World, posts: JobPost[]): void` (new arrivals fill posts of their department, else Service); `shiftOf(tick: number): Shift` (8 sim-hours each; 1 sim-day = 86,400 ticks configurable via `SIM_DAY_TICKS`); on-shift characters add a `work` affordance at their workstation with higher urgency than fun/social, below hunger/energy critical.

- [ ] **Step 1: Failing tests:** assignments never exceed one character per post; extra characters get Service/unassigned without error (Review Focus #3); during their shift, a fed and rested character walks to its workstation; off shift it does not.
- [ ] **Steps 2–5:** FAIL, implement, PASS, commit `feat(sim): jobs, ranks and shifts`.

### Task 8: Protocol and Web Worker transport

**Files:**
- Create: `packages/protocol/src/{messages,types}.ts`, `apps/viewer/src/sim.worker.ts`, `apps/viewer/src/transport/worker.ts`
- Test: `packages/protocol/src/messages.test.ts`, `apps/viewer/src/transport/worker.test.ts`

**Interfaces:**
- Produces: `ClientMsg = {t:'subscribe', viewport} | {t:'devCmd', cmd: DevCmd}`; `ServerMsg = {t:'snapshot', tick, map, chars: CharSnap[]} | {t:'delta', tick, moves: Move[], states: StateChange[]}`; `interface SimTransport { send(m: ClientMsg): void; onMessage(cb: (m: ServerMsg) => void): void; close(): void }`; `createWorkerTransport(): SimTransport`; `DevCmd = {c:'speed', mult: number} | {c:'pause'} | {c:'spawn', count: number, dept?: Department} | {c:'reset', seed: number}`.
- Moves carry full paths + start tick, not per-tick positions.

- [ ] **Step 1: Failing tests:** round-trip encode/decode of each message; transport test with a fake worker: `subscribe` yields a `snapshot` then `delta`s; hidden-tab catch-up: simulate 300 s gap → worker advances in a bounded batch, sends one coalesced delta (Review Focus #4).
- [ ] **Steps 2–5:** FAIL, implement (sim loop uses accumulated real time ÷ `TICK_SECONDS` with a cap of 600 ticks per catch-up), PASS, commit `feat: protocol and worker transport`.

### Task 9: Pixi viewer — tiles, characters, camera, six zoom levels

**Files:**
- Create: `apps/viewer/index.html`, `apps/viewer/src/main.ts`, `apps/viewer/src/render/{camera,tiles,characters,lod,interp}.ts`
- Test: `apps/viewer/src/render/lod.test.ts`, `apps/viewer/src/render/interp.test.ts`

**Interfaces:**
- Produces: `zoomLevel(scale: number): 1|2|3|4|5|6` (thresholds from Global Constraints); `lodStyle(level): 'dot'|'column'|'silhouette'|'sprite'`; `interpolatePath(path: Point[], startTick: number, nowTicks: number): {x: number; y: number; dir: Dir}` (clamped, fractional ticks for smooth 60 FPS); `Camera {pan(dx,dy), zoomAt(px,py,factor), clamp(bounds)}`.

- [ ] **Step 1: Failing tests:** `zoomLevel` boundary values map to the correct level; `interpolatePath` at fractional tick returns midpoint; past end returns the last point; empty path returns start.
- [ ] **Step 2:** FAIL. **Step 3:** Implement renderer: tile layer cached to a texture, `ParticleContainer`/instanced batching for Z1–Z3, nearest-neighbor scaling, crossfade ~120 ms on level change, lighting quantized to 6 steps via a simple shader. **Step 4:** unit tests PASS; manual check `pnpm --filter viewer dev` shows moving dots at Z1 and silhouettes at Z3. **Step 5:** Commit `feat(viewer): tiles, characters, camera, LOD`.

### Task 10: Code-generated sprites (art bible)

**Files:**
- Create: `apps/viewer/src/render/sprites/{palette,human,tiles}.ts`
- Test: `apps/viewer/src/render/sprites/sprites.test.ts`

**Interfaces:**
- Produces: `PALETTE` (hex values from Global Constraints plus 3-tone metal, skin, hair ramps); `drawHuman(opts: {skin, hair, suit, dept}): RGBAImage` (16x16, head 6x5, torso 4 wide, 1px arms, 4-row legs, auto 1px outline `#07080b`); `drawTile(kind: TileKind): RGBAImage`; `buildAtlas(): Atlas`.

- [ ] **Step 1: Failing tests:** sprite is exactly 16x16; outline pixels are `#07080b` on every transparent-adjacent edge; no pixel outside the palette; `buildAtlas` returns frames for every `TileKind` and all 6 department suits.
- [ ] **Steps 2–5:** FAIL, port generator from `art_sample/make_sample2.py`, PASS, commit `feat(viewer): palette-indexed sprite generator`.

### Task 11: Dev panel

**Files:**
- Create: `apps/viewer/src/ui/{devpanel,inspector,characterList}.ts`; modify `sim-core` to expose `explain(world, id): string[]`
- Test: `packages/sim-core/src/ai/explain.test.ts`

**Interfaces:**
- Produces: `explain(world: World, id: number): string[]` — top 3 scored actions with need values and why chosen; dev panel (toggle with backtick) with: pause/play/speed (1x,10x,60x,600x), character list with search, click to follow, inspector showing needs, job, current action and `explain`, spawn N test characters, reset with seed.

- [ ] **Step 1: Failing test:** after one decision, `explain` returns 3 lines, the first matching the chosen action.
- [ ] **Steps 2–5:** FAIL, implement, PASS; manual: spawn 60 characters at 600x and see them cycle eat/sleep/work. Commit `feat(viewer): dev panel and decision explainer`.

### Task 12: Viewer-side performance and 10k benchmark

**Files:**
- Create: `tools/bench/agents.bench.ts`
- Modify: `packages/sim-core/src/ai/decide.ts` if the budget is missed

- [ ] **Step 1:** Benchmark spawns 10,000 characters on a generated large map and runs 600 ticks. Budget: p95 tick ≤ 50 ms on the dev machine; zero and one character cases also run (Review Focus #5).
- [ ] **Step 2:** Run `pnpm bench`; record results in `docs/perf/baseline.md`.
- [ ] **Step 3:** If over budget, profile and fix (spatial reservation lookup, path caching) without changing determinism tests.
- [ ] **Step 4:** Determinism tests still PASS. **Step 5:** Commit `perf: 10k agent benchmark`.

### Task 13: Dry-run deploy

**Files:**
- Create: `.github/workflows/deploy.yml`, `apps/viewer/public/_headers`

- [ ] **Step 1:** Build (`pnpm --filter viewer build`) produces `apps/viewer/dist`.
- [ ] **Step 2:** Workflow deploys `dist` to Cloudflare Pages on push to `main` (needs repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; owner provides).
- [ ] **Step 3:** Verify preview URL loads, characters walk, dev panel opens. Footer shows `STATION_NAME` and build hash.
- [ ] **Step 4:** Commit `ci: cloudflare pages deploy`.

---

## Self-Review
- Spec coverage for this plan's scope: milestone 0 (live dry-run skeleton), milestone 2 core (headless deterministic sim, needs, jobs, shifts, pathing), milestone 3 start (viewer, six zoom levels, dev panel, art bible sprites), standalone dev mode, 10k performance spike. Everything else is in the roadmap plans.
- Gaps accepted: sound, expressions/bubbles, screens, functional objects (Plan 3); Instagram spike (Plan 6, or earlier spike on request).
- Interfaces: `World`, `Point`, `Department`, `Rank`, `SimTransport`, `DevCmd` are defined once and referenced by name in later tasks.
