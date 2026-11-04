import type { PairedTime } from "@mark1russell7/rigor-bench";
import { describe, expect, it } from "vitest";
import { armsOf, benchCase, caseNames, claimRecords, crossing, familyOf, GENERATED, isRootFamily, line, markdown, type Meta, pairsOf, report, runOf, TIERS } from "./index.ts";

describe("the cases", () => {
  it("name each family, and give one document for one name", () => {
    const names = caseNames();
    expect(new Set(names).size).toBe(names.length);
    expect(benchCase("quotient-v2-d3-t4/s3")).toEqual(benchCase("quotient-v2-d3-t4/s3"));
    expect(benchCase("quotient-v2-d3-t4/s3")).not.toEqual(benchCase("quotient-v2-d3-t4/s4"));
    expect(benchCase("well/s1").family).toBe("well");
    expect(() => benchCase("small/s1")).toThrow(RangeError);
    expect(() => benchCase("well")).toThrow(RangeError);
    expect(isRootFamily("dense-roots-d8")).toBe(true);
    expect(isRootFamily("quotient-v1-d4-t3")).toBe(false);
  });

  it("each family has a form for its first seed at the default limits", () => {
    for (const family of Object.keys(GENERATED).filter((name) => !name.endsWith("d64") && !name.includes("v4"))) {
      const rows = claimRecords(benchCase(`${family}/s1`), [TIERS[TIERS.length - 1]!]);
      for (const row of rows.filter((r) => r.verb !== "polynomial")) expect(row.kind, JSON.stringify(row)).not.toBe("no claim");
      expect(rows.reduce((all, row) => all + row.wrong, 0)).toBe(0);
    }
  });

  it("keeps the losers, with the agreement of each claim", () => {
    const rows = claimRecords(benchCase("expand-v3-d6-t8/s1"));
    expect(rows).toHaveLength(TIERS.length * 2);
    expect(rows.filter((r) => r.wrong > 0)).toEqual([]);
    expect(rows.filter((r) => r.kind === "polynomial").every((r) => r.checked === 8)).toBe(true);
    const solved = claimRecords(benchCase("mixed-roots-d12/s2"));
    expect(solved.filter((r) => r.verb === "solve" && r.tier === "default")[0]).toMatchObject({ kind: "roots", wrong: 0 });
    expect(claimRecords(benchCase("mixed-roots-d12/s2"), [{ name: "tiny", products: 1 / 2 ** 22, bits: 1 }]).map((r) => r.kind)).toContain("no claim");
  });
});

describe("the arms", () => {
  it("have the pairs of each family, and each arm of a pair gives one answer", () => {
    for (const family of ["well", "expand-v2-d4-t4", "quotient-v1-d4-t3", "rational-roots-d8"]) {
      const c = benchCase(`${family}/s1`);
      for (const pair of pairsOf(family)) {
        const [a, b] = armsOf(pair, family);
        expect(Number.isFinite(runOf(c, a)()), `${family} ${a}`).toBe(true);
        expect(Number.isFinite(runOf(c, b)()), `${family} ${b}`).toBe(true);
      }
    }
    expect(pairsOf("well")).toContain("verbs");
    expect(pairsOf("quotient-v1-d4-t3")).not.toContain("verbs");
    expect(pairsOf("dense-roots-d8")).toEqual(["solve", "aa"]);
    expect(armsOf("aa", "dense-roots-d8")).toEqual(["solve-64", "solve-64"]);
    expect(armsOf("aa", "well")).toEqual(["form-64", "form-64"]);
  });

  it("gives one answer for the two arms of a pair of points", () => {
    const c = benchCase("quotient-v1-d4-t3/s2");
    expect(runOf(c, "exact-64")()).toBe(runOf(c, "form-64")());
    expect(runOf(c, "exact-1")()).toBe(runOf(c, "form-1")());
    expect(runOf(c, "points-equal")()).toBe(64);
    expect(runOf(c, "keys-equal")()).toBeGreaterThan(0);
    expect(runOf(benchCase("sum-v1-d3-t3/s1"), "solve-64")()).toBeGreaterThanOrEqual(0);
  });
});

describe("the report", () => {
  it("gives the straight line and the crossing", () => {
    expect(line(2, 65)).toEqual({ fixed: 1, point: 1 });
    expect(crossing({ fixed: 1, point: 2 }, { fixed: 11, point: 1 })).toBe(10);
    expect(crossing({ fixed: 5, point: 2 }, { fixed: 1, point: 1 })).toBe(1);
    expect(crossing({ fixed: 1, point: 1 }, { fixed: 5, point: 1 })).toBeNull();
    expect(crossing({ fixed: 1, point: 1 }, { fixed: 5, point: 2 })).toBeNull();
  });

  it("gives a verdict for each pair, a break-even count and each share", () => {
    const paired = (name: string, a: number, b: number): PairedTime[] =>
      Array.from({ length: 31 }, (_, round) => ({ case: name, round, first: round % 2 === 0 ? "a" : "b", a: a * (1 + (round % 3) / 100), b: b * (1 + (round % 5) / 100) }));
    const names = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => `quotient-v1-d4-t3/s${seed}`);
    const records = {
      "points-1": names.flatMap((n) => paired(n, 2, 12)),
      "points-64": names.flatMap((n) => paired(n, 128, 75)),
      aa: names.flatMap((n) => paired(n, 5, 5)),
    };
    const metas: Meta[] = names.flatMap((n) => ["points-1", "points-64"].map((pair) => ({ case: n, pair, count: 1, nodes: 10 })));
    const claims = claimRecords(benchCase(names[0]!));
    const r = report(records, metas, claims, [{ case: "x/s1", reason: "test" }]);
    expect(r.pairs.map((p) => p.pair)).toEqual(["points-1", "points-64"]);
    expect(r.pairs[0]?.outcome).toBe("slower");
    expect(r.pairs[1]?.outcome).toBe("faster");
    expect(r.breakEven).toHaveLength(1);
    // the medians are 1.01 and 1.02 times the times: exact 2.02 for each point, form 11.22 and then 1.02 for each point
    expect(r.breakEven[0]).toMatchObject({ family: familyOf(names[0]!), cases: 8, points: 12 });
    expect(r.wrong).toBe(0);
    expect(r.checked).toBeGreaterThan(0);
    expect(r.claims).toHaveLength(TIERS.length * 2);
    expect(markdown(r)).toContain("| points-64 | faster |");
  });
});
