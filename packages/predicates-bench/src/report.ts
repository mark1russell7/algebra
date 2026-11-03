/**
 * The report of the bench of A5. Each group of cases gets its own A/A band and its own time verdict of
 * `@mark1russell7/rigor-bench`, with the default rule `difference`. The prediction scores the groups `random` and `near`.
 *
 * @packageDocumentation
 */
import { type Band, type CaseRatio, type PairedTime, type TimeVerdict, aaBand, caseRatios, timeVerdict } from "@mark1russell7/rigor-bench";
import { GROUPS, type Group, groupOf } from "./cases.ts";

/** The report of one group. A ratio is the time of `@mark1russell7/predicates` over the time of `robust-predicates`. */
export interface GroupReport {
  readonly group: Group;
  readonly cases: readonly CaseRatio[];
  /** The A/A band of the group. A group with fewer than 5 A/A cases has no band. */
  readonly band: Band | undefined;
  readonly verdict: Pick<TimeVerdict, "outcome" | "reason" | "interval" | "rule">;
}

/** The report of a run of the bench. */
export interface Report {
  readonly groups: readonly GroupReport[];
}

/**
 * This function gives the report of the records `ab` and the A/A records `aa`. A group without records is not in the
 * report.
 *
 * @param ab - The records of the pair `ab`.
 * @param aa - The records of the pair `aa`.
 * @returns The ratios, the band and the verdict of each group.
 */
export function report(ab: readonly PairedTime[], aa: readonly PairedTime[]): Report {
  const groups: GroupReport[] = [];
  for (const group of GROUPS) {
    const g = ab.filter((r) => groupOf(r.case) === group);
    const h = aa.filter((r) => groupOf(r.case) === group);
    if (g.length === 0) continue;
    const verdict = timeVerdict(g, h);
    const cases = new Set(h.map((r) => r.case)).size;
    groups.push({
      group,
      cases: caseRatios(g),
      band: cases >= 5 ? aaBand(h) : undefined,
      verdict: { outcome: verdict.outcome, reason: verdict.reason, interval: verdict.interval, rule: verdict.rule },
    });
  }
  return { groups };
}

/** This function gives the report as Markdown, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => x.toFixed(3);
  const lines: string[] = ["A ratio is the time of @mark1russell7/predicates over the time of robust-predicates.", ""];
  for (const g of r.groups) {
    lines.push(`## The group ${g.group}`, "");
    lines.push(`Time verdict (rule ${g.verdict.rule}): **${g.verdict.outcome}**. ${g.verdict.reason}`);
    if (g.band !== undefined) lines.push(`A/A band (kind ${g.band.kind}, ${g.band.cases} cases): [${f(g.band.low)}, ${f(g.band.high)}].`);
    lines.push("", "| Case | Ratio | Rounds |", "| --- | --- | --- |", ...g.cases.map((c) => `| ${c.case} | ${f(c.ratio)} | ${c.rounds} |`), "");
  }
  return lines.join("\n");
}
