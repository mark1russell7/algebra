/**
 * The report of the bench of A6. It gives the time verdict of the stitched plan against each fixed stage, and the
 * cost of each stage. It gives the share of the points that each arm answers, and the failures of the stitched plan.
 * It also gives the plan that the selector gives from the cost model of the run.
 *
 * @packageDocumentation
 */
import { FAMILIES } from "@algebra/expression-corpus";
import type { Family } from "@algebra/expression-corpus";
import { select, STAGES } from "@algebra/evaluator-select";
import type { CostModel, Stage } from "@algebra/evaluator-select";
import { type CaseRead, type PairedTime, timeVerdict, type TimeVerdict } from "@mark1russell7/rigor-bench";
import { median } from "@mark1russell7/rigor-statistics";
import { ARMS, familyOf, QUESTIONS, questionName } from "./arms.ts";
import { type ErrorRecord, shares, stitchedFails } from "./errors.ts";

/** The facts of one process of the bench. */
export interface Meta {
  readonly case: string;
  readonly pair: string;
  readonly count: number;
  readonly nodes: number;
  readonly points: number;
}

/** A time verdict of the stitched plan against one fixed stage. A ratio is the time of the stitched plan over it. */
export interface PairVerdict {
  readonly stage: Stage;
  readonly outcome: TimeVerdict["outcome"];
  readonly reason: string;
  readonly medianRatio: number;
  readonly families: readonly { readonly family: Family; readonly outcome: TimeVerdict["outcome"]; readonly medianRatio: number }[];
}

/** The answers of one arm for one question. */
export interface ArmErrors {
  readonly arm: string;
  readonly question: string;
  readonly met: number;
  readonly records: number;
  /** The answers with a rational `x` that do not contain it. Each one is a bug of an evaluator. */
  readonly wrong: number;
  /** The median error bound of the answers that meet the question, or `null`. */
  readonly medianBound: number | null;
}

/** The report of a run of the bench. */
export interface Report {
  readonly pairs: readonly PairVerdict[];
  /** The cost model of the run: the median time of one call of each stage for one node and one point, in nanoseconds. */
  readonly model: CostModel;
  readonly errors: readonly ArmErrors[];
  /** The records of the stitched arm that fail. The prediction `algebra-A6` scores this count. */
  readonly stitchedFailures: number;
  /** The plan that the selector gives for each question from the model of the run. */
  readonly selections: readonly { readonly question: string; readonly plan: readonly Stage[]; readonly expectedCost: number }[];
}

const ratioOf = (v: TimeVerdict): number => median(v.cases.map((c) => c.ratio));

/** This function gives the median time of one call of arm `a` for one node and one point, in nanoseconds. */
export function costOf(records: readonly PairedTime[], metas: readonly Meta[], pair: string, arm: "a" | "b"): number {
  const perCase = metas
    .filter((m) => m.pair === pair)
    .map((m) => median(records.filter((r) => r.case === m.case).map((r) => r[arm])) / m.count / m.points / m.nodes);
  return perCase.length === 0 ? Number.NaN : median(perCase) * 1e6;
}

/**
 * This function gives the report of a run.
 *
 * @param records - The paired times of each pair: `float`, `ball`, `interval`, `exact` and the A/A pair `aa`.
 * @param metas - The facts of each process.
 * @param errors - The error records.
 * @returns The report.
 */
export function report(records: Readonly<Record<string, readonly PairedTime[]>>, metas: readonly Meta[], errors: readonly ErrorRecord[]): Report {
  const aa = records["aa"] ?? [];
  const pairs = STAGES.flatMap((stage) => {
    const ab = records[stage] ?? [];
    if (ab.length === 0) return [];
    const all = timeVerdict(ab, aa);
    const families = FAMILIES.flatMap((family) => {
      const g = ab.filter((r) => familyOf(r.case) === family);
      if (g.length === 0) return [];
      const v = timeVerdict(g, aa.filter((r) => familyOf(r.case) === family));
      return [{ family, outcome: v.outcome, medianRatio: ratioOf(v) }];
    });
    return [{ stage, outcome: all.outcome, reason: all.reason, medianRatio: ratioOf(all), families }];
  });
  const cost = Object.fromEntries(STAGES.map((stage) => [stage, costOf(records[stage] ?? [], metas, stage, "a")])) as Record<Stage, number>;
  const model: CostModel = { cost, shares: shares(errors) };
  const armErrors = QUESTIONS.flatMap((question) =>
    ARMS.map((arm) => {
      const rows = errors.filter((r) => r.arm === arm && r.question === questionName(question));
      const bounds = rows.filter((r) => r.met && r.bound !== null).map((r) => r.bound as number);
      return {
        arm,
        question: questionName(question),
        met: rows.filter((r) => r.met).length,
        records: rows.length,
        wrong: rows.filter((r) => r.contains === false && r.kind === "value").length,
        medianBound: bounds.length === 0 ? null : median(bounds),
      };
    }),
  );
  const selections = STAGES.every((s) => Number.isFinite(cost[s]))
    ? QUESTIONS.map((question) => ({ question: questionName(question), ...select(question, model) }))
    : [];
  return { pairs, model, errors: armErrors, stitchedFailures: errors.filter(stitchedFails).length, selections };
}

/**
 * This function gives the reads of a report for the check line of `gateLine` of `@mark1russell7/rigor-bench`. The
 * bench states no speed claim, so only `cannot decide` is a no-read. The other time outcomes are reads, not blocks.
 *
 * @param r - The report.
 * @returns One read for each fixed stage and for each family of a stage.
 */
export function checkReads(r: Report): CaseRead[] {
  const read = (name: string, outcome: TimeVerdict["outcome"]): CaseRead => ({ case: name, outcome: outcome === "cannot decide" ? outcome : "within" });
  return r.pairs.flatMap((p) => [read(p.stage, p.outcome), ...p.families.map((f) => read(`${p.stage} ${f.family}`, f.outcome))]);
}

/** This function gives the report as Markdown, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => (Number.isFinite(x) ? x.toPrecision(4) : String(x));
  return [
    "A ratio is the time of the stitched plan over the time of the fixed stage. Below 1, the stitched plan is faster.",
    "",
    "| Fixed stage | Verdict | Median ratio | " + FAMILIES.join(" | ") + " |",
    "| --- | --- | --- | " + FAMILIES.map(() => "---").join(" | ") + " |",
    ...r.pairs.map((p) => `| ${p.stage} | ${p.outcome} | ${f(p.medianRatio)} | ${FAMILIES.map((fam) => {
      const g = p.families.find((x) => x.family === fam);
      return g === undefined ? "" : `${g.outcome} ${f(g.medianRatio)}`;
    }).join(" | ")} |`),
    "",
    `The stitched answers that fail: **${r.stitchedFailures}**.`,
    "",
    "| Stage | Cost (ns for one node and one point) |",
    "| --- | --- |",
    ...STAGES.map((s) => `| ${s} | ${f(r.model.cost[s])} |`),
    "",
    "| Question | Arm | Answered | Wrong | Median bound |",
    "| --- | --- | --- | --- | --- |",
    ...r.errors.map((e) => `| ${e.question} | ${e.arm} | ${e.met} of ${e.records} | ${e.wrong} | ${e.medianBound === null ? "" : f(e.medianBound)} |`),
    "",
    "| Question | Selected plan | Expected cost (ns) |",
    "| --- | --- | --- |",
    ...r.selections.map((s) => `| ${s.question} | ${s.plan.join(", ")} | ${f(s.expectedCost)} |`),
    "",
  ].join("\n");
}
