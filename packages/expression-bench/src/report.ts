/**
 * The report of the bench of A3. The claim of A3 is a limit: the time of `compileFloat` is at most 1.5 times the time
 * of the written function. `limitVerdict` of `@mark1russell7/rigor-bench` gives the verdict of all the cases, and of
 * the cases of each family.
 *
 * @packageDocumentation
 */
import { FAMILIES } from "@algebra/expression-corpus";
import type { Family } from "@algebra/expression-corpus";
import { type Band, type CaseLimit, type LimitOutcome, type PairedTime, limitVerdict, timeVerdict, type TimeVerdict } from "@mark1russell7/rigor-bench";
import { median } from "@mark1russell7/rigor-statistics";
import { familyOf } from "./cases.ts";

/** The limit of the claim of A3: the largest ratio of the time of `compileFloat` over the time of the written function. */
export const LIMIT = 1.5;

/** The limit of the prediction `algebra-A3-tape`: the ratio of the tape over the written function with a bound. */
export const BOUND_LIMIT = 5;

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

function verdict(ab: readonly PairedTime[], aa: readonly PairedTime[], limit: number): Verdict {
  const v = limitVerdict(ab, aa, { limit });
  return { outcome: v.outcome, reason: v.reason, band: v.band, medianRatio: median(v.cases.map((c) => c.ratio)), cases: v.cases };
}

/**
 * This function gives the report of the records `ab` and the A/A records `aa`.
 *
 * @param ab - The records of the pair `ab`.
 * @param aa - The records of the pair `aa`.
 * @param limit - The limit of the ratio.
 * @returns The verdict of all the cases and of each family.
 */
export function report(ab: readonly PairedTime[], aa: readonly PairedTime[], limit: number = LIMIT): Report {
  const families = FAMILIES.flatMap((family) => {
    const g = ab.filter((r) => familyOf(r.case) === family);
    const h = aa.filter((r) => familyOf(r.case) === family);
    return g.length === 0 ? [] : [{ family, ...verdict(g, h, limit) }];
  });
  return { limit, all: verdict(ab, aa, limit), families };
}

/** A time verdict of two arms, with the median ratio of the cases, for all the cases and for each family. */
export interface Speed {
  readonly outcome: TimeVerdict["outcome"];
  readonly medianRatio: number;
  readonly families: readonly { readonly family: Family; readonly outcome: TimeVerdict["outcome"]; readonly medianRatio: number }[];
}

const ratioOf = (v: TimeVerdict): number => median(v.cases.map((c) => c.ratio));

/**
 * This function gives the time verdict of arm `b` against arm `a`. A ratio below 1 tells that arm `b` is faster.
 *
 * @param ab - The records of the pair.
 * @param aa - The records of the pair `aa`.
 * @returns The verdict of all the cases and of each family.
 */
export function speed(ab: readonly PairedTime[], aa: readonly PairedTime[]): Speed {
  const all = timeVerdict(ab, aa);
  const families = FAMILIES.flatMap((family) => {
    const g = ab.filter((r) => familyOf(r.case) === family);
    if (g.length === 0) return [];
    const v = timeVerdict(g, aa.filter((r) => familyOf(r.case) === family));
    return [{ family, outcome: v.outcome, medianRatio: ratioOf(v) }];
  });
  return { outcome: all.outcome, medianRatio: ratioOf(all), families };
}

/** This function gives a time verdict as Markdown. */
export function speedMarkdown(s: Speed, title: string): string {
  const f = (x: number): string => x.toFixed(3);
  return [
    `${title}: **${s.outcome}**, median ratio ${f(s.medianRatio)}.`,
    "",
    "| Family | Verdict | Median ratio |",
    "| --- | --- | --- |",
    ...s.families.map((g) => `| ${g.family} | ${g.outcome} | ${f(g.medianRatio)} |`),
    "",
  ].join("\n");
}

/** This function gives the report as Markdown, for the summary of a run. */
export function markdown(r: Report, title: string = "A ratio is the time of compileFloat over the time of the written function. The claim of A3 is a ratio of at most 1.5."): string {
  const f = (x: number): string => x.toFixed(3);
  const band = (b: Band | undefined): string => (b === undefined ? "no A/A band" : `A/A band [${f(b.low)}, ${f(b.high)}]`);
  const lines: string[] = [
    title,
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
