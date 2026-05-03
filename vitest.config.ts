import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
    // server/__tests__/*.test.ts use node:test (run via `tsx --test`), not vitest.
    exclude: ["**/node_modules/**", "server/__tests__/**"],
    environment: "node",
    root: __dirname,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
