# Furnishing planner (concept)

Status: concept agreed, not yet implemented. Goal: people have a mind of their own; stats and needs shape behaviour, and the rooms they live in grow out of that.

## Decisions (agreed 2026-11-05)
- **Sim link:** furniture clusters ("sets") drive behaviour. A dining set is a place to eat together, a lounge corner is where chats happen.
- **Method:** hand-defined sets + a seeded constraint solver. Not WFC, not hand-authored templates.
- **Detail:** story scenes (small vignettes), not clutter for its own sake.
- **Identity:** the crew shapes the station's look, through ownership + traits (an engineer's tools, a medic's plants).
- **Timing:** furnished at build, then re-planned continuously (constant rearranging).
- **Priority:** living spaces first (cabin, bunkroom, lounge, mess), then workplaces, then the rest.
- **Quality bar:** rules as automatic tests + rendered room sheets for visual review.

## Model
- **Zone**: named region of a room (mess: serving, dining, kitchen).
- **Set**: prefab cluster with rules (dining set = table + 4 chairs; workstation pod; conversation corner; bunk block). Declares footprint, facing, slots (seats, stand spots) and the sim affordances it creates.
- **Plan**: output of `planRoom(room, occupants, style, rng)`: list of `{set, x, y, facing}`. Pure function, deterministic for a seed.
- **Solver rules**: back to a wall where the set says so, clearance in front, doors and paths stay open (flood-fill proof), nothing sealed off, no dead-end seating pockets, scored placement with branch-and-bound (as the room planner already does).
- **Ownership**: bunks/desks have owners; owners add personal items by traits and job.
- **Scenes**: vignettes attached to sets, triggered by what the crew is doing.

## Constant rearranging (kept affordable)
Re-plan a single room when something changes (crew grows, new owner, job change, event). Diff old plan vs new; apply only the differences, each moved piece eases into place (no pop-ins, spec 10b). Budget: about one room per sim hour, so it never thrashes.

## Build order
1. Set definitions, solver, sim hooks for living spaces.
2. Ownership + personal items.
3. Scenes + wear.
4. Rearranging with eased moves.
5. Workplaces, then the remaining room types.

## Tests
Clearance in front of every piece; every seat reachable; every bed has a free foot side; same seed = same plan; replan never blocks a path or evicts someone mid-use; room sheets rendered to PNG for review.
