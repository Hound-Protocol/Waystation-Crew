# Claude Handoff — Waystation Crew: Completion & Improvement Roadmap

**Purpose:** Turn Waystation Crew from an interesting autonomous station prototype into a coherent, robust, replayable living-world simulation that people want to observe over time.

**Product identity:** Waystation Crew is a living, non-interactive space station run by autonomous characters. Protect that identity. Do not turn it into a conventional clicker, resource-grind idle game, or direct-control management simulator unless the project owner explicitly changes direction.

**Important instruction:** Treat this document as a product and engineering brief, not permission to rewrite the architecture wholesale. First inspect the current implementation, the specifications in `docs/superpowers/specs/`, the plans in `docs/superpowers/plans/`, tests, and benchmarks. Map each recommendation below to what already exists. Mark items as implemented, partial, missing, or not appropriate before changing code. Preserve working systems and current visual identity.

---

## 1. The core experience we should deliver

The player should be able to open the station, watch autonomous crew members go about their lives, and become interested in what happens next.

The experience should communicate:
- The station is functioning without constant player input.
- Crew members are individuals, not interchangeable moving sprites.
- Their needs, roles, routines, and interactions produce understandable consequences.
- Events leave traces: the station develops a history.
- The simulation is legible. The player can understand *why* something happened without needing to control it.
- The world remains interesting during short visits and rewards returning after longer absences.

The primary product loop is **observe → notice → understand → become attached → return**. The player is an observer, with optional light caretaker/administrator tools only where they reinforce that loop.

## 2. Priority 0 — Reliability and simulation integrity

Before adding more behaviour, establish that the simulation is correct and dependable.

### Audit and complete
1. **Simulation determinism**
   - Confirm that a given seed and simulation inputs produce reproducible outcomes where intended.
   - Centralize and document random-number generation; avoid uncontrolled calls to global randomness in simulation logic.
   - Ensure rendering frame rate does not change simulation outcomes.
2. **Time model**
   - Define simulation time independently from wall-clock/render time.
   - Test pause, speed changes, large time steps, tab backgrounding, and resuming.
   - Avoid skipped needs, impossible movement, or runaway state transitions at high speeds.
3. **Agent lifecycle**
   - Define valid spawn, active, incapacitated/unavailable (if applicable), despawn, and recovery/removal rules.
   - Prevent duplicate agents, invalid state combinations, stuck agents, and agents permanently occupying resources.
4. **Movement and navigation**
   - Validate walkable areas, collision/overlap handling, destinations, path failures, and recovery from blocked routes.
   - Agents must not oscillate forever, clip through important station geometry, or silently abandon tasks.
5. **Performance**
   - Benchmark realistic and stress populations, not just a tiny demo.
   - Measure simulation update time, render time, memory, pathfinding cost, and worker communication.
   - Set an explicit supported population target and graceful degradation behaviour.
6. **Error handling**
   - Surface worker crashes, malformed data, failed asset loads, and invalid simulation states clearly.
   - Add a safe recovery path; do not leave the viewer frozen with no explanation.

### Acceptance criteria
- Tests cover pause/resume, speed changes, seeded runs, long time steps, agent lifecycle, navigation failure, and worker failure.
- The simulation produces no invalid states in a long-running automated soak test.
- Benchmarks document baseline and target population/performance.
- Rendering and simulation remain decoupled.

## 3. Priority 1 — Make crew members feel like individuals

This is the most important product improvement.

### Character identity
Give each crew member a persistent identity, with a small set of understandable traits. Start simple and only add complexity when it creates visible behaviour.

Suggested attributes:
- Stable name/identifier and role/department.
- A few personality tendencies (e.g. sociability, conscientiousness, energy, risk tolerance).
- Preferences and dislikes (activities, locations, company, food or rest areas, if these systems exist).
- Skill/experience relevant to their role, if it affects outcomes.
- A compact personal history and current condition.

Avoid generating dozens of meaningless stats. Every trait should influence a decision, a relationship, or something the player can observe.

### Needs and routines
Audit existing needs and activities, then ensure they interact consistently:
- Rest/energy, hunger, health, morale/stress, social contact, and work obligations are possible dimensions; do not implement all automatically if the current design does not support them.
- Needs should influence behaviour, not just fill bars.
- Use role schedules and personal preferences to create routine, with enough variation to avoid robotic repetition.
- A character should have a reason for choosing an activity and a reason for leaving it.
- Make competing needs and duties resolve predictably and fairly.

### Relationships and social behaviour
Build relationships gradually, based on shared events and repeated interactions, rather than assigning arbitrary friendship scores.

Potential behaviours:
- Greeting and recognizing familiar crew.
- Choosing to spend time with preferred colleagues.
- Helping someone who is struggling, when role, proximity, and available time make it plausible.
- Disagreement or avoidance where personality/context supports it.
- Remembering meaningful positive or negative interactions.

Do not make every agent interact constantly. Solitude, routine, and missed encounters are also valid. Keep social behaviour bounded and performant.

### Acceptance criteria
- Two agents with different traits/preferences can demonstrably make different choices in comparable situations.
- Interactions have observable causes and consequences.
- Relationships persist and evolve over time.
- Tests cover trait influence, need prioritization, relationship updates, and edge cases.
- The UI can reveal a concise explanation for a notable choice or interaction.

## 4. Priority 2 — Emergent events and a persistent station history

The station should accumulate stories without relying on a scripted sequence.

### Event system
Create or strengthen a structured event model for meaningful occurrences, for example:
- A crew member helps another.
- Someone repeatedly misses rest or work.
- A maintenance task is delayed.
- A department becomes unusually busy.
- Two crew members develop a friendship or fall out.
- A crew member changes routine after a significant event.

Events should be generated from simulation facts, not fabricated purely for flavour text. Avoid spamming trivial events.

### Station chronicle
Provide a compact, persistent timeline:
- Timestamp (simulation time).
- Event type and involved crew.
- Short human-readable summary.
- Relevant department/location.
- Optional severity/importance.
- Stable event identifier and enough structured data to inspect/debug it.

Prioritize notable events and allow filtering by crew member or department. Keep history bounded or archived so long-running saves do not grow without limit.

### Long-term change
Consider lightweight progression that emerges from play:
- Crew learn routines or improve at tasks.
- Relationships change.
- Departments experience periods of strain or stability.
- Personal habits develop after repeated events.

Do not add a large economy, upgrade tree, or arbitrary progression layer simply to make it feel more like a standard idle game.

### Acceptance criteria
- Events are derived from real state transitions/interactions.
- The same event is not repeatedly emitted every tick.
- Event history survives reloads and is versioned.
- A returning player can quickly see what happened while they were away.

## 5. Priority 3 — Make observation satisfying and understandable

The viewer is the main interface. Prioritize clarity and atmosphere over dense dashboards.

### Crew inspection
A selected crew member should have a compact profile showing:
- Name, role, department, current activity and location.
- Current needs/condition where relevant.
- Personality/preferences in a restrained form.
- Relationships or notable history.
- A short explanation of their current goal/decision when available.

### Contextual feedback
- Show readable activity labels or subtle visual indicators.
- Make important events discoverable without constant notifications.
- Distinguish normal movement from meaningful interaction.
- Provide a way to follow a crew member and return to the station overview.
- Keep debug/developer controls separate from the normal player experience.

### Camera and controls
Audit zoom, pan, tracking, pause, and simulation speed controls for discoverability and usability. Provide sensible defaults and avoid accidental camera movement on touch devices. Ensure controls remain usable at different screen sizes.

### Atmosphere
Use restrained ambient station feedback: subtle lighting/state changes, machinery or environmental animation, and sound only if the project’s direction supports it. Do not add noisy effects that obscure the crew or make the station feel busy for its own sake.

### Acceptance criteria
- A new player can identify what a crew member is doing and inspect them without a tutorial.
- The UI communicates meaningful changes without flooding the screen.
- Core interactions work with mouse and touch where supported.
- Debug features are not accidentally exposed as the main gameplay interface.

## 6. Priority 4 — Save/load, offline progression, and returning-player experience

This is essential for an idle-style experience, but must be implemented carefully.

1. **Save format**
   - Define a versioned save schema for simulation state, crew identities, relationships, station state, event history, and simulation clock.
   - Validate saves and handle missing/invalid fields safely.
   - Include migrations when schemas change.
2. **Autosave**
   - Save at safe intervals and important transitions.
   - Avoid blocking the render loop or corrupting saves on interrupted writes.
   - Expose a clear save status if useful.
3. **Offline progression**
   - Decide explicitly whether the world advances while the page is closed.
   - If yes, calculate elapsed time safely, cap catch-up, and simulate in bounded steps or use an appropriate summary model.
   - Do not blindly fast-forward thousands of ticks and produce impossible states.
   - If full offline simulation is not yet reliable, show a clear paused-while-away policy rather than pretending time passed.
4. **Return summary**
   - On reopening, summarize meaningful events since the last session.
   - Let the player jump from a summary item to the relevant crew member or location.

### Acceptance criteria
- Reloading restores a coherent station and stable identities.
- Save migrations are tested.
- Interrupted or malformed saves do not permanently destroy progress.
- Offline policy is explicit, tested, and accurately represented to the player.

## 7. Priority 5 — Onboarding, accessibility, and product polish

- Add a short, skippable first-run explanation: what this world is, how to inspect crew, and how time controls work.
- Provide a useful initial station population and a clear first thing to observe.
- Add pause and speed controls with visible state.
- Ensure text contrast, readable sizing, keyboard focus, and reduced-motion consideration.
- Avoid relying only on colour to communicate status.
- Make loading, empty/error, and save states intentional.
- Check responsive layouts and browser performance.
- Add a small settings panel only for meaningful options (sound, motion, display scale, simulation speed defaults, if supported).

## 8. Engineering quality and maintainability

Please review the existing architecture before changing it.

- Keep simulation rules independent of Pixi/rendering code and UI components.
- Keep worker message contracts typed, validated, and versionable.
- Avoid coupling game rules to animation timing.
- Add unit tests for rules and integration tests for worker/message flows.
- Keep deterministic seeds available for reproducing bugs.
- Add scenario tests for longer emergent sequences, not only isolated functions.
- Keep benchmarks reproducible and record environment/population.
- Add concise developer documentation for architecture, simulation tick lifecycle, state model, save model, and how to add a new agent behaviour.
- Keep the build, typecheck, tests, and benchmark scripts healthy.

## 9. Suggested delivery phases

Do not attempt every feature in one large change. Work in small reviewable increments.

**Phase A — Audit and foundations**
- Map current systems against this brief and existing specs/plans.
- Identify bugs, missing tests, performance limits, and duplicate/obsolete systems.
- Produce a short gap report and proposed sequence.
- Fix correctness and determinism issues before expanding behaviour.

**Phase B — Character depth**
- Persistent identity, meaningful traits, need/goal prioritization, routines.
- Add explainable decisions and tests.

**Phase C — Social life and events**
- Relationship model, contextual interactions, event generation, chronicle.
- Ensure events arise from simulation state and are not just scripted text.

**Phase D — Persistence**
- Versioned saves, migrations, autosave, explicit offline policy, return summary.

**Phase E — Player experience**
- Inspection UI, event discovery, onboarding, responsive/accessibility polish, atmosphere.

**Phase F — Balance and validation**
- Long-running simulations, population stress tests, performance profiling, regression tests, tuning.

For each phase, provide:
1. What already existed.
2. What changed and why.
3. Files changed.
4. Tests/commands run and results.
5. Known limitations and follow-up tasks.
6. Screenshots or a short recording for visible UI changes, where practical.

## 10. Scope guardrails

- Do not replace the current architecture just because another pattern is fashionable.
- Do not add complex personality/relationship/needs systems without observable consequences.
- Do not make the player micromanage every agent.
- Do not turn the game into a resource-clicker or upgrade treadmill.
- Do not add fake events or fabricated memories that contradict simulation state.
- Do not sacrifice determinism, performance, or save integrity for superficial complexity.
- Do not silently change the product premise or visual identity.
- Do not implement every suggestion blindly. Validate each against the existing specs and the owner’s intended experience.

## 11. First task for Claude

Start with a **read-only audit** of the current repository:
1. Read all relevant specs and plans under `docs/superpowers/`.
2. Trace the actual simulation from agent data/model through decision-making, movement, worker updates, rendering, and persistence.
3. Inspect tests and benchmarks; run `pnpm test`, `pnpm typecheck`, `pnpm bench`, and the production build where the environment permits.
4. Create a matrix of the recommendations above: **Implemented / Partial / Missing / Not applicable**, with file references and evidence.
5. Identify the five highest-impact gaps and propose small implementation tasks with acceptance criteria.
6. Do not start a broad rewrite. After the audit, implement only the highest-priority, low-risk correctness issue if one is clearly demonstrated; otherwise report back for approval.

**Definition of done:** Waystation Crew remains a calm, watchable autonomous station, but its crew feel distinct, its events have causes, its history persists, and the simulation is stable enough to leave running and return to.
