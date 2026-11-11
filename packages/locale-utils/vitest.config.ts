import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        // Measured 2026-11-11, minus about five points of headroom.
        lines: 90,
        functions: 95,
        branches: 80,
        statements: 90,
      },
    },
  },
});
