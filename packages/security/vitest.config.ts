import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      NODE_ENV: "test",
      VITEST: "true",
      ALLOWED_LOCALE_DIRS: "/tmp",
    },
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        // Measured 2026-11-11, minus about five points of headroom.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
