# Sim performance baseline (Plan 1)

`pnpm bench` — sim-core only (no rendering), 200x200 open map, ~1,800 furniture, random needs, Node 22, sandbox CPU.

| Characters | Ticks | Mean | p95 | Max |
|-----------:|------:|-----:|----:|----:|
| 0 | 600 | 0.00 ms | 0.00 ms | 0.22 ms |
| 1 | 600 | 0.02 ms | 0.00 ms | 12.56 ms |
| 1,000 | 600 | 1.54 ms | 7.80 ms | 96.15 ms |
| 10,000 | 300 | 29.22 ms | 36.19 ms | 311.99 ms |

Budget: p95 tick <= 50 ms at 10,000 characters (1 tick = 1 sim second, so 1x speed has ~950 ms of headroom). Met.
Known cost centres: A* allocates per call; reservation sampling is O(8) per option. Max spikes are first-tick/GC. Optimise A* buffers (generation-stamped reuse) if the budget is ever missed.
