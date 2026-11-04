/**
 * The arms and the pairs of the bench of A7. An arm operates on a case of the corpus. It is one of these:
 *
 * - the verb `bigfloat` at one precision
 * - the verb `exact` or the verb `interval`
 * - the stage `bigfloat` of `@algebra/evaluator-select`, which raises the precision
 *
 * In a pair, arm `a` is the arm with the verb `bigfloat`. `timeRounds` of `@mark1russell7/rigor-bench` sets the size of a
 * batch from arm `a`. The verb `bigfloat` at a high precision can be 1000 times slower than the verb `interval`.
 * With that slow arm in `b`, one batch can take seconds on each case.
 *
 * @packageDocumentation
 */
import { questionOf } from "@algebra/evaluator-bench";
import { stitch } from "@algebra/evaluator-select";
import type { CorpusCase } from "@algebra/expression-corpus";
import { compileBigfloat, compileExact, compileInterval, NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";

/** The verbs that the pairs compare with the verb `bigfloat`. */
export type Baseline = "exact" | "interval";

/** The baselines, in the order of the report. */
export const BASELINES: readonly Baseline[] = ["exact", "interval"];

/** An arm: a baseline, the stage that raises the precision, or the verb `bigfloat` at a precision in bits. */
export type ArmName = Baseline | "stage" | number;

/** The precisions of the bench, in bits. */
export const PRECISIONS: readonly number[] = [64, 128, 256, 512, 1024, 2048, 4096];

/** The limit of the stage in the bench, in bits. */
export const LIMIT = 4096;

/** The precision of the two arms of the A/A pair, in bits. */
export const AA_PRECISION = 256;

/** The name of the A/A pair. */
export const AA = "aa";

/** A pair of arms. */
export interface Pair {
  readonly a: ArmName;
  readonly b: ArmName;
}

/**
 * This function gives the names of the pairs of a run, with the A/A pair first and the costly pairs last. Thus a run that
 * stops keeps its A/A pair, the stage and its low precisions on each case.
 *
 * @param precisions - The precisions of the run, in bits.
 * @returns The names: `aa`, then `stage-<baseline>`, then `<precision>-<baseline>` from the lowest precision.
 */
export function pairNames(precisions: readonly number[]): readonly string[] {
  const sorted = [...precisions].sort((x, y) => x - y);
  return [AA, ...BASELINES.map((b) => `stage-${b}`), ...sorted.flatMap((p) => BASELINES.map((b) => `${p}-${b}`))];
}

/**
 * This function gives the arms of a pair name.
 *
 * @param name - A name from `pairNames`.
 * @returns The two arms.
 * @throws RangeError when the name is not the name of a pair.
 */
export function pairOf(name: string): Pair {
  if (name === AA) return { a: AA_PRECISION, b: AA_PRECISION };
  const [arm, baseline, ...rest] = name.split("-");
  const a = arm === "stage" ? arm : Number(arm);
  const known = a === "stage" || (Number.isSafeInteger(a) && a >= 1);
  if (!known || rest.length > 0 || !BASELINES.includes(baseline as Baseline)) throw new RangeError(`not a pair: ${name}`);
  return { a, b: baseline as Baseline };
}

/** This function gives the value of a compiled document, or throws the error of coeval. */
function made<T>(c: CorpusCase, r: { ok: true; value: T } | { ok: false; error: { reason: string } }): T {
  if (!r.ok) throw new Error(`The case ${c.name} does not compile: ${r.error.reason}`);
  return r.value;
}

/** This function gives the function of one point of an arm. Each function gives a number, so the work stays. */
function pointOf(c: CorpusCase, arm: ArmName, limit: number): (p: ArrayLike<number>) => number {
  const options = { variables: c.variables };
  if (arm === "interval") {
    const f = made(c, compileInterval(c.document, options));
    return (p) => {
      const r = f.evaluate(p);
      return r === null || r === NO_CLAIM ? 0 : r[0] - r[0] === 0 ? r[0] : 0;
    };
  }
  if (arm === "exact") {
    const f = made(c, compileExact(c.document, options));
    return (p) => {
      const r = f.evaluate(p);
      return r === null || r === NO_CLAIM ? 0 : Q.sign(r);
    };
  }
  if (arm === "stage") {
    const s = stitch(c.document, questionOf(c.family), { ...options, plan: ["bigfloat"], precision: { limit } });
    return (p) => {
      const a = s.answer(p);
      return (a.sign ?? 0) + (a.value - a.value === 0 ? a.value : 0);
    };
  }
  const f = made(c, compileBigfloat(c.document, options));
  return (p) => {
    const r = f.evaluate(p, arm);
    return r === null || r === NO_CLAIM ? 0 : r.low.sign + r.high.sign;
  };
}

/**
 * This function gives the timed use of an arm on a case: one call at each point of the case. Each arm of a process uses
 * it in its own instance of this module, so the two loops do not share type feedback.
 *
 * @param c - The corpus case.
 * @param arm - The arm.
 * @param limit - The limit of the stage, in bits.
 * @returns The function of one use. It gives a sum that keeps the work.
 */
export function runOf(c: CorpusCase, arm: ArmName, limit: number): () => number {
  const at = pointOf(c, arm, limit);
  const points = c.points.map((p) => Float64Array.from(p));
  return () => {
    let sum = 0;
    for (const p of points) sum += at(p);
    return sum;
  };
}
