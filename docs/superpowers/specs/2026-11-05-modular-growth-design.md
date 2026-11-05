# Modular station growth (design)

**Goal.** The station is assembled from a kit of small room types and grows on demand through a deterministic, rule-based planner. Fixed per-department presets are gone.

**Intent (agreed with the owner).** Icebox-style density: departments are wings of several small rooms along wide halls, no empty lots, every room unique. The AI that builds is a rule-based planner (not an LLM, not crew construction); it must be reproducible from a seed for the shared 24/7 world.

## Parts
1. **Room kit** (`station/kit/`): each room type is a generator `(rng, size) -> Blueprint` (boxy shape + rule-based furnishing). Types carry a department kind and a size range. Wing recipes list the types that suit a department.
2. **Planner** (`station/planner.ts`): `planGrowth(station, demand, rng) -> BuildOrder | null`. Frontage growth: find free frontage along a hall, fit a room whose door opens onto the hall, one wall tile between rooms. No frontage left: extend or branch a hall, then retry. Scores: distance to hub, department affinity.
3. **Demand** (`station/demand.ts`): `measureDemand(world)` -> beds needed, posts needed per department, hall load. Rules: beds < pop*1.1 -> cabins/bunkrooms; posts < characters per dept -> that wing's rooms.
4. **Apply** (`station/build.ts`): `applyOrder(station, order)` stamps room, door, walls, re-seals the hull; appends furniture (ids stay stable), never touches existing tiles.
5. **Sim hook**: every sim hour `growIfNeeded(world)` runs one build; world indexes (`furnitureByKind`, job posts) are extended, not rebuilt.
6. **Viewer**: a `station` message carries the new rooms; the map re-bakes and cross-fades (spec 10b: no pop-ins).
7. **Starter** = a seed (plaza, cross halls, Arrivals) grown by the same planner until capacity for 100 crew is met.

## Tests
Same seed -> same station; every room reachable after 40 growth steps; no overlaps; inside the map; doubling population triggers more beds and department rooms; sim keeps running (jobs, furniture) after growth.
