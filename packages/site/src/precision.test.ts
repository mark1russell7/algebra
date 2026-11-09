import { readFileSync } from "node:fs";
import type { CostModel } from "@algebra/evaluator-select";
import { describe, expect, it } from "vitest";
import type { CostReport } from "./cost.ts";
import { armName, costRows, precisionsOf, stagePlans, stageVerdict, verdictGrid, withStage, type PrecisionReport } from "./precision.ts";
import type { KeptRuns } from "./study.ts";

const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const report = json<PrecisionReport>("../data/a7-report.json");
const a6 = json<CostReport>("../data/a6-report.json").model;
const kept = json<KeptRuns>("../data/kept-runs.json");
const PRECISIONS = ["64", "128", "256", "512", "1024", "2048", "4096"];

describe("the data of the precision section", () => {
  it("is the report of the kept run of the bigfloat bench", () => {
    expect(report).toEqual(json(`../../bigfloat-bench/results/${kept.bigfloat.folder}/report.json`));
  });

  it("has the precisions of the bench, from the lowest", () => {
    expect(precisionsOf(report)).toEqual(PRECISIONS);
  });
});

describe("the costs of each arm", () => {
  it("gives interval, exact, each precision from the lowest, and then the stage", () => {
    expect(costRows(report).map((r) => r.arm)).toEqual(["interval", "exact", ...PRECISIONS, "stage"]);
  });

  it("stops when an arm has no cost", () => {
    expect(() => costRows({ ...report, costs: report.costs.filter((c) => c.arm !== "stage") })).toThrow("no cost of the arm stage");
  });

  it("names each arm in plain words", () => {
    expect([armName("64"), armName("stage"), armName("exact")]).toEqual(["bigfloat 64 bits", "the stage", "exact"]);
  });
});

describe("the grid of the verdicts", () => {
  it("has a column for each precision and the stage, and a row for each family and all the families", () => {
    for (const baseline of ["exact", "interval"] as const) {
      const { arms, rows } = verdictGrid(report, baseline);
      expect(arms).toEqual([...PRECISIONS, "stage"]);
      expect(rows.map((r) => r.family)).toEqual([...report.pairs[0]!.families.map((f) => f.family), "all"]);
      for (const row of rows) expect(row.cells.map((c) => c.arm)).toEqual(arms);
    }
  });

  it("gives the verdict of the pair in each cell", () => {
    const { rows } = verdictGrid(report, "exact");
    const pair = report.pairs.find((p) => p.pair === "64-exact")!;
    expect(rows.find((r) => r.family === "ill")!.cells[0]).toEqual({ arm: "64", ...pick(pair.families.find((f) => f.family === "ill")!) });
    expect(rows.at(-1)!.cells[0]).toEqual({ arm: "64", outcome: pair.outcome, medianRatio: pair.medianRatio });
  });

  it("stops when a pair is missing, or has different families", () => {
    expect(() => verdictGrid({ pairs: report.pairs.filter((p) => p.pair !== "stage-interval") }, "interval")).toThrow("no pair of stage with interval");
    const short = report.pairs.map((p) => (p.pair === "128-exact" ? { ...p, families: p.families.slice(1) } : p));
    expect(() => verdictGrid({ pairs: short }, "exact")).toThrow("128-exact does not have the families");
  });
});

describe("the stage in the model of the selector", () => {
  it("adds the cost and the shares of the stage to the model of A6", () => {
    const both = withStage(a6, report);
    expect(both.cost).toEqual({ ...a6.cost, bigfloat: report.model.bigfloat });
    expect(both.shares).toEqual([...a6.shares, ...report.model.shares]);
  });

  it("adds no cost after a failed measure, so the selector leaves the stage out", () => {
    const both: CostModel = withStage(a6, { model: { ...report.model, bigfloat: null } });
    expect(both.cost).toEqual(a6.cost);
  });

  it("gives the plans of the read of A7: the stage is in no plan", () => {
    const plans = stagePlans(a6, report);
    expect(plans.map((p) => [p.question, p.selection.plan])).toEqual([
      ["sign", ["float", "interval", "exact"]],
      ["abs 1e-9", ["float", "interval", "exact"]],
      ["rel 1e-12", ["float", "interval", "exact"]],
      ["rel 0", ["interval", "exact"]],
      ["rel 1e-30", ["interval", "exact"]],
    ]);
    expect(stageVerdict(plans)).toBe("The stage is in no plan of the 5 questions, so it stays a choice of the caller.");
  });

  it("tells when the stage is in a plan", () => {
    const cheap = { ...report, model: { ...report.model, bigfloat: 1 } };
    expect(stageVerdict(stagePlans(a6, cheap))).toBe("The stage is in the plan of 5 of the 5 questions.");
  });

  it("stops when a question of the stage has no row in the model of the stage", () => {
    expect(() => stagePlans(a6, { ...report, stage: [{ ...report.stage[0]!, question: "rel 1e-40" }] })).toThrow("no row of the question rel 1e-40");
  });
});

function pick(f: { readonly outcome: string; readonly medianRatio: number }): { outcome: string; medianRatio: number } {
  return { outcome: f.outcome, medianRatio: f.medianRatio };
}
