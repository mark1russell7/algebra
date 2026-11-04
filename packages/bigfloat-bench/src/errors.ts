/**
 * The error records of the stage `bigfloat`. For each case, point and question, a record keeps the answer and the
 * precision of the answer. It also keeps the stated error, and the real error against the exact value of `compileExact`.
 * The records keep the losers too. A point with no answer has a record with `met: false`.
 *
 * @packageDocumentation
 */
import * as B from "@algebra/bigfloat";
import { contains, QUESTIONS, questionName } from "@algebra/evaluator-bench";
import { stitch } from "@algebra/evaluator-select";
import type { Answer, Question, ShareRow } from "@algebra/evaluator-select";
import type { CorpusCase } from "@algebra/expression-corpus";
import { compileExact, NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/** The questions of the error records: the questions of A6, and a tolerance that a double cannot hold. */
export const STAGE_QUESTIONS: readonly Question[] = [...QUESTIONS, { kind: "value", tolerance: { relative: 1e-30 } }];

/** One error record of the stage. */
export interface StageRecord {
  readonly case: string;
  readonly point: number;
  readonly question: string;
  readonly kind: Answer["kind"];
  readonly met: boolean;
  /** The precision of the answer in bits, or `null` without an interval. */
  readonly precision: number | null;
  /** The stated error of the double value. JSON writes `Infinity` as `null`. */
  readonly bound: number | null;
  /** The stated error of the interval, rounded to a float, or `null` without an interval. */
  readonly bigBound: number | null;
  /** The real error `|value - x|`, rounded to a float, or `null` without a rational `x` or a value. */
  readonly actual: number | null;
  /** The exact value: `rational`, `none` for no real value, or `no claim`. */
  readonly exact: "rational" | "none" | "no claim";
  /** `true` when the answer and its interval contain `x`, or `null` without a rational `x` or a value. */
  readonly contains: boolean | null;
}

const finite = (x: number): number | null => (x - x === 0 ? x : null);

/** This function tells if the answer and its interval contain `x`. */
function holds(a: Answer, x: Rational): boolean {
  const big = a.big;
  if (big === undefined) return contains(a, x);
  return contains(a, x) && Q.compare(B.toRational(big.low), x) <= 0 && Q.compare(x, B.toRational(big.high)) <= 0;
}

/**
 * This function gives the error records of the stage on one case.
 *
 * @param c - The corpus case.
 * @param limit - The limit of the stage, in bits.
 * @returns One record for each point and question.
 */
export function stageRecords(c: CorpusCase, limit: number): StageRecord[] {
  const ex = compileExact(c.document, { variables: c.variables });
  if (!ex.ok) throw new Error(`The case ${c.name} does not compile: ${ex.error.reason}`);
  const options = { variables: c.variables, plan: ["bigfloat"], precision: { limit } } as const;
  const stages = STAGE_QUESTIONS.map((question) => stitch(c.document, question, options));
  const out: StageRecord[] = [];
  c.points.forEach((p, point) => {
    const x = ex.value.evaluate(p);
    const rational = x !== null && x !== NO_CLAIM ? x : undefined;
    for (const s of stages) {
      const a = s.answer(p);
      const value = a.kind === "value" && a.value - a.value === 0;
      out.push({
        case: c.name,
        point,
        question: questionName(s.question),
        kind: a.kind,
        met: a.met,
        precision: a.big?.precision ?? null,
        bound: finite(a.error),
        bigBound: a.big === undefined ? null : finite(B.toNumber(a.big.error)),
        actual: rational !== undefined && value ? Q.toNumber(Q.abs(Q.sub(Q.fromFloat(a.value), rational))) : null,
        exact: x === null ? "none" : x === NO_CLAIM ? "no claim" : "rational",
        contains: rational !== undefined && a.kind === "value" ? holds(a, rational) : null,
      });
    }
  });
  return out;
}

/**
 * This function gives the share of the points that the stage answers for each question, from the records.
 *
 * @param records - The error records.
 * @returns One row for each question.
 */
export function stageShares(records: readonly StageRecord[]): ShareRow[] {
  return STAGE_QUESTIONS.map((question) => {
    const rows = records.filter((r) => r.question === questionName(question));
    return { question, stage: "bigfloat", share: rows.length === 0 ? 0 : rows.filter((r) => r.met).length / rows.length };
  });
}
