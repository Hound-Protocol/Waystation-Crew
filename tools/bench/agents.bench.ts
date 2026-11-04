import { makeWorld, runTicks, pct } from "./harness";

for (const count of [0, 1, 1000, 10_000]) {
  const w = makeWorld(count);
  const ms = runTicks(w, count >= 10_000 ? 300 : 600);
  console.log(`${String(count).padStart(6)} chars: mean ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2)} ms · p95 ${pct(ms, 0.95).toFixed(2)} ms · max ${Math.max(...ms).toFixed(2)} ms`);
}
