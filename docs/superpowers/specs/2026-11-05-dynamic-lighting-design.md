# Dynamic lighting and power

## Decisions (TrueMan)
- **Dynamic means:** lights change state (on/off/dim/flicker/colour), lights move (ship), star and time-of-day light, events and effects.
- **Shadows:** full 2D shadows. **Everything solid** blocks light (walls, closed doors, all solid furniture). Open doors and windows let light through.
- **Look:** quantized brightness bands (six steps, as today); soft edges when zoomed in close, banded when zoomed out.
- **State owner:** the sim. All viewers see the same lighting; it can affect gameplay.
- **Sources:** point, spot (cone), area/strip, directional star light.
- **Authoring:** a kinds table (fixture kind -> light) plus room defaults (ceiling lights from the room template). Grown stations light themselves.
- **Engineering builds lamps (added later, built first):** wall lamps are sim objects (`wall:light` deco). Engineering surveys for dark gaps on a timer and builds lamps where they are missing; see "Engineering: survey and build".
- **Power:** real grid: generators supply a total; rooms demand power; shortage sheds the lowest-priority rooms first.
- **Shortage effects:** dimming and red emergency lighting; work stops at unpowered workstations; doors and gates fail; characters react.
- **Characters:** lit by the local light and cast shadows.
- **Ship and star:** the ship carries its own lights; windows let starlight in; the ship lights the pad and the berth; the planet has a night side.
- **Target:** desktop first (GPU shader). Phones get a reduced mode: fewer lights, shadows only for the lights nearest the view.
- **Order:** engine first, then light state and per-room circuits, then ship and star light, then the power grid's gameplay effects and event effects.

## Model
```
LightSource { id; kind: "point" | "spot" | "area" | "sun"; x, y (world tiles); radius; colour; intensity;
              dir, cone (spot); w, h or a segment (area); flicker?; circuit?: roomId }
```
- **Static set, derived in the viewer** from the station snapshot: fixture kinds table (console = cool cyan, lamp = warm, reactor = orange, ...) plus room defaults (one ceiling light per N tiles of floor). It is recomputed when the station grows. Nothing about it is sent over the wire.
- **Dynamic state, sent by the sim:** per-room circuit level (`full | dim | off | emergency`), generator output, and event flashes. A light's final intensity is `base * circuitFactor * flicker * (day factor for windows)`.
- **Occluders** are tiles and furniture footprints (`solid`), taken from the same map the sim paths on. A door is solid while closed.
- **Moving lights:** the ship's lights are authored in the ship chunk's local tile coordinates and transformed by the ship's drawn placement every frame; its occluders move with it.

## Rendering (viewer, GPU)
- A light buffer at tile-relative resolution: for each visible light, build a 1D shadow map by casting rays against an occluder texture (tile grid), then accumulate colour and intensity into the buffer.
- The final pass quantizes the buffer into six steps and blends the step edges with a soft transition that grows with zoom. Emissive pixels are never darkened (as today). Sprites (characters, ship) sample the same buffer; characters also contribute occluders (small).
- A per-device budget caps visible lights; reduced mode lowers the cap and shadow quality. Lights outside the view are culled.
- The baked lighting in `tiles.ts` goes away once the engine is in.

## Sim: power and circuits (slice 2)
- Each room is a **circuit** with a demand and a priority; generators (the reactor, later others) provide a supply. Per tick: if demand exceeds supply, shed the lowest-priority rooms first (`full -> dim -> off`), with `emergency` as the lit-red state of an unpowered room. Hysteresis stops flicker between levels.
- Events (generator damage, schedule dim at night) change supply or force levels; everything is deterministic and part of the world hash.

## Slices
1. **Engine:** light sources and kinds table, GPU lights with full shadows, quantized soft look, lit characters, reduced mode; replaces the baked lighting. Visual checks at several zoom levels and device budgets.
2. **Light state and circuits:** sim circuits and power levels, protocol field, viewer follows, dev controls to cut a room and a generator.
3. **Ship and star light:** ship's own lights, window starlight by orbit and time of day, planet night side, ship lighting the pad and berth.
4. **Power effects and events:** work stops, doors and gates fail, characters react; one-off flashes and effects.

## Risks
- Everything-solid shadows are busy and can make rooms dark and hard to read; keep a floor on the ambient and a minimum light around characters, and tune with screenshots.
- Per-frame shadow cost grows with the number of lights; the budget and culling are part of slice 1, not later.
- Casting through a moving ship needs the occluder texture to be updated for the ship body every frame; measure early.

## Engineering: survey and build (slice 0, built first)
Lamps are real: a `wall:light` deco on a wall tile, owned by the sim. Engineering finds the gaps and builds them, shown with today's renderer (the GPU engine follows).
- **Lamp:** mounts only where the planner already allows wall fittings (a wall tile with floor to the south, walls to the east and west, no floor to the north). It lights the walkable tiles within `LAMP_REACH = 5` tiles that it can see (line of sight blocked by walls and void).
- **Gap:** a walkable floor tile no lamp lights. Only fixable gaps count: an order needs a free mount spot that would light at least `MIN_GAIN = 8` dark tiles. Open halls far from any wall stay as they are (the baked ambient light covers them until the engine slice).
- **Survey:** every `SURVEY_INTERVAL = 1200` ticks (20 sim minutes), only if an Engineering lead is on shift. The lead is the highest-ranked Engineering character (lowest id breaks ties). Nothing runs on other ticks, and coverage is cached and updated incrementally as lamps are built; the cache is rebuilt only when the station grows.
- **Orders:** greedy by gain, each pick discounting the tiles the previous ones would light, at most `MAX_ORDERS = 6` open at a time. Only the lead decides: orders go to free Engineering crew on shift (nearest first, the lead himself if nobody else is on shift). Everyone else just follows.
- **Build:** a new action: walk to the floor tile in front of the spot, work for `BUILD_TICKS = 240` (4 min, no materials), then the lamp appears (the station rebakes and cross-fades, no pop-in). A build outranks ordinary shift work but not urgent needs. If it is interrupted or unreachable, the order is returned to the queue or the spot is struck off.
- **Cost:** a survey is a few hundred thousand tile checks every 20 sim minutes; builds touch one 11x11 box of the coverage cache.
