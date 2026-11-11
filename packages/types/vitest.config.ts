import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        // Measured 2026-11-11, minus about five points of headroom.
        lines: 70,
        functions: 65,
        branches: 55,
        statements: 65,
      },
    },
  },
});
