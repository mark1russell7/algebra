/**
 * The report of the bench. It has the ratio of each case with its interval, the A/A band and the time verdict of
 * `@mark1russell7/rigor-bench`. It also has the outcome of the time claim of A2.
 *
 * @packageDocumentation
 */
import { type Band, type PairedTime, type TimeVerdict, aaBand, caseRatios, timeVerdict } from "@mark1russell7/rigor-bench";
import { medianInterval } from "@mark1russell7/rigor-statistics";

/** The ratio of one case, new over old, with the interval of its median. */
export interface CaseResult {
  readonly case: string;
  /** The median ratio of the rounds, from `caseRatios`. */
  readonly ratio: number;
  readonly rounds: number;
  /** The ends of the interval of the median ratio: `exp` of `medianInterval` over the log ratios of the rounds. */
  readonly low: number;
  readonly high: number;
  /** The coverage of the interval. It is at least the level. */
  readonly coverage: number;
  /** The high end of the interval, times the high end of the A/A band. The claim compares this value with the limit. */
  readonly bound: number;
  readonly within: boolean;
}

/** The report of a run of the bench. */
export interface Report {
  readonly limit: number;
  readonly level: number;
  readonly cases: readonly CaseResult[];
  readonly band: Band;
  readonly verdict: Pick<TimeVerdict, "outcome" | "reason" | "interval" | "rule">;
  /** The case with the largest median ratio. */
  readonly largest: string;
  /** True when the bound of each case is at most the limit. */
  readonly within: boolean;
}

/** The options of a report. */
export interface ReportOptions {
  /** The largest ratio new over old that the claim permits. The default is 2. */
  readonly limit?: number;
  /** The level of the interval of each case. The default is 0.95. */
  readonly level?: number;
}

/**
 * This function gives the report of the records `ab` (old in arm `a`, new in arm `b`) and the A/A records `aa`.
 *
 * @throws RangeError when the A/A pair has fewer than 5 cases, or when a record is not a correct `PairedTime`.
 */
export function report(ab: readonly PairedTime[], aa: readonly PairedTime[], options: ReportOptions = {}): Report {
  const limit = options.limit ?? 2;
  const level = options.level ?? 0.95;
  const band = aaBand(aa);
  const verdict = timeVerdict(ab, aa);
  const cases = caseRatios(ab).map((c): CaseResult => {
    const logs = ab.filter((r) => r.case === c.case).map((r) => Math.log(r.b / r.a));
    const interval = medianInterval(logs, level);
    const high = Math.exp(interval.high);
    const bound = high * band.high;
    return { case: c.case, ratio: c.ratio, rounds: c.rounds, low: Math.exp(interval.low), high, coverage: interval.coverage, bound, within: bound <= limit };
  });
  const largest = cases.reduce((top, c) => (c.ratio > top.ratio ? c : top), cases[0]!);
  return {
    limit,
    level,
    cases,
    band,
    verdict: { outcome: verdict.outcome, reason: verdict.reason, interval: verdict.interval, rule: verdict.rule },
    largest: largest.case,
    within: cases.every((c) => c.within),
  };
}

/** This function gives the report as a Markdown table, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => x.toFixed(3);
  const lines = [
    `Claim (ratio new / old at most ${r.limit} in each case): **${r.within ? "holds" : "does not hold"}**.`,
    "",
    `A/A band (kind ${r.band.kind}, ${r.band.cases} cases): [${f(r.band.low)}, ${f(r.band.high)}], A/A median ${f(r.band.median)}.`,
    `Time verdict (rule ${r.verdict.rule}): ${r.verdict.outcome}. ${r.verdict.reason}`,
    `The case with the largest ratio: ${r.largest}.`,
    "",
    `| Case | Ratio | Interval (${r.level}) | Bound | Within |`,
    "| --- | --- | --- | --- | --- |",
    ...r.cases.map((c) => `| ${c.case} | ${f(c.ratio)} | [${f(c.low)}, ${f(c.high)}] | ${f(c.bound)} | ${c.within ? "yes" : "no"} |`),
  ];
  return lines.join("\n") + "\n";
}
