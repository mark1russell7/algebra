import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sharePercent, sumOfSets } from "./census-view.ts";
import type { CensusFile, ClassId } from "./census-view.ts";

const results = new URL("../../predicate-census/results/", import.meta.url);
const file = JSON.parse(readFileSync(new URL("../data/census-classes.json", import.meta.url), "utf8")) as CensusFile;

interface Report {
  readonly totals: { readonly total: number; readonly undecided: number; readonly floatWrong: number };
  readonly floatWrongClasses: Record<ClassId, { readonly tests: number }>;
  readonly floatWrongSites: Record<string, number>;
}

const report = (set: string): Report => JSON.parse(readFileSync(new URL(`2026-11-05-highways/report-${set}.json`, results), "utf8")) as Report;

describe("the data of the census section", () => {
  it("has the seven sets", () => {
    expect(file.highways.sets.map((s) => s.set)).toEqual(["exact-v1", "exact-v1-bounds", "fixtures", "fixtures-large", "screen-v1", "screen-v2", "screen-v3"]);
  });

  it("gives the numbers of the kept report of each set", () => {
    for (const s of file.highways.sets) {
      const r = report(s.set);
      expect({ tests: s.tests, undecided: s.undecided, floatWrong: s.floatWrong }).toEqual({ tests: r.totals.total, undecided: r.totals.undecided, floatWrong: r.totals.floatWrong });
      expect(s.classes).toEqual({ 1: r.floatWrongClasses[1].tests, 2: r.floatWrongClasses[2].tests, 3: r.floatWrongClasses[3].tests, 4: r.floatWrongClasses[4].tests });
    }
  });

  it("gives the sum of the sites of the kept reports", () => {
    const sums = new Map<string, number>();
    for (const s of file.highways.sets) for (const [key, n] of Object.entries(report(s.set).floatWrongSites)) sums.set(key, (sums.get(key) ?? 0) + n);
    const given = new Map(file.highways.sites.map((s) => [`${s.class} ${s.fn} ${s.via}`, s.tests]));
    expect(given).toEqual(sums);
  });

  it("gives the numbers of the kept report of packing", () => {
    const r = JSON.parse(gunzipSync(readFileSync(new URL(`2026-11-04-packing/report-${file.packing.set}.json.gz`, results))).toString("utf8")) as Report;
    expect({ tests: file.packing.tests, undecided: file.packing.undecided, floatWrong: file.packing.floatWrong }).toEqual({ tests: r.totals.total, undecided: r.totals.undecided, floatWrong: r.totals.floatWrong });
  });
});

describe("the sum and the shares", () => {
  const all = sumOfSets(file.highways.sets);

  it("has class counts that give the float-wrong count", () => {
    expect(all.classes[1] + all.classes[2] + all.classes[3] + all.classes[4]).toBe(all.floatWrong);
    expect(all.floatWrong).toBe(35865);
  });

  it("gives a share in percent, and 0 for an empty set", () => {
    expect(sharePercent(all, 1)).toBe(0);
    expect(sharePercent(all, 2)).toBeCloseTo((33815 / 35865) * 100, 10);
    expect(sharePercent({ set: "none", tests: 0, undecided: 0, floatWrong: 0, classes: { 1: 0, 2: 0, 3: 0, 4: 0 } }, 2)).toBe(0);
  });
});
