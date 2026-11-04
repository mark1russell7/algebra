/**
 * The report of the bench of A7. It gives the time verdict of each baseline against the verb `bigfloat` at each precision
 * and against the stage. It gives the cost of each arm, the error records of the stage, and the facts for a cost model of
 * the selector.
 *
 * @packageDocumentation
 */
import { costOf, familyOf, questionName } from "@algebra/evaluator-bench";
import type { Meta } from "@algebra/evaluator-bench";
import type { ShareRow } from "@algebra/evaluator-select";
import { FAMILIES } from "@algebra/expression-corpus";
import type { Family } from "@algebra/expression-corpus";
import { type PairedTime, timeVerdict, type TimeVerdict } from "@mark1russell7/rigor-bench";
import { median } from "@mark1russell7/rigor-statistics";
import { AA, type ArmName, type Baseline, pairOf } from "./arms.ts";
import { STAGE_QUESTIONS, type StageRecord, stageShares } from "./errors.ts";

/** A verdict needs this count of A/A cases, as `aaBand` of `@mark1russell7/rigor-bench` does. */
const MIN_CASES = 5;

/** One time verdict. A ratio is the time of the baseline over the time of the arm with the verb `bigfloat`. */
export interface PairVerdict {
  readonly pair: string;
  readonly baseline: Baseline;
  readonly arm: number | "stage";
  /** `faster` tells that the baseline is faster than the verb `bigfloat`. */
  readonly outcome: TimeVerdict["outcome"];
  readonly reason: string;
  readonly medianRatio: number;
  readonly families: readonly { readonly family: Family; readonly outcome: TimeVerdict["outcome"]; readonly medianRatio: number }[];
}

/** The cost of one arm. */
export interface ArmCost {
  readonly arm: string;
  /** The median time of one call for one node and one point, in nanoseconds. */
  readonly cost: number;
}

/** The answers of the stage for one question. */
export interface StageErrors {
  readonly question: string;
  readonly met: number;
  readonly records: number;
  /** The answers with a rational `x` that do not contain it. Each one is a bug. */
  readonly wrong: number;
  /** The median and the largest precision of the answers that meet the question, or `null`. */
  readonly medianPrecision: number | null;
  readonly maxPrecision: number | null;
  /** The median stated error of the intervals of the answers, or `null`. */
  readonly medianBound: number | null;
}

/** The facts for a cost model of the selector. The cost holds only for the limit of the run. */
export interface StageModel {
  /** The limit of the stage in the run, in bits. */
  readonly limit: number;
  /** The cost of one call of the stage for one node and one point, in the unit of the model of A6. */
  readonly bigfloat: number;
  readonly shares: readonly ShareRow[];
}

/** The report of a run of the bench. */
export interface Report {
  readonly pairs: readonly PairVerdict[];
  readonly costs: readonly ArmCost[];
  readonly stage: readonly StageErrors[];
  readonly model: StageModel;
}

const ratioOf = (v: TimeVerdict): number => median(v.cases.map((c) => c.ratio));
const caseCount = (records: readonly PairedTime[]): number => new Set(records.map((r) => r.case)).size;

/** This function gives the verdict of records against the A/A records, or `undefined` with too few cases. */
function verdictOf(records: readonly PairedTime[], aa: readonly PairedTime[]): TimeVerdict | undefined {
  return caseCount(records) === 0 || caseCount(aa) < MIN_CASES ? undefined : timeVerdict(records, aa);
}

/** This function gives the verdict of a pair, with a verdict for each family that has enough cases. */
function pairVerdict(pair: string, records: readonly PairedTime[], aa: readonly PairedTime[]): PairVerdict | undefined {
  const all = verdictOf(records, aa);
  if (all === undefined) return undefined;
  const { a, b } = pairOf(pair);
  const families = FAMILIES.flatMap((family) => {
    const v = verdictOf(
      records.filter((r) => familyOf(r.case) === family),
      aa.filter((r) => familyOf(r.case) === family),
    );
    return v === undefined ? [] : [{ family, outcome: v.outcome, medianRatio: ratioOf(v) }];
  });
  return { pair, baseline: b as Baseline, arm: a as number | "stage", outcome: all.outcome, reason: all.reason, medianRatio: ratioOf(all), families };
}

/** This function gives the median cost of an arm over the pairs that have it. */
function armCost(arm: ArmName, records: Readonly<Record<string, readonly PairedTime[]>>, metas: readonly Meta[]): number {
  const costs = Object.entries(records).flatMap(([pair, rows]) => {
    const { a, b } = pairOf(pair);
    return [...(a === arm ? [costOf(rows, metas, pair, "a")] : []), ...(b === arm ? [costOf(rows, metas, pair, "b")] : [])];
  });
  const known = costs.filter(Number.isFinite);
  return known.length === 0 ? Number.NaN : median(known);
}

/** This function gives the answers of the stage for one question. */
function stageErrors(records: readonly StageRecord[], question: string): StageErrors {
  const rows = records.filter((r) => r.question === question);
  const met = rows.filter((r) => r.met);
  const precisions = met.flatMap((r) => (r.precision === null ? [] : [r.precision]));
  const bounds = met.flatMap((r) => (r.bigBound === null ? [] : [r.bigBound]));
  return {
    question,
    met: met.length,
    records: rows.length,
    wrong: rows.filter((r) => r.contains === false).length,
    medianPrecision: precisions.length === 0 ? null : median(precisions),
    maxPrecision: precisions.length === 0 ? null : Math.max(...precisions),
    medianBound: bounds.length === 0 ? null : median(bounds),
  };
}

/**
 * This function gives the report of a run. It takes a part of the pairs, so a run that stops still has a report.
 *
 * @param records - The paired times of each pair, with the A/A pair `aa`.
 * @param metas - The facts of each process.
 * @param errors - The error records of the stage.
 * @param limit - The limit of the stage, in bits.
 * @returns The report.
 */
export function report(records: Readonly<Record<string, readonly PairedTime[]>>, metas: readonly Meta[], errors: readonly StageRecord[], limit: number): Report {
  const aa = records[AA] ?? [];
  const names = Object.keys(records).filter((pair) => pair !== AA);
  const pairs = names.flatMap((pair) => pairVerdict(pair, records[pair] as readonly PairedTime[], aa) ?? []);
  const arms = [...new Set(Object.keys(records).flatMap((pair) => Object.values(pairOf(pair))))];
  const costs = arms.map((arm) => ({ arm: String(arm), cost: armCost(arm, records, metas) })).sort((x, y) => x.cost - y.cost);
  const stage = STAGE_QUESTIONS.map((question) => stageErrors(errors, questionName(question)));
  return { pairs, costs, stage, model: { limit, bigfloat: armCost("stage", records, metas), shares: stageShares(errors) } };
}

/** This function gives the report as Markdown, for the summary of a run. */
export function markdown(r: Report): string {
  const f = (x: number): string => (Number.isFinite(x) ? x.toPrecision(4) : String(x));
  const blank = (x: number | null): string => (x === null ? "" : f(x));
  return [
    "A ratio is the time of the baseline over the time of the arm with the verb `bigfloat`. Below 1, the baseline is faster.",
    "",
    "| Arm | Baseline | Verdict for the baseline | Median ratio | " + FAMILIES.join(" | ") + " |",
    "| --- | --- | --- | --- | " + FAMILIES.map(() => "---").join(" | ") + " |",
    ...r.pairs.map((p) => `| ${p.arm} | ${p.baseline} | ${p.outcome} | ${f(p.medianRatio)} | ${FAMILIES.map((fam) => {
      const g = p.families.find((x) => x.family === fam);
      return g === undefined ? "" : `${g.outcome} ${f(g.medianRatio)}`;
    }).join(" | ")} |`),
    "",
    "| Arm | Cost (ns for one node and one point) |",
    "| --- | --- |",
    ...r.costs.map((c) => `| ${c.arm} | ${f(c.cost)} |`),
    "",
    `The limit of the stage: ${r.model.limit} bits.`,
    "",
    "| Question | Answered | Wrong | Median precision | Largest precision | Median bound |",
    "| --- | --- | --- | --- | --- | --- |",
    ...r.stage.map((s) => `| ${s.question} | ${s.met} of ${s.records} | ${s.wrong} | ${blank(s.medianPrecision)} | ${blank(s.maxPrecision)} | ${blank(s.medianBound)} |`),
    "",
  ].join("\n");
}
