/**
 * The questions to an expression at a point, and the rule that tells if a claim answers a question.
 *
 * @packageDocumentation
 */
import { interval as I } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Claim } from "./claim.ts";

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
 * This function gives the sign of the exact value that a claim tells, or `undefined` when the claim does not tell it.
 *
 * @param c - The claim.
 * @returns `-1`, `0`, `1` or `undefined`.
 */
export function signOf(c: Claim): -1 | 0 | 1 | undefined {
  if (c.exact !== undefined) return Q.sign(c.exact);
  if (c.kind !== "value") return undefined;
  if (c.low > 0) return 1;
  if (c.high < 0) return -1;
  return c.low === 0 && c.high === 0 ? 0 : undefined;
}

/**
 * This function tells if a claim answers a question. The claim `no value` answers each question. A claim with the
 * exact rational answers each value question, because the rational has no error.
 *
 * @param c - The claim.
 * @param q - The question.
 * @returns `true` when the claim answers the question.
 */
export function meets(c: Claim, q: Question): boolean {
  if (c.kind === "no value") return true;
  if (c.kind === "no claim") return false;
  if (q.kind === "sign") return signOf(c) !== undefined;
  return c.exact !== undefined || within(c.value, c.error, q.tolerance);
}
