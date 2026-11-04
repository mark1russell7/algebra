/**
 * The questions to an expression at a point, and the rule that tells if a claim answers a question.
 *
 * @packageDocumentation
 */
import * as B from "@algebra/bigfloat";
import { interval as I } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { BigClaim, Claim } from "./claim.ts";

/**
 * A tolerance of a value: an absolute bound of `|value - x|`, or a bound relative to `|x|`. The bound is a float of
 * zero or more. A bound of zero asks for the exact value.
 */
export type Tolerance = { readonly absolute: number } | { readonly relative: number };

/**
 * A question to an expression at a point.
 *
 * - `value`: a float value within the tolerance of the exact value `x`.
 * - `sign`: the sign of `x`: `-1`, `0` or `1`. A comparison gives `1` for true and `0` for false, so the sign of a
 *   comparison is its truth value.
 */
export type Question = { readonly kind: "value"; readonly tolerance: Tolerance } | { readonly kind: "sign" };

/** This function refuses a tolerance that is negative or not a number. */
export function checkTolerance(t: Tolerance): void {
  const bound = "absolute" in t ? t.absolute : t.relative;
  if (!(bound >= 0)) throw new RangeError(`A tolerance must be zero or more, not ${bound}.`);
}

/**
 * This function tells if a value and a bound of its error meet a tolerance. The test of a relative tolerance `r` is
 * `error * (1 + r) <= r * |value|`, with each float operation rounded against the test. From it, `error <= r * |x|`.
 *
 * @param value - The float value.
 * @param error - The bound of `|value - x|`.
 * @param t - The tolerance.
 * @returns `true` when the claim meets the tolerance.
 */
export function within(value: number, error: number, t: Tolerance): boolean {
  if ("absolute" in t) return error <= t.absolute;
  if (error === 0) return true;
  if (!(error < Infinity) || !(value - value === 0)) return false;
  const left = I.nextUp(error + I.nextUp(error * t.relative));
  return left <= I.nextDown(t.relative * Math.abs(value));
}

/**
 * This function tells if an interval of the verb `bigfloat` meets a tolerance. Each point of the interval is then within
 * the tolerance of `x`. The test is exact. The test of a relative tolerance `r` is `error <= r * m`, where `m` is the
 * smallest size in the interval. An interval that holds zero meets no relative tolerance, unless it is the point zero.
 *
 * @param big - The interval and its error.
 * @param t - The tolerance.
 * @returns `true` when the interval meets the tolerance.
 * @throws RangeError when a product is past the range of a `BigFloat`.
 */
export function bigWithin(big: BigClaim, t: Tolerance): boolean {
  if (big.error.sign === 0) return true;
  if ("absolute" in t) return t.absolute === Infinity || B.compare(big.error, B.fromNumber(t.absolute)) <= 0;
  if (big.low.sign <= 0 && big.high.sign >= 0) return false;
  if (t.relative === Infinity) return true;
  const low = B.abs(big.low);
  const high = B.abs(big.high);
  const least = B.compare(low, high) <= 0 ? low : high;
  // the product rounds against the test
  const reach = B.mul(least, B.fromNumber(t.relative), { precision: big.precision + B.DOUBLE_PRECISION, rounding: "down" });
  return B.compare(big.error, reach) <= 0;
}

/**
 * This function gives the sign of the exact value that a claim tells, or `undefined` when the claim does not tell it.
 *
 * @param c - The claim.
 * @returns `-1`, `0`, `1` or `undefined`.
 */
export function signOf(c: Claim): -1 | 0 | 1 | undefined {
  if (c.exact !== undefined) return Q.sign(c.exact);
  if (c.kind !== "value") return undefined;
  // the ends of a `BigFloat` interval tell a sign that the doubles round away
  const low = c.big?.low.sign ?? c.low;
  const high = c.big?.high.sign ?? c.high;
  if (low > 0) return 1;
  if (high < 0) return -1;
  return low === 0 && high === 0 ? 0 : undefined;
}

/**
 * This function tells if a claim answers a question. The claim `no value` answers each question. A claim with the
 * exact rational answers each value question, because the rational has no error. A claim with a `BigFloat` interval
 * answers a value question when the interval meets the tolerance, also when a double cannot hold that accuracy.
 *
 * @param c - The claim.
 * @param q - The question.
 * @returns `true` when the claim answers the question.
 */
export function meets(c: Claim, q: Question): boolean {
  if (c.kind === "no value") return true;
  if (c.kind === "no claim") return false;
  if (q.kind === "sign") return signOf(c) !== undefined;
  if (c.exact !== undefined) return true;
  return c.big !== undefined ? bigWithin(c.big, q.tolerance) : within(c.value, c.error, q.tolerance);
}
