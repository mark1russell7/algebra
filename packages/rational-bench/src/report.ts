/**
 * The report of the bench. It has the ratio of each case with its interval, the A/A band and the time verdict of
 * `@mark1russell7/rigor-bench`. It also has the outcome of the time claim of A2, from `limitVerdict`.
 *
 * @packageDocumentation
 */
import { type Band, type CaseLimit, type LimitOutcome, type PairedTime, type TimeVerdict, limitVerdict, timeVerdict } from "@mark1russell7/rigor-bench";

/** The report of a run of the bench. */
export interface Report {
  readonly limit: number;
  readonly level: number;
  /** The interval, the bound and the outcome of each case, from `limitVerdict`. */
  readonly cases: readonly CaseLimit[];
  readonly band: Band;
  readonly verdict: Pick<TimeVerdict, "outcome" | "reason" | "interval" | "rule">;
  readonly claim: { readonly outcome: LimitOutcome; readonly reason: string };
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
  const claim = limitVerdict(ab, aa, { limit, caseLevel: level });
  if (claim.band === undefined) throw new RangeError(`report: ${claim.reason}`);
  const verdict = timeVerdict(ab, aa);
  const largest = claim.cases.reduce((top, c) => (c.ratio > top.ratio ? c : top));
  return {
    limit,
    level,
    cases: claim.cases,
    band: claim.band,
    verdict: { outcome: verdict.outcome, reason: verdict.reason, interval: verdict.interval, rule: verdict.rule },
    claim: { outcome: claim.outcome, reason: claim.reason },
    largest: largest.case,
    within: claim.outcome === "within",
  };
}

/** This function gives the report as a Markdown table, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => x.toFixed(3);
  const lines = [
    `Claim (ratio new / old at most ${r.limit} in each case): **${r.within ? "holds" : "does not hold"}** (${r.claim.outcome}). ${r.claim.reason}`,
    "",
    `A/A band (kind ${r.band.kind}, ${r.band.cases} cases): [${f(r.band.low)}, ${f(r.band.high)}], A/A median ${f(r.band.median)}.`,
    `Time verdict (rule ${r.verdict.rule}): ${r.verdict.outcome}. ${r.verdict.reason}`,
    `The case with the largest ratio: ${r.largest}.`,
    "",
    `| Case | Ratio | Interval (${r.level}) | Bound | Outcome |`,
    "| --- | --- | --- | --- | --- |",
    ...r.cases.map((c) => `| ${c.case} | ${f(c.ratio)} | [${f(c.low)}, ${f(c.high)}] | ${f(c.bound)} | ${c.outcome} |`),
  ];
  return lines.join("\n") + "\n";
}
