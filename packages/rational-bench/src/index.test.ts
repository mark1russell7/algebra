import * as fresh from "@mark1russell7/rational";
import { type PairedTime, firstArm } from "@mark1russell7/rigor-bench";
import { describe, expect, it } from "vitest";
import { casesFor, markdown, report } from "./index.ts";
import * as old from "./old-rational.ts";

describe("the cases", () => {
  const arms = { old: casesFor(old), new: casesFor(fresh) };

  it("are the 32 rational steps of the tests of quantity, with unique names", () => {
    expect(arms.new).toHaveLength(32);
    expect(new Set(arms.new.map((c) => c.name)).size).toBe(32);
  });

  for (const [arm, cases] of Object.entries(arms)) {
    it(`give the values of the tests of quantity with the ${arm} rationals`, () => {
      for (const c of cases) {
        if (c.digits === undefined) expect(c.run(), c.name).toBe(c.expected);
        else expect(c.run(), c.name).toBeCloseTo(c.expected, c.digits);
      }
    });
  }

  it("give the same value in the two arms", () => {
    expect(arms.old.map((c) => c.run())).toEqual(arms.new.map((c) => c.run()));
  });
});

/** This function makes the records of `cases` cases with a ratio `ratio` and a small spread over the rounds. */
function records(cases: number, ratio: number): PairedTime[] {
  const rows: PairedTime[] = [];
  for (let c = 0; c < cases; c++) {
    for (let round = 0; round < 11; round++) {
      const wobble = 1 + ((round * 7 + c * 3) % 5) / 500;
      rows.push({ case: `case-${c}`, round, first: firstArm(round, c), a: 10, b: 10 * ratio * wobble });
    }
  }
  return rows;
}

describe("the report", () => {
  it("holds the claim for a ratio of 0.8, and names the case with the largest ratio", () => {
    const ab = records(6, 0.8).map((r) => (r.case === "case-3" ? { ...r, b: r.b * 1.2 } : r));
    const r = report(ab, records(6, 1));
    expect(r.within).toBe(true);
    expect(r.largest).toBe("case-3");
    expect(r.verdict.outcome).toBe("faster");
    expect(r.cases.every((c) => c.low <= c.ratio && c.ratio <= c.high && c.bound >= c.high)).toBe(true);
    expect(markdown(r)).toContain("**holds**");
  });

  it("refuses the claim when one case is above the limit", () => {
    const ab = records(6, 0.8).map((r) => (r.case === "case-0" ? { ...r, b: r.b * 3 } : r));
    const r = report(ab, records(6, 1));
    expect(r.within).toBe(false);
    expect(r.cases.find((c) => c.case === "case-0")?.within).toBe(false);
  });
});
