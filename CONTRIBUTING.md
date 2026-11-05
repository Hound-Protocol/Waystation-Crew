# Contributing

## Workflow
1. **Concept:** write the idea in `docs/superpowers/specs/` (what, why, decisions, open questions).
2. **Discussion and questions:** settle the open questions before building.
3. **Implementation:** the most refined structure first, in small commits.

## Rules
- Test first: write the failing test, then the code.
- `pnpm test` and `pnpm typecheck` must pass before committing.
- **Smooth UI, no pop-ins:** every visual change eases (camera, motion, level of detail, spawns, markers, panels, first load).
- The simulation must stay deterministic: same seed, same result. Use the seeded `createRng`, never `Math.random`.

## Deploy
Pages deploys from the `deploy` workflow (typecheck + tests + build, then publish). Trigger it from the Actions tab, or: `gh api -X POST repos/Hound-Protocol/Waystation-Crew/actions/workflows/deploy.yml/dispatches -f ref=main`.
