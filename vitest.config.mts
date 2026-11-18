import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) } },
  // Integration tests use DATABASE_URL from .env when present and skip themselves otherwise.
  test: { include: ["tests/**/*.test.ts"], fileParallelism: false, env: loadEnv(mode, process.cwd(), "") },
}));
