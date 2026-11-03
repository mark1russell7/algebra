import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { logPlace, planAt, questionName, questionsOf, scaleExact, stageRows } from "./cost.ts";
import type { CostReport } from "./cost.ts";

const text = (url: string): string => readFileSync(new URL(url, import.meta.url), "utf8");
const report = JSON.parse(text("../data/a6-report.json")) as CostReport;
const questions = questionsOf(report.model);
const sign = questions.find((q) => q.kind === "sign")!;

describe("the cost section", () => {
  it("reads a copy of the kept report, with no change", () => {
    expect(text("../data/a6-report.json")).toBe(text("../../evaluator-bench/results/2026-11-03/report.json"));
  });

  it("gives the plan and the cost of the kept report at factor 1", () => {
    expect(questions.map(questionName)).toEqual(report.selections.map((s) => s.question));
    for (const q of questions) {
      const kept = report.selections.find((s) => s.question === questionName(q))!;
      const got = planAt(q, report.model, 1);
      expect(got.plan).toEqual(kept.plan);
      expect(got.expectedCost).toBeCloseTo(kept.expectedCost, 9);
    }
  });

  it("changes the plan of the sign with the cost of exact", () => {
    const plans = [1 / 256, 1 / 8, 1, 8, 64].map((f) => planAt(sign, report.model, f).plan.join());
    expect(new Set(plans).size).toBeGreaterThan(1);
  });

  it("gives a reach for each stage of the plan that adds up to the expected cost", () => {
    for (const q of questions) {
      const { plan, expectedCost } = planAt(q, report.model, 1);
      const rows = stageRows(q, report.model, plan);
      const total = rows.reduce((sum, r) => sum + (r.reach ?? 0) * r.cost, 0);
      expect(total).toBeCloseTo(expectedCost, 9);
      expect(rows.at(-1)!.stage).toBe("exact");
    }
  });

  it("scales only the cost of exact, and keeps a value on the log axis", () => {
    const scaled = scaleExact(report.model, 2);
    expect(scaled.cost.exact).toBe(report.model.cost.exact * 2);
    expect(scaled.cost.float).toBe(report.model.cost.float);
    expect(logPlace(10, 1, 100)).toBeCloseTo(0.5, 12);
    expect(logPlace(1000, 1, 100)).toBe(1);
    expect(logPlace(0.1, 1, 100)).toBe(0);
  });
});
