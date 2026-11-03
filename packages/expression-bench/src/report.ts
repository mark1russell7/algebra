/**
 * The report of the bench of A3. The claim of A3 is a limit: the time of `compileFloat` is at most 1.5 times the time
 * of the written function. `limitVerdict` of `@mark1russell7/rigor-bench` gives the verdict of all the cases, and of
 * the cases of each family.
 *
 * @packageDocumentation
 */
import { FAMILIES } from "@algebra/expression-corpus";
import type { Family } from "@algebra/expression-corpus";
import { type Band, type CaseLimit, type LimitOutcome, type PairedTime, limitVerdict } from "@mark1russell7/rigor-bench";
import { median } from "@mark1russell7/rigor-statistics";
import { familyOf } from "./cases.ts";

/** The limit of the claim of A3: the largest ratio of the time of `compileFloat` over the time of the written function. */
export const LIMIT = 1.5;

/** A limit verdict with its facts. A ratio is the time of `compileFloat` over the time of the written function. */
export interface Verdict {
  readonly outcome: LimitOutcome;
  readonly reason: string;
  readonly band: Band | undefined;
  /** The median of the ratios of the cases. */
  readonly medianRatio: number;
  readonly cases: readonly CaseLimit[];
}

/** The report of a run of the bench. */
export interface Report {
  readonly limit: number;
  /** The verdict of all the cases. The prediction `algebra-A12` scores this verdict. */
  readonly all: Verdict;
  /** The verdict of the cases of each family with records. */
  readonly families: readonly (Verdict & { readonly family: Family })[];
}

function verdict(ab: readonly PairedTime[], aa: readonly PairedTime[]): Verdict {
  const v = limitVerdict(ab, aa, { limit: LIMIT });
  return { outcome: v.outcome, reason: v.reason, band: v.band, medianRatio: median(v.cases.map((c) => c.ratio)), cases: v.cases };
}

/**
 * This function gives the report of the records `ab` and the A/A records `aa`.
 *
 * @param ab - The records of the pair `ab`.
 * @param aa - The records of the pair `aa`.
 * @returns The verdict of all the cases and of each family.
 */
export function report(ab: readonly PairedTime[], aa: readonly PairedTime[]): Report {
  const families = FAMILIES.flatMap((family) => {
    const g = ab.filter((r) => familyOf(r.case) === family);
    const h = aa.filter((r) => familyOf(r.case) === family);
    return g.length === 0 ? [] : [{ family, ...verdict(g, h) }];
  });
  return { limit: LIMIT, all: verdict(ab, aa), families };
}

/** This function gives the report as Markdown, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => x.toFixed(3);
  const band = (b: Band | undefined): string => (b === undefined ? "no A/A band" : `A/A band [${f(b.low)}, ${f(b.high)}]`);
  const lines: string[] = [
    "A ratio is the time of compileFloat over the time of the written function. The claim of A3 is a ratio of at most 1.5.",
    "",
    `All the cases: **${r.all.outcome}**, median ratio ${f(r.all.medianRatio)}, ${band(r.all.band)}. ${r.all.reason}`,
    "",
    "| Family | Verdict | Median ratio | A/A band |",
    "| --- | --- | --- | --- |",
    ...r.families.map((g) => `| ${g.family} | ${g.outcome} | ${f(g.medianRatio)} | ${band(g.band)} |`),
    "",
    "| Case | Ratio | Interval | Bound | Outcome |",
    "| --- | --- | --- | --- | --- |",
    ...r.all.cases.map((c) => `| ${c.case} | ${f(c.ratio)} | [${f(c.low)}, ${f(c.high)}] | ${f(c.bound)} | ${c.outcome} |`),
    "",
  ];
  return lines.join("\n");
}
