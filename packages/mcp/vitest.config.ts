import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        // Measured 2026-11-11, minus about five points of headroom.
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
