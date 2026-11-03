/**
 * The error records of the bench of A6. For each case, point, question and arm, a record keeps the answer and its stage.
 * It also keeps the error bound, and the real error against the exact value of `compileExact`. The records keep the
 * losers too. A fixed stage that does not answer a question has a record with `met: false`.
 *
 * @packageDocumentation
 */
import type { CorpusCase } from "@algebra/expression-corpus";
import type { Answer, Question, ShareRow, Stage } from "@algebra/evaluator-select";
import { STAGES } from "@algebra/evaluator-select";
import { compileExact, NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { answerOf, ARMS, type ArmName, QUESTIONS, questionName } from "./arms.ts";

/** One error record. */
export interface ErrorRecord {
  readonly case: string;
  readonly point: number;
  readonly question: string;
  readonly arm: ArmName;
  /** The stage that gave the answer. */
  readonly stage: Stage;
  readonly kind: Answer["kind"];
  readonly met: boolean;
  /** The error bound of the answer. JSON writes `Infinity` as `null`. */
  readonly bound: number | null;
  /** The real error `|value - x|`, rounded to a float, or `null` without a rational `x` or a value. */
  readonly actual: number | null;
  /** The exact value: `rational`, `none` for no real value, or `no claim`. */
  readonly exact: "rational" | "none" | "no claim";
  /** `true` when the answer contains `x`, or `null` without a rational `x`. */
  readonly contains: boolean | null;
}

const q = (x: number): Rational => Q.fromFloat(x);

/** This function tells if an answer contains `x`: in `[low, high]`, and at most `error` from `value`. */
export function contains(a: Answer, x: Rational): boolean {
  if (a.kind !== "value") return false;
  const low = a.low === -Infinity || (a.low < Infinity && Q.compare(q(a.low), x) <= 0);
  const high = a.high === Infinity || (a.high > -Infinity && Q.compare(x, q(a.high)) <= 0);
  const near = !(a.error < Infinity) || !(a.value - a.value === 0) || Q.compare(Q.abs(Q.sub(q(a.value), x)), q(a.error)) <= 0;
  return low && high && near;
}

const finite = (x: number): number | null => (x - x === 0 ? x : null);

/**
 * This function gives the error records of one case.
 *
 * @param c - The corpus case.
 * @returns One record for each point, question and arm.
 */
export function errorRecords(c: CorpusCase): ErrorRecord[] {
  const ex = compileExact(c.document, { variables: c.variables });
  if (!ex.ok) throw new Error(`The case ${c.name} does not compile: ${ex.error.reason}`);
  const answers = QUESTIONS.flatMap((question) => ARMS.map((arm) => ({ question, arm, answer: answerOf(c, arm, question) })));
  const out: ErrorRecord[] = [];
  c.points.forEach((p, point) => {
    const x = ex.value.evaluate(p);
    const exact = x === null ? "none" : x === NO_CLAIM ? "no claim" : "rational";
    for (const { question, arm, answer } of answers) {
      const a = answer(p);
      const rational = x !== null && x !== NO_CLAIM ? x : undefined;
      const actual = rational !== undefined && a.kind === "value" && a.value - a.value === 0 ? Q.toNumber(Q.abs(Q.sub(q(a.value), rational))) : null;
      out.push({
        case: c.name,
        point,
        question: questionName(question),
        arm,
        stage: a.stage,
        kind: a.kind,
        met: a.met,
        bound: finite(a.error),
        actual,
        exact,
        contains: rational === undefined ? null : contains(a, rational),
      });
    }
  });
  return out;
}

/**
 * This function tells if a record of the stitched arm fails: with a rational `x`, the answer must contain it and meet
 * its question. With no real value, the answer must be `no value`.
 */
export function stitchedFails(r: ErrorRecord): boolean {
  if (r.arm !== "stitched") return false;
  if (r.exact === "rational") return !(r.met && r.contains === true);
  if (r.exact === "none") return !(r.met && r.kind === "no value");
  return false;
}

/**
 * This function gives the share of the points that each fixed stage answers for each question, from the records.
 *
 * @param records - The error records.
 * @returns One row for each question and stage.
 */
export function shares(records: readonly ErrorRecord[]): ShareRow[] {
  return QUESTIONS.flatMap((question: Question) =>
    STAGES.map((stage) => {
      const rows = records.filter((r) => r.arm === stage && r.question === questionName(question));
      return { question, stage, share: rows.length === 0 ? 0 : rows.filter((r) => r.met).length / rows.length };
    }),
  );
}
