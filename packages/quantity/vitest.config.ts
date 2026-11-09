import { defineConfig } from "vitest/config";

/**
 * These floors are the coverage floors of this package, in percent. They came with the package from systems
 * (`coverage-floors.json`, SYS-109). The formula is the lowest of the measured runs less their spread, rounded down.
 */
const floors = { lines: 96.8, functions: 94.2, branches: 87.1 };

export default defineConfig({
  test: {
    coverage: { thresholds: floors },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
