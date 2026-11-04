import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const p = (s: string) => fileURLToPath(new URL(s, import.meta.url));
export default defineConfig({
  resolve: { alias: { "@wc/protocol": p("./packages/protocol/src/index.ts"), "@wc/sim-core": p("./packages/sim-core/src/index.ts") } },
  test: { include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tools/**/*.test.ts"] },
});
