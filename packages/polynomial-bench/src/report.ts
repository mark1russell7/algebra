/**
 * The report of the bench of A8. It gives the time verdict of each pair. It gives the break-even count of points of one
 * form against the verb `exact`. It also gives the share of the cases with a claim at each tier of limits.
 *
 * @packageDocumentation
 */
import { type CaseRead, type PairedTime, timeVerdict, type TimeVerdict } from "@mark1russell7/rigor-bench";
import { median } from "@mark1russell7/rigor-statistics";
import { familyOf } from "./cases.ts";
import { PAIRS } from "./arms.ts";
import type { ClaimRecord, Verb } from "./claims.ts";

/** The facts of one process of the bench. */
export interface Meta {
  readonly case: string;
  readonly pair: string;
  readonly count: number;
  readonly nodes: number;
}

/** The time verdict of one pair. A ratio is the time of arm `b` over the time of arm `a`. */
export interface PairVerdict {
  readonly pair: string;
  readonly outcome: TimeVerdict["outcome"];
  readonly reason: string;
  readonly medianRatio: number;
  readonly families: readonly { readonly family: string; readonly outcome: TimeVerdict["outcome"]; readonly medianRatio: number }[];
}

/** The straight lines of the two costs of a family, in milliseconds, and the count of points where they cross. */
export interface BreakEven {
  readonly family: string;
  readonly cases: number;
  readonly exactFixed: number;
  readonly exactPoint: number;
  readonly formFixed: number;
  readonly formPoint: number;
  /** The smallest count of points where the form costs less, or `null` when the form does not catch up. */
  readonly points: number | null;
}

/** The share of a verb, a tier and a family with a claim. */
export interface ClaimShare {
  readonly verb: Verb;
  readonly tier: string;
  readonly family: string;
  readonly records: number;
  readonly losers: number;
  readonly noValue: number;
  /** The median time of a record, in milliseconds. Each record is one sample, so this time is not a verdict. */
  readonly medianMs: number;
}

/** The report of a run of the bench. */
export interface Report {
  readonly pairs: readonly PairVerdict[];
  readonly breakEven: readonly BreakEven[];
  readonly claims: readonly ClaimShare[];
  /** The checks that disagree with the verb `exact` or with exact substitution. Each one is a bug. */
  readonly wrong: number;
  /** The checks of the records. */
  readonly checked: number;
  /** The pairs of a case that the bench did not time, with the reason. */
  readonly skipped: readonly { readonly case: string; readonly reason: string }[];
}

const ratioOf = (v: TimeVerdict): number => median(v.cases.map((c) => c.ratio));

/**
 * This function gives two straight lines from a time at 1 point and a time at 64 points.
 *
 * @param at1 - The time of a use at 1 point.
 * @param at64 - The time of a use at 64 points.
 * @returns The fixed cost and the cost of one point.
 */
export function line(at1: number, at64: number): { readonly fixed: number; readonly point: number } {
  const point = (at64 - at1) / 63;
  return { fixed: at1 - point, point };
}

/**
 * This function gives the count of points where the form costs less than the verb `exact`.
 *
 * @returns The count, 1 when the form costs less at each count, or `null` when the form does not catch up.
 */
export function crossing(exact: { readonly fixed: number; readonly point: number }, form: { readonly fixed: number; readonly point: number }): number | null {
  if (form.fixed + form.point <= exact.fixed + exact.point && form.point <= exact.point) return 1;
  if (form.point >= exact.point) return null;
  return Math.ceil((form.fixed - exact.fixed) / (exact.point - form.point));
}

function breakEvenOf(records: Readonly<Record<string, readonly PairedTime[]>>, metas: readonly Meta[]): BreakEven[] {
  const useTime = (pair: string, name: string, arm: "a" | "b"): number | undefined => {
    const count = metas.find((m) => m.pair === pair && m.case === name)?.count;
    const rows = (records[pair] ?? []).filter((r) => r.case === name);
    return count === undefined || rows.length === 0 ? undefined : median(rows.map((r) => r[arm])) / count;
  };
  const names = [...new Set((records["points-64"] ?? []).map((r) => r.case))];
  const lines = names.flatMap((name) => {
    const [e1, e64, f1, f64] = [useTime("points-1", name, "a"), useTime("points-64", name, "a"), useTime("points-1", name, "b"), useTime("points-64", name, "b")];
    if (e1 === undefined || e64 === undefined || f1 === undefined || f64 === undefined) return [];
    return [{ family: familyOf(name), exact: line(e1, e64), form: line(f1, f64) }];
  });
  return [...new Set(lines.map((l) => l.family))].map((family) => {
    const group = lines.filter((l) => l.family === family);
    const exact = { fixed: median(group.map((l) => l.exact.fixed)), point: median(group.map((l) => l.exact.point)) };
    const form = { fixed: median(group.map((l) => l.form.fixed)), point: median(group.map((l) => l.form.point)) };
    return { family, cases: group.length, exactFixed: exact.fixed, exactPoint: exact.point, formFixed: form.fixed, formPoint: form.point, points: crossing(exact, form) };
  });
}

function sharesOf(claims: readonly ClaimRecord[]): ClaimShare[] {
  const groups = new Map<string, ClaimRecord[]>();
  for (const c of claims) {
    const name = JSON.stringify([c.verb, c.tier, c.family]);
    groups.set(name, [...(groups.get(name) ?? []), c]);
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0] as ClaimRecord;
    return {
      verb: first.verb,
      tier: first.tier,
      family: first.family,
      records: rows.length,
      losers: rows.filter((r) => r.kind === "no claim" || r.kind === "error").length,
      noValue: rows.filter((r) => r.kind === "no value").length,
      medianMs: median(rows.map((r) => r.ms)),
    };
  });
}

/**
 * This function gives the report of a run.
 *
 * @param records - The paired times of each pair, and of the A/A pair `aa`.
 * @param metas - The facts of each process.
 * @param claims - The claim records.
 * @param skipped - The pairs that the bench did not time.
 * @returns The report.
 */
export function report(records: Readonly<Record<string, readonly PairedTime[]>>, metas: readonly Meta[], claims: readonly ClaimRecord[], skipped: Report["skipped"]): Report {
  const aa = records["aa"] ?? [];
  const pairs = Object.keys(PAIRS).flatMap((pair) => {
    const ab = records[pair] ?? [];
    if (ab.length === 0) return [];
    const inFamilies = [...new Set(ab.map((r) => familyOf(r.case)))];
    const all = timeVerdict(ab, aa.filter((r) => inFamilies.includes(familyOf(r.case))));
    const families = inFamilies.map((family) => {
      const v = timeVerdict(ab.filter((r) => familyOf(r.case) === family), aa.filter((r) => familyOf(r.case) === family));
      return { family, outcome: v.outcome, medianRatio: ratioOf(v) };
    });
    return [{ pair, outcome: all.outcome, reason: all.reason, medianRatio: ratioOf(all), families }];
  });
  const count = (key: "checked" | "wrong"): number => claims.reduce((all, c) => all + c[key], 0);
  return { pairs, breakEven: breakEvenOf(records, metas), claims: sharesOf(claims), wrong: count("wrong"), checked: count("checked"), skipped };
}

/**
 * This function gives the reads of a report for the check line of `gateLine` of `@mark1russell7/rigor-bench`. The
 * bench states no speed claim, so only `cannot decide` is a no-read. The other time outcomes are reads, not blocks.
 *
 * @param r - The report.
 * @returns One read for each pair and for each family of a pair.
 */
export function checkReads(r: Report): CaseRead[] {
  const read = (name: string, outcome: TimeVerdict["outcome"]): CaseRead => ({ case: name, outcome: outcome === "cannot decide" ? outcome : "within" });
  return r.pairs.flatMap((p) => [read(p.pair, p.outcome), ...p.families.map((f) => read(`${p.pair} ${f.family}`, f.outcome))]);
}

/** This function gives the report as Markdown, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => (Number.isFinite(x) ? x.toPrecision(4) : String(x));
  const families = [...new Set(r.pairs.flatMap((p) => p.families.map((g) => g.family)))];
  return [
    "A ratio is the time of arm `b` over the time of arm `a`. Below 1, arm `b` is faster.",
    "",
    "| Pair | Verdict | Median ratio |",
    "| --- | --- | --- |",
    ...r.pairs.map((p) => `| ${p.pair} | ${p.outcome} | ${f(p.medianRatio)} |`),
    "",
    `| Family | ${r.pairs.map((p) => p.pair).join(" | ")} |`,
    `| --- | ${r.pairs.map(() => "---").join(" | ")} |`,
    ...families.map((family) => `| ${family} | ${r.pairs.map((p) => {
      const g = p.families.find((x) => x.family === family);
      return g === undefined ? "" : `${g.outcome} ${f(g.medianRatio)}`;
    }).join(" | ")} |`),
    "",
    "The break-even count of points: one form against the verb `exact` at the same points. Each time is a median, in milliseconds.",
    "",
    "| Family | Cases | Exact fixed | Exact point | Form fixed | Form point | Points |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...r.breakEven.map((b) => `| ${b.family} | ${b.cases} | ${f(b.exactFixed)} | ${f(b.exactPoint)} | ${f(b.formFixed)} | ${f(b.formPoint)} | ${b.points ?? "no crossing"} |`),
    "",
    `The checks that disagree: **${r.wrong}** of ${r.checked}. The pairs not timed: ${r.skipped.length}.`,
    "",
    "| Verb | Tier | Family | Records | No claim | No value | Median ms |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...r.claims.map((c) => `| ${c.verb} | ${c.tier} | ${c.family} | ${c.records} | ${c.losers} | ${c.noValue} | ${f(c.medianMs)} |`),
    "",
  ].join("\n");
}
