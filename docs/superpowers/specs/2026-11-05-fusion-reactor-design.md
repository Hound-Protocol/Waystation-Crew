# Fusion reactor, power grid and chief rank looks: design

Status: approved in conversation 2026-11-05, awaiting written-spec review. Kitchen/galley behaviour is a separate spec that follows this one.

## Goal

The station gets a real power source. A fusion reactor is run by the Engineering department as a full control simulation. Power feeds lights, machines, and life support/doors. A scram (trip) causes a visible blackout that engineers must recover from. Chiefs and Seniors become visually recognisable.

## Decisions (from the discussion)

- Source: fusion reactor, fuel-fed.
- Running it: full simulation. Engineers balance four controls: fuel feed, plasma temperature, containment field, coolant flow.
- Failure: scram and restart. Engineers run a timed restart sequence.
- Consumers: lights, machines (incl. galley appliances), life support and doors.
- Never power-gated: ship docking and launch (otherwise no new players could arrive). The ship has its own mini reactor, a status item only for now.
- Backup: a battery bank powers only life support and doors during a scram, and drains.
- Fuel: arrives on the cargo ship cycle, stored by Supply, loaded by engineers.
- Command: the Chief Engineer (highest rank on shift, same rule as `engineeringLead`) sets the controls and orders restarts. A Senior takes over when the Chief is off shift.
- Looks: every Chief gets a white beret and a trimmed suit (collar and shoulder stripe). Seniors get a sleeve stripe.

## Architecture

Everything simulated lives in `packages/sim-core` as pure, deterministic code stepped once per tick (1 tick = 1 sim second), included in `hashWorld`, so the later Rust/WASM port has a parity oracle. The viewer only displays.

New module `packages/sim-core/src/power/`:

- `reactor.ts`: `ReactorState` and `stepReactor(w)`.
- `grid.ts`: `demand(w)`, `supplyLevel(w)` (0..1), `stepGrid(w)`.
- `ops.ts`: engineer duties (watch, adjust, refuel, service, restart), reusing the light-ops pattern (`stepPower` before `stepAI`, ledgered orders, `ActionKind` additions).
- Tests next to each file; `world.power` holds the state.

### Reactor state (`world.power.reactor`)

`status: Offline | Starting | Running | Scram`; `fuel` (tank); `feed`, `field`, `coolant` (setpoints, 0..1, set by engineers); `temp` (0..1 normalised, healthy band inside it); `wear` (pumps and coils); `step` and `stepLeft` for the restart sequence.

### Rules per tick (initial values, all tunable constants in one `TUNING` object)

- Output rises with `feed` and with `temp` while `temp` is inside the healthy band; below the band the plasma fizzles and output falls toward zero.
- Fuel burn is proportional to `feed`. Empty fuel forces output to zero and a scram.
- Heat gain follows burn; heat removal follows `coolant`. `temp` moves toward the balance point smoothly (no jumps). Above the band, `wear` accumulates.
- The field draws power. If `field` falls below the level `temp` demands, containment fails: status becomes `Scram`.
- Unattended drift: with no engineer on watch, setpoints stay but conditions (wear, ship deliveries) change, so the reactor trends toward a scram without intervention.
- Scram: output is zero immediately; the restart sequence is available.
- Restart (timed, in order): field up, coolant up, temperature ramp, feed up. Each step is an engineer task with a duration; skipping order restarts the sequence.

### Grid (`world.power.grid`)

- `supply = output - fieldDraw` (battery handled below). `demand = lamps + machines + lifeSupportBase`.
- `supplyLevel = clamp(supply / demand, 0, 1)`.
- Brownout (`0 < supplyLevel < 1`): lamps dim by `supplyLevel`, machine tasks (cooking, treatment, work) take longer by `1 / supplyLevel` up to a cap, nothing stops.
- Scram (output 0): normal lights and machines are off. The battery supplies life support and doors only, draining at their base load. Charge is restored when supply exceeds demand.
- Battery empty: doors fail open (never trapping crew) and a `lifeSupportDown` flag starts a timer; the consequences of that timer (cold, evacuation) are out of scope for this spec and the flag is only displayed.
- The ship, docking clamps and launch are never read from the grid.

### Protocol

`StatsSnap` gains a `power` block: `status`, `output`, `demand`, `battery`, `fuel`, `temp`, `field`, `coolant`, `feed`, `wear`, `supplyLevel`. Snapshot and delta carry it on the same cadence as `stats` (≥30 ticks), plus an immediate message on status change. Snapshot rank is already present.

## Engineers and command

- The lead is `engineeringLead(w)` (highest rank on shift, lowest id breaks ties). Only the lead decides setpoint changes and orders a restart.
- Duty tasks by role: one engineer on watch at the reactor console each shift (reads gauges, nudges setpoints in small steps toward the healthy point); others load fuel from storage, service pumps and coils to reduce `wear`, and carry out restart steps.
- Fuel: the existing cargo ship cycle delivers fuel; Supply stores it; engineers move it to the tank. A late ship can starve the reactor.
- Engineers' AI reuses the existing task system (`ActionKind` gains `Watch`, `Service`, `Refuel`, `Restart`) and the same furniture-affordance approach as lamps.

## Viewer

- Reactor room: the existing `prop:reactor` becomes an animated core whose glow follows output; a console with gauges; an emergency-light state on scram.
- Lighting: `supplyLevel` multiplies lamp intensity (eased through the existing light fade, no pop-ins); scram uses a dim emergency tint.
- Station card, "Power & lighting" section: adds status, output vs demand, battery, fuel. All changes ease (spec 10b).
- Rank looks (pure viewer, derived from `rank`): white beret on every Chief in front, side and back sprites; Chief suit trim (collar, shoulder stripe); Seniors get a sleeve stripe. Texture keys extend to `char:<dept>:<variant>:<rankTier>`.

## Testing

- Reactor: output vs feed and temp; temperature settles; fuel burn; containment failure scrams; restart sequence order and timing; determinism (same seed, same hash).
- Grid: brownout dimming math, scram supply is zero, battery drain and recharge, door-fail-open at empty battery, ship never power-gated.
- Ops: lead selection and Senior fallback; unattended reactor trends to scram; fuel starvation when the ship is late.
- Protocol and viewer: `power` in snapshot and delta; station card shows values; sprite rank tiers produce distinct textures (beret present for Chief in all views).
- Parity: world-hash test covers `world.power`.

## Out of scope

Kitchen/galley behaviour (next spec), life-support consequences beyond the displayed flag, real disasters (fire, breach, crew loss), the ship's mini reactor as a simulation, power-circuit routing per room (lighting slice 2).

## Open tuning (not blockers)

Exact numbers in `TUNING` (healthy temp band, burn rate, battery size, restart step lengths) are set during implementation against sim-run tests and adjusted after you watch it run.
