import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        // Measured 2026-11-11, minus about five points of headroom.
        lines: 80,
        functions: 75,
        branches: 65,
        statements: 80,
      },
    },
  },
});
