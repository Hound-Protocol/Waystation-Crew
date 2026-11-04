# Waystation Crew: working rules

- **Smooth UI, no pop-ins.** Every visual change must ease (camera, motion, LOD, spawns, markers, panels, lists, first load). See spec section 10b.
- TDD: write the failing test first. Run `pnpm test` and `pnpm typecheck` before committing.
- Deploy: `gh api -X POST repos/Hound-Protocol/Waystation-Crew/actions/workflows/deploy.yml/dispatches -f ref=main` (`gh workflow run` is blocked).
