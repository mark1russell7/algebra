/**
 * The stage `bigfloat` of a plan (roadmap item A7). It starts the verb `bigfloat` at a precision, and doubles the precision
 * until the claim meets the question. It stops at a stated limit, and it gives no answer past that limit.
 *
 * This stage is not in `STAGES`. Its cost depends on the count of doublings, so an expected cost needs a measured cost
 * from a bench.
 *
 * @packageDocumentation
 */
import type { BigfloatFunction, BigInput } from "@mark1russell7/expression";
import { bigfloatClaim, NOTHING } from "./claim.ts";
import type { Claim } from "./claim.ts";
import { meets } from "./question.ts";
import type { Question } from "./question.ts";

/** The first precision of the stage, in bits, when the caller does not select one. */
export const START_PRECISION = 64;

/** The precisions of the stage `bigfloat`. */
export interface PrecisionLimit {
  /** The largest precision in bits. The stage makes no call past it. */
  readonly limit: number;
  /** The first precision in bits. The default is `START_PRECISION`, or `limit` when that is smaller. */
  readonly start?: number;
}

/**
 * This function gives the precisions of the stage: the start, its doublings, and then the limit.
 *
 * @param precision - The limit and the start.
 * @returns The precisions, in increasing order. The last one is the limit.
 * @throws RangeError when a precision is not a whole number of 1 or more, or when the start is past the limit.
 */
export function precisions(precision: PrecisionLimit): readonly number[] {
  const { limit, start = Math.min(START_PRECISION, limit) } = precision;
  for (const p of [limit, start]) {
    if (!Number.isSafeInteger(p) || p < 1) throw new RangeError(`not a precision: ${p}`);
  }
  if (start > limit) throw new RangeError(`The start ${start} is past the limit ${limit}.`);
  const out = [start];
  for (let p = start; p < limit; p = Math.min(2 * p, limit)) out.push(Math.min(2 * p, limit));
  return out;
}

/**
 * This function raises the precision until a claim meets the question. The claim `no claim` of a low precision does not
 * stop the stage, because a narrower interval can decide a divisor or a root. A claim of no real value stops it. Past
 * the limit, the result is `NOTHING`, so the stage gives no answer. A value past the range of a `BigFloat` gives
 * `NOTHING` too.
 *
 * @param f - The document, compiled with the verb `bigfloat`.
 * @param values - The value of each variable. A value can have more bits than a double.
 * @param question - The question.
 * @param ladder - The precisions of the tries, from `precisions`.
 * @returns The first claim that meets the question, or `NOTHING`.
 */
export function raise(f: BigfloatFunction, values: ArrayLike<BigInput>, question: Question, ladder: readonly number[]): Claim {
  for (const precision of ladder) {
    try {
      const claim = bigfloatClaim(f.evaluate(values, precision), precision);
      if (meets(claim, question)) return claim;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return NOTHING;
    }
  }
  return NOTHING;
}
