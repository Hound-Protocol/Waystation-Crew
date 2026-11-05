# Fusion Reactor, Power Grid and Chief Looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic fusion reactor run by Engineering, a power grid feeding lights, machines and doors, scram/restart gameplay, and visible Chief/Senior looks.

**Architecture:** Pure, hashed sim-core module `power/` (reactor, grid, ops) stepped each tick beside `stepLights`; protocol carries a `power` block inside `StatsSnap`; viewer displays (light level multiplier, reactor prop, station card, rank sprites). Follows the `light/` module pattern.

**Tech Stack:** TypeScript pnpm monorepo, Vitest, PixiJS v8 viewer, web-worker sim host.

**Spec:** `docs/superpowers/specs/2026-11-05-fusion-reactor-design.md`

## Global Constraints

- 1 tick = 1 sim second; all sim code pure and deterministic (no `Math.random`, no wall clock); every new sim field is included in `hashWorld`.
- Docking, the ship and launch are never read from the grid.
- Smooth UI, no pop-ins: every visual change eases (CLAUDE.md, spec section 10b).
- TDD: failing test first. Run `pnpm test` and `pnpm typecheck` before each commit.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_0161ezvhqADPGvVXxHN4y9kD`.
- Tunable numbers live in one exported `TUNING` object in `power/reactor.ts`.

## Review Focus

- Reactor with no engineers on shift for hours: trends to a scram, never NaN/negative values (clamp everything).
- Restart attempted out of order or while fuel is empty: sequence restarts or refuses, never starts.
- Battery empty with crew inside a room whose doors are closed: first arriver forces the door in 10 s, others do not all force it at once.
- Chief Engineer goes off shift mid-adjustment: the on-shift Senior takes over with no duplicate commands.
- `supplyLevel` 0 or demand 0: no divide-by-zero; machine slowdown capped.

## File Structure

- Create `packages/sim-core/src/power/reactor.ts` (+test): `ReactorState`, `TUNING`, `createReactor`, `stepReactor`.
- Create `packages/sim-core/src/power/grid.ts` (+test): `PowerGrid`, `createGrid`, `demand`, `stepGrid`.
- Create `packages/sim-core/src/power/ops.ts` (+test): store/fuel, duties, lead commands, `powerAction`, door forcing.
- Create `packages/sim-core/src/power/doors.ts` (+test): unpowered door state.
- Modify `world.ts` (state, step order, hash), `ai/affordances.ts` (ActionKind), `stats.ts`, `index.ts`, `packages/protocol/src/{types,messages}.ts`, `apps/viewer/src/simhost.ts`.
- Viewer: `render/lights/*` (supply multiplier), `ui/stationview.ts`, `ui/stationcard.ts`, `render/sprites/human.ts`, `render/sprites/equipment.ts` (reactor prop), `render/characters.ts` (texture keys).

---

### Task 1: Reactor model

**Files:** Create `power/reactor.ts`, `power/reactor.test.ts`.

**Interfaces:**
- Produces:
  - `type ReactorStatus = "offline" | "starting" | "running" | "scram"`
  - `interface ReactorState { status: ReactorStatus; fuel: number; feed: number; field: number; coolant: number; temp: number; wear: number; step: number; stepLeft: number; output: number; fieldDraw: number }` (all 0..1 except `step`/`stepLeft` ints)
  - `const TUNING = { band: [0.45, 0.75], burnPerTick: 1 / 7200, tankMax: 1, heatGain: 0.0006, coolGain: 0.0006, tempEase: 0.02, wearRate: 0.00002, fieldDrawMax: 0.15, outputMax: 1, restartSteps: [90, 90, 120, 60] }` (initial values)
  - `createReactor(): ReactorState` (offline, fuel 0.6, setpoints 0.5, temp 0)
  - `stepReactor(r: ReactorState): void` (mutates, clamps all values to 0..1)

- [ ] **Step 1: Write failing tests** in `reactor.test.ts`: `output rises with feed inside the temp band`; `output is near zero below the band`; `fuel burns in proportion to feed`; `empty tank scrams and zeroes output`; `temp settles toward the balance of heat and coolant`; `temp above band accumulates wear`; `field below the level temp demands scrams`; `restart runs field, coolant, temp, feed in order and ends running`; `restart refuses with empty fuel`; `values never leave 0..1 over 100000 ticks with random setpoints`.
- [ ] **Step 2: Run** `pnpm vitest run packages/sim-core/src/power/reactor.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `reactor.ts` per spec rules. Approach: temp eases toward `heat(feed) - cool(coolant)` by `tempEase`; output is a smooth bump of temp inside `band` times `feed`; `fieldDraw = field * fieldDrawMax`; required field is a linear function of temp; restart is driven by `step`/`stepLeft` counting down `TUNING.restartSteps`, setpoints raised by the engineer task, advancing only when the step's precondition holds.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat: reactor model`.

### Task 2: Grid, battery and world integration

**Files:** Create `power/grid.ts`, `power/grid.test.ts`; Modify `world.ts`, `index.ts`.

**Interfaces:**
- Consumes: Task 1 `ReactorState`, `stepReactor`.
- Produces:
  - `interface PowerGrid { reactor: ReactorState; battery: number; demand: number; supply: number; supplyLevel: number; doorsPowered: boolean; lifeSupportDown: boolean; fuelStore: number }`
  - `createGrid(): PowerGrid`
  - `demand(w: World): number` = lamps*0.002 + machines*0.01 + base 0.1 (constants in `GRID`)
  - `stepGrid(w: World): void` (steps reactor, computes supply/level, drains or charges battery, sets `doorsPowered`/`lifeSupportDown`)
  - `World.power: PowerGrid`; `step()` calls `stepGrid(world)` right after `stepLights(world)`; `hashWorld` includes `power.reactor.status` code, `output`, `battery`, `fuelStore`.

- [ ] **Step 1: Write failing tests:** `supplyLevel is clamped 0..1`; `no divide by zero when demand is 0`; `scram makes supply zero`; `battery drains only the life-support and door base load during a scram`; `battery recharges when supply exceeds demand`; `empty battery sets doorsPowered false and lifeSupportDown true`; `two worlds with the same seed hash equal after 5000 ticks with power`.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** `grid.ts` and wire into `world.ts` and `index.ts` exports.
- [ ] **Step 4: Run** `pnpm vitest run packages/sim-core`. Expected: PASS, existing world-hash tests updated only if the hash legitimately changes (record a ruling).
- [ ] **Step 5: Commit** `feat: power grid and battery`.

### Task 3: Fuel delivery

**Files:** Modify `power/grid.ts`, `ship/ops.ts` (dock arrival hook), tests.

**Interfaces:**
- Consumes: ship timeline docking event (`shipPhase` leaving `flight` with `leg "back"` into `docked`).
- Produces: `FUEL_DELIVERY = 0.3` added to `power.fuelStore` on each ship arrival; `fuelStore` capped at 1.

- [ ] **Step 1: Write failing tests:** `a ship arrival adds the fuel delivery to the store`; `the store caps at 1`; `no arrival means no delivery`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the hook where the ship becomes docked (one place, tick-exact).
- [ ] **Step 4: Run** sim-core tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: fuel arrives with the ship`. (Ruling carried in ledger: Supply hauling is deferred to the cargo work; the store stands in for Supply storage.)

### Task 4: Engineer duties and chief command

**Files:** Create `power/ops.ts`, `power/ops.test.ts`; Modify `ai/affordances.ts`, `ai/decide.ts` (offer `powerAction`), `ai/task.ts` (finish handlers), `world.ts` (`stepPower` before `stepAI`).

**Interfaces:**
- Consumes: `engineeringLead(w)` from `light/ops`, `ReactorState`, `PowerGrid`.
- Produces:
  - `ActionKind` gains `Watch, Service, Refuel, Restart` (appended after `Build`).
  - `powerAction(w: World, id: number, from: Point, blocked: (x: number, y: number) => boolean): { action: Action; score: number; why: string } | null`
  - `stepPower(w: World): void` (the lead nudges setpoints toward the healthy point every 30 ticks, orders a restart on scram, assigns one watch per shift, hands out refuel/service tasks)
  - `reactorSite(w: World): { x: number; y: number } | null` (position of the `prop:reactor` deco; console stand tile beside it)
  - `commandAuthority(w: World): number` = `engineeringLead(w)`; Senior covers when no Chief is on shift (already by rank order).

- [ ] **Step 1: Write failing tests:** `the on-shift Chief is the commander and a Senior takes over when the Chief is off shift`; `one engineer is on watch per shift`; `watch nudges setpoints toward the healthy band`; `a scrammed reactor gets a restart order from the lead`; `restart tasks run in the fixed order and the reactor ends Running`; `refuel moves fuel from the store to the tank`; `service lowers wear`; `unattended for 6 sim hours the reactor scrams` ; `no duplicate orders when the lead changes mid-task`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow `light/ops.ts`: ledgered orders, `interrupt` and `isFree` pattern, `buildAction`-style action creation, 10-tick hand-out cadence. Console stand tile found from `reactorSite`.
- [ ] **Step 4: Run** `pnpm vitest run packages/sim-core`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: engineers run the reactor`.

### Task 5: Machine slowdown

**Files:** Modify `ai/task.ts` (action progress), tests.

**Interfaces:**
- Consumes: `world.power.supplyLevel`.
- Produces: `machineRate(w: World): number` = `max(0.25, supplyLevel)`, with 0 on scram for machine tasks (Work, galley appliance); Eat/Sleep/Relax at plain furniture unaffected.

- [ ] **Step 1: Write failing tests:** `a Work task takes 1/supplyLevel as long, capped at 4x`; `a Work task makes no progress during a scram`; `Sleep is unaffected by power`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the rate in the action tick.
- [ ] **Step 4: Run** sim-core. Expected: PASS.
- [ ] **Step 5: Commit** `feat: brownouts slow machine tasks`.

### Task 6: Unpowered doors

**Files:** Create `power/doors.ts`, `power/doors.test.ts`; Modify `ai/move.ts` (blocked check), `ai/task.ts`, `ai/affordances.ts` (`ActionKind.ForceDoor`).

**Interfaces:**
- Consumes: `power.doorsPowered`, `TileKind.Door`.
- Produces:
  - `FORCE_TICKS = 10`
  - `isDoorClosed(w: World, x: number, y: number): boolean` (true for a Door tile when `!doorsPowered` and not forced)
  - `forcedDoors: Set<number>` in `world.power` (hashed), reset when power returns
  - `ActionKind.ForceDoor`: the first character blocked by a closed unpowered door starts it (door index in `order`); others wait on the existing blocked-wait logic.

- [ ] **Step 1: Write failing tests:** `with power every door is passable`; `without power a door blocks pathing`; `the first character to reach it starts forcing and no second one does`; `forcing takes 10 ticks then the door stays open`; `power returning clears forced state`; `the ship gate is never blocked`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** and extend the `blocked` callback used by pathing.
- [ ] **Step 4: Run** sim-core. Expected: PASS.
- [ ] **Step 5: Commit** `feat: unpowered doors and manual forcing`.

### Task 7: Protocol and host

**Files:** Modify `packages/protocol/src/types.ts`, `messages.ts`, `packages/sim-core/src/stats.ts`, `apps/viewer/src/simhost.ts`, `apps/viewer/src/transport/worker.test.ts`.

**Interfaces:**
- Produces: `interface PowerSnap { status: "offline"|"starting"|"running"|"scram"; output: number; demand: number; battery: number; fuel: number; fuelStore: number; temp: number; field: number; coolant: number; feed: number; wear: number; supplyLevel: number; doorsPowered: boolean; lifeSupportDown: boolean }`; `StatsSnap.power: PowerSnap`; `stationStats(w)` fills it; a delta is sent immediately on a status change.

- [ ] **Step 1: Write failing tests:** `snapshot carries power`; `delta carries power at the stats cadence`; `a status change sends an immediate delta`.
- [ ] **Step 2: Run** `pnpm vitest run apps/viewer/src/transport`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole `pnpm test` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: power in snapshots and deltas`.

### Task 8: Viewer lighting response

**Files:** Modify `apps/viewer/src/render/lights/sources.ts`, `pass.ts`, `fade.ts`, `main.ts`, tests.

**Interfaces:**
- Consumes: `PowerSnap.supplyLevel`, `status`.
- Produces: `LightPass.setSupply(level: number, scram: boolean): void` — lamp intensity multiplied by an eased level (reuse `LightFade`, 1 s); scram adds a dim emergency tint; ship interior baked light unaffected.

- [ ] **Step 1: Write failing tests:** `lamp intensity scales with the eased supply level`; `level changes ease over time, never jump`; `scram uses the emergency tint`; `GPU and CPU oracle agree at supply 0.5` (extend `expectedPixel`).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** and wire `setSupply` from `stats.power` in `main.ts`.
- [ ] **Step 4: Run** the viewer tests and `apps/viewer/e2e/light-parity.py` at DPR 1 and 2.
- [ ] **Step 5: Commit** `feat: lights follow the power supply`.

### Task 9: Reactor room and station card

**Files:** Modify `render/sprites/equipment.ts` (reactor core frames), `render/sprites/library.ts`, `ui/stationview.ts` (+test), `ui/stationcard.ts`, `index.html` CSS, `main.ts`.

**Interfaces:**
- Consumes: `PowerSnap`.
- Produces: `StationView.power: { status: string; output: number; demand: number; battery: number; fuel: number; fuelStore: number; supplyLevel: number }`; reactor prop glow animates with `output` (eased); console gauges (temp, field, coolant, feed) as small bars drawn on the console sprite.

- [ ] **Step 1: Write failing tests** in `stationview.test.ts`: `power block reports status, output vs demand, battery, fuel`; `missing power gives zeros and status offline`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** builder, card section (bars ease via CSS), sprite animation.
- [ ] **Step 4: Run** `pnpm test` and `pnpm typecheck`; screenshot the card and reactor room with Playwright.
- [ ] **Step 5: Commit** `feat: reactor room visuals and power card`.

### Task 10: Chief and Senior looks

**Files:** Modify `render/sprites/human.ts` (+test `sprites.test.ts`), `render/characters.ts`, `render/sprites/atlas.ts` (texture keys), `main.ts` (pass `rank`).

**Interfaces:**
- Consumes: `CharSnap.rank` (`Rank.Chief` = 4, `Rank.Senior` = 3).
- Produces: `drawHuman(o: { skin; hair; dept; rank?: Rank })`, same for `drawBack`, `drawSide`, `drawHumanDir`; texture keys `char:<dept>:<variant>:<tier>[:<dir>]` with `tier` 0 (crew), 1 (Senior), 2 (Chief). Chief: white beret and suit collar plus shoulder stripe. Senior: sleeve stripe.

- [ ] **Step 1: Write failing tests:** `a Chief sprite differs from a crew sprite in the head rows in every direction`; `a Chief has white beret pixels (255,255,255) in the front, side and back views`; `a Senior differs from crew only in the sleeve`; `crew sprites are unchanged`.
- [ ] **Step 2: Run** `pnpm vitest run apps/viewer/src/render/sprites`. Expected: FAIL.
- [ ] **Step 3: Implement** and extend atlas/texture keys and `characters.ts` lookup (fallback to tier 0 if missing).
- [ ] **Step 4: Run** `pnpm test` and `pnpm typecheck`; screenshot a Chief at zoom 56.
- [ ] **Step 5: Commit** `feat: chief and senior looks`.

### Task 11: Integration and deploy

**Files:** Create `packages/sim-core/src/power/integration.test.ts`.

- [ ] **Step 1: Write failing tests:** `over 3 sim days with engineers on shift the reactor stays Running and fuel never hits zero while ships deliver`; `with engineers removed the reactor scrams, the battery drains, doors lock, and restoring an engineer recovers everything`; `world hash is identical across two runs`.
- [ ] **Step 2: Run.** Expected: FAIL until tuning settles.
- [ ] **Step 3: Tune** `TUNING` values only (record each change as a ledger ruling).
- [ ] **Step 4: Run** `pnpm test` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit, then deploy** with `gh api -X POST repos/Hound-Protocol/Waystation-Crew/actions/workflows/deploy.yml/dispatches -f ref=main`.
