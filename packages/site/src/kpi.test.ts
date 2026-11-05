import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { newestRun, siteKpiInput } from "./kpi.ts";

const results = fileURLToPath(new URL("../../evaluator-bench/results", import.meta.url));

describe("the file kpi.json", () => {
  it("takes the newest folder with the name of a day", () => {
    expect(newestRun(["2026-11-03", "notes", "2026-12-01", "2026-10-09"])).toBe("2026-12-01");
  });

  it("stops the build with no kept run, because the file then has no time of the data", () => {
    expect(() => newestRun(["notes"])).toThrow(/no kept run/);
  });

  it("reads the kept run: each evaluator of the model has a cost", () => {
    const input = siteKpiInput(results);
    expect(input.project).toBe("algebra");
    expect(input.at).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/);
    expect(input.measures.map((measure) => measure.id)).toEqual(["evaluators-priced"]);
    expect(input.measures[0]?.value).toBeGreaterThanOrEqual(4);
  });
});
