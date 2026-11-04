import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const p = (s: string) => fileURLToPath(new URL(s, import.meta.url));
export default defineConfig({
  base: process.env.BASE ?? "./",
  resolve: { alias: { "@wc/protocol": p("../../packages/protocol/src/index.ts"), "@wc/sim-core": p("../../packages/sim-core/src/index.ts") } },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: true },
});
