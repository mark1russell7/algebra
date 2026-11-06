import fs from "node:fs";
import { type CostModel, select, type Selection } from "@algebra/evaluator-select";
import { corpusCase } from "@algebra/expression-corpus";
import type { PairedTime } from "@mark1russell7/rigor-bench";
import { describe, expect, it } from "vitest";
import { ARMS, corpusCaseOf, errorRecords, familyOf, markdown, type Meta, QUESTIONS, questionOf, report, runOf, stitchedFails } from "./index.ts";

describe("the arms", () => {
  it("give a finite sum for each arm, and the question of each family", () => {
    const c = corpusCase("orient-near", 1, { points: 8 });
    for (const arm of ARMS) expect(Number.isFinite(runOf(c, arm)())).toBe(true);
    expect(questionOf("orient-near")).toEqual({ kind: "sign" });
    expect(questionOf("ill").kind).toBe("value");
    expect(corpusCaseOf("ill/s3")).toEqual(corpusCase("ill", 3));
    expect(familyOf("well/s2")).toBe("well");
  });
});

describe("the error records", () => {
  it("have one record for each point, question and arm, and no failure of the stitched plan", () => {
    for (const family of ["small", "well", "ill", "incircle-near"] as const) {
      const c = corpusCase(family, 2, { points: 6 });
      const rows = errorRecords(c);
      expect(rows.length).toBe(6 * QUESTIONS.length * ARMS.length);
      expect(rows.filter(stitchedFails), family).toEqual([]);
      for (const r of rows.filter((r) => r.arm === "exact" && r.exact === "rational")) expect(r.met).toBe(true);
      for (const r of rows.filter((r) => r.kind === "value" && r.contains !== null)) expect(r.contains, JSON.stringify(r)).toBe(true);
    }
  });
});

describe("the report", () => {
  const rec = (name: string, round: number, ratio: number): PairedTime => ({ case: name, round, first: round % 2 === 0 ? "a" : "b", a: 10, b: 10 * ratio });
  const names = [1, 2, 3, 4, 5, 6].map((s) => `well/s${s}`);
  const series = (ratio: number): PairedTime[] => names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, ratio + r * 0.001)));

  it("gives faster for a ratio of 0.1, and the cost of each stage", () => {
    const records = { float: series(1.5), ball: series(1.2), interval: series(0.9), exact: series(0.1), aa: series(1) };
    const metas: Meta[] = ["float", "ball", "interval", "exact", "aa"].flatMap((pair) => names.map((n) => ({ case: n, pair, count: 10, nodes: 5, points: 64 })));
    const r = report(records, metas, errorRecords(corpusCase("well", 1, { points: 4 })));
    expect(r.pairs.find((p) => p.stage === "exact")?.outcome).toBe("faster");
    expect(r.pairs.find((p) => p.stage === "float")?.outcome).toBe("slower");
    expect(r.model.cost.float).toBeCloseTo((10 / 10 / 64 / 5) * 1e6, 6);
    expect(r.stitchedFailures).toBe(0);
    expect(r.selections.length).toBe(QUESTIONS.length);
    expect(markdown(r)).toContain("| exact | faster |");
  });
});

describe("the kept results", () => {
  // The monthly study keeps one run, in a folder named by its day.
  const results = new URL("../results/", import.meta.url);
  const days = fs.readdirSync(results).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
  const kept = (file: string): unknown => JSON.parse(fs.readFileSync(new URL(`${days[0] ?? "none"}/${file}`, results), "utf8"));

  it("are one run", () => {
    expect(days).toHaveLength(1);
  });

  it("give the plans of the report from the kept cost model", () => {
    const model = kept("model.json") as CostModel;
    const { selections } = kept("report.json") as { selections: readonly (Selection & { question: string })[] };
    expect(selections.map(({ question: _, ...selection }) => selection)).toEqual(QUESTIONS.map((q) => select(q, model)));
    expect(model.cost.float).toBeLessThan(model.cost.exact);
    expect(model.cost.bigfloat).toBeUndefined();
  });
});
