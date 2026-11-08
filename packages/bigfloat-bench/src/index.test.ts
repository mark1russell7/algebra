import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Meta } from "@algebra/evaluator-bench";
import { corpusCaseOf } from "@algebra/evaluator-bench";
import { corpusCase } from "@algebra/expression-corpus";
import { nodeCount } from "@algebra/expression-corpus";
import type { PairedTime } from "@mark1russell7/rigor-bench";
import { gateLine, timeRounds } from "@mark1russell7/rigor-bench";
import { describe, expect, it } from "vitest";
import { AA, AA_PRECISION, type ArmName, BASELINES, checkReads, LIMIT, markdown, pairNames, pairOf, PRECISIONS, report, runOf, STAGE_QUESTIONS, stageRecords } from "./index.ts";

describe("the pairs", () => {
  it("have each precision and the stage against each baseline, and one A/A pair first", () => {
    const names = pairNames(PRECISIONS);
    expect(names[0]).toBe(AA);
    expect(names.length).toBe(1 + (PRECISIONS.length + 1) * BASELINES.length);
    expect(new Set(names).size).toBe(names.length);
    for (const p of PRECISIONS) for (const b of BASELINES) expect(names).toContain(`${p}-${b}`);
    expect(names.indexOf("64-exact")).toBeLessThan(names.indexOf("4096-exact"));
  });

  it("have the verb bigfloat in arm a, because arm a sets the size of a batch", () => {
    expect(pairOf(AA)).toEqual({ a: AA_PRECISION, b: AA_PRECISION });
    expect(pairOf("512-interval")).toEqual({ a: 512, b: "interval" });
    expect(pairOf("stage-exact")).toEqual({ a: "stage", b: "exact" });
    for (const bad of ["", "x-exact", "64-float", "64", "0-exact", "1.5-exact", "64-exact-x"]) expect(() => pairOf(bad), bad).toThrow(RangeError);
  });
});

describe("the arms", () => {
  it("give a finite sum for each arm", () => {
    const c = corpusCase("ill", 1, { points: 4 });
    const arms: readonly ArmName[] = ["interval", "exact", "stage", 64, 4096];
    for (const arm of arms) expect(Number.isFinite(runOf(c, arm, LIMIT)()), String(arm)).toBe(true);
  });
});

describe("the error records", () => {
  it("have one record for each point and question, and no wrong answer", () => {
    for (const family of ["small", "well", "ill", "incircle-near"] as const) {
      const rows = stageRecords(corpusCase(family, 2, { points: 6 }), LIMIT);
      expect(rows.length).toBe(6 * STAGE_QUESTIONS.length);
      expect(rows.filter((r) => r.contains === false)).toEqual([]);
      for (const r of rows.filter((r) => r.met && r.kind === "value")) expect(r.precision, family).toBeGreaterThanOrEqual(64);
      for (const r of rows.filter((r) => r.exact === "none")) expect(r.kind, family).not.toBe("value");
    }
  });

  it("keep the points past the limit, with no answer", () => {
    const rows = stageRecords(corpusCase("ill", 1, { points: 4 }), 1);
    const lost = rows.filter((r) => !r.met);
    expect(lost.length).toBeGreaterThan(0);
    for (const r of lost) expect(r).toMatchObject({ kind: "no claim", precision: null, bound: null, contains: null });
  });
});

describe("the report", () => {
  const names = [1, 2, 3, 4, 5, 6].map((s) => `small/s${s}`);

  it("gives a verdict of each pair from paired records of one small case each", () => {
    const records: Record<string, PairedTime[]> = {};
    const metas: Meta[] = [];
    for (const pair of pairNames(PRECISIONS)) {
      records[pair] = [];
      names.forEach((name, offset) => {
        const c = corpusCase("small", offset + 1, { points: 2 });
        const { a, b } = pairOf(pair);
        const result = timeRounds({ a: runOf(c, a, LIMIT), b: runOf(c, b, LIMIT) }, { case: name, rounds: 4, offset, targetMs: 0.1, warmMs: 0 });
        records[pair]!.push(...result.records);
        metas.push({ case: name, pair, count: result.count, nodes: nodeCount(c.document), points: c.points.length });
      });
    }
    const errors = names.flatMap((name) => stageRecords(corpusCase("small", Number(name.slice(-1)), { points: 2 }), LIMIT));
    const r = report(records, metas, errors, LIMIT);
    expect(r.pairs.length).toBe(pairNames(PRECISIONS).length - 1);
    for (const p of r.pairs) expect(["faster", "slower", "same", "cannot decide"], p.pair).toContain(p.outcome);
    expect(r.costs.map((c) => c.arm).sort()).toEqual([...PRECISIONS.map(String), "exact", "interval", "stage"].sort());
    for (const c of r.costs) expect(c.cost, c.arm).toBeGreaterThan(0);
    expect(r.model).toMatchObject({ limit: LIMIT, bigfloat: r.costs.find((c) => c.arm === "stage")?.cost });
    expect(r.model.shares.length).toBe(STAGE_QUESTIONS.length);
    expect(r.stage.every((s) => s.wrong === 0)).toBe(true);
    const text = markdown(r);
    for (const line of ["| 64 | exact |", "| 4096 | interval |", "| stage | exact |", "| rel 1e-30 |"]) expect(text).toContain(line);
  }, 60_000);

  const rec = (name: string, round: number, ratio: number): PairedTime => ({ case: name, round, first: round % 2 === 0 ? "a" : "b", a: 10, b: 10 * ratio });
  const series = (ratio: number): PairedTime[] => names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, ratio + r * 0.001)));

  it("gives the verdict of the baseline, and takes a run that stopped", () => {
    const records = { [AA]: series(1), "64-interval": series(0.1), "64-exact": series(10) };
    const metas: Meta[] = Object.keys(records).flatMap((pair) => names.map((n) => ({ case: n, pair, count: 10, nodes: 5, points: 64 })));
    const r = report(records, metas, [], LIMIT);
    expect(r.pairs.find((p) => p.pair === "64-interval")).toMatchObject({ arm: 64, baseline: "interval", outcome: "faster" });
    expect(r.pairs.find((p) => p.pair === "64-exact")).toMatchObject({ arm: 64, baseline: "exact", outcome: "slower" });
    expect(r.costs.find((c) => c.arm === "64")?.cost).toBeCloseTo((10 / 10 / 64 / 5) * 1e6, 6);
    expect(Number.isNaN(r.model.bigfloat)).toBe(true);
    expect(report({ [AA]: [] }, [], [], LIMIT).pairs).toEqual([]);
    const few = metas.filter((m) => m.pair === "64-exact" || m.case === names[0]);
    const short = report({ [AA]: series(1).slice(0, 8), "64-exact": series(1) }, few, [], LIMIT);
    expect(short.pairs).toEqual([
      expect.objectContaining({ pair: "64-exact", outcome: "cannot decide", reason: "The A/A arm has 1 cases, and a band needs 5 or more.", medianRatio: expect.closeTo(1.0035, 3) }),
    ]);
    expect(short.pairs[0]?.families).toEqual([{ family: "small", outcome: "cannot decide", medianRatio: expect.closeTo(1.0035, 3) }]);
  });

  it("gives a no-read for each pair and family that cannot decide, and not for a slower baseline", () => {
    const records = { [AA]: series(1), "64-exact": series(10) };
    const metas: Meta[] = Object.keys(records).flatMap((pair) => names.map((n) => ({ case: n, pair, count: 10, nodes: 5, points: 64 })));
    const decided = report(records, metas, [], LIMIT);
    expect(checkReads(decided)).toEqual([
      { case: "64-exact", outcome: "within" },
      { case: "64-exact small", outcome: "within" },
    ]);
    expect(gateLine(checkReads(decided), { title: "bench-bigfloat" })).toBeUndefined();
    const few = metas.filter((m) => m.pair === "64-exact" || m.case === names[0]);
    const short = report({ [AA]: series(1).slice(0, 8), "64-exact": series(10) }, few, [], LIMIT);
    const line = gateLine(checkReads(short), { title: "bench-bigfloat" });
    expect(line).toMatchObject({ outcome: "no read", level: "warning", noReads: { count: 2, cases: ["64-exact", "64-exact small"] } });
  });
});

describe("the process of one case", () => {
  it("writes the paired records and the facts", () => {
    expect(corpusCaseOf("small/s2").document).toBeDefined();
    const child = fileURLToPath(new URL("./child.ts", import.meta.url));
    const r = spawnSync(process.execPath, [child, "small/s2", "64-exact", "2", "0", "1", String(LIMIT)], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    const lines = r.stdout.trim().split("\n").map((line) => JSON.parse(line) as PairedTime | { meta: Meta });
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatchObject({ case: "small/s2", round: 0 });
    expect(lines[2]).toMatchObject({ meta: { case: "small/s2", pair: "64-exact", points: 64 } });
    expect(spawnSync(process.execPath, [child], { encoding: "utf8" }).status).toBe(2);
  }, 30_000);
});
