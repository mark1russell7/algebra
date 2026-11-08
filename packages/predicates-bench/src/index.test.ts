import { describe, expect, it } from "vitest";
import { gateLine, type PairedTime } from "@mark1russell7/rigor-bench";
import { casesFor, checkReads, GROUPS, markdown, predicates, report, robust, SEEDS } from "./index.ts";

describe("the cases", () => {
  const a = casesFor(robust);
  const b = casesFor(predicates);

  it("are 16 in each group", () => {
    expect(a).toHaveLength(GROUPS.length * 2 * SEEDS.length);
    for (const g of GROUPS) expect(a.filter((c) => c.group === g)).toHaveLength(16);
  });

  it("give the same sum of signs in the two arms", () => {
    for (const [i, c] of a.entries()) expect(b[i]!.run(), c.name).toBe(c.run());
  });
});

describe("the report", () => {
  it("gives a verdict for each group with records", () => {
    const rec = (name: string, round: number, ratio: number): PairedTime => ({ case: name, round, first: round % 2 === 0 ? "a" : "b", a: 10, b: 10 * ratio });
    const names = SEEDS.map((s) => `orient2d/random/s${s}`);
    const ab = names.flatMap((n) => [0, 1, 2, 3, 4].map((r) => rec(n, r, 3)));
    const aa = names.flatMap((n) => [0, 1, 2, 3, 4].map((r) => rec(n, r, 1 + (r - 2) * 0.01)));
    const r = report(ab, aa);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.verdict.outcome).toBe("slower");
    expect(markdown(r)).toContain("## The group random");
    // No speed claim: a slower group is a read, so the check line has nothing to show.
    expect(checkReads(r)).toEqual([{ case: "random", outcome: "within" }]);
    expect(gateLine(checkReads(r), { title: "bench-predicates" })).toBeUndefined();
    const line = gateLine(checkReads(report(ab, aa.slice(0, 5))), { title: "bench-predicates" });
    expect(line).toMatchObject({ outcome: "no read", noReads: { count: 1, cases: ["random"] } });
  });
});
