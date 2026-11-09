/**
 * Directed rounding of nonnegative floats, from the exact error terms of `interval.ts`. Each function gives the
 * correctly rounded result when it is exact, and else the result one float step in the stated direction.
 *
 * @packageDocumentation
 */
import { nextDown, nextUp, productError, quotientIsExact, sumError } from "./interval.ts";

/**
 * This function gives the sum of two nonnegative floats, rounded upward.
 *
 * @param x - The first value, 0 or more.
 * @param y - The second value, 0 or more.
 * @returns A float that is at least `x + y`, and at most one step above it.
 */
export function addUp(x: number, y: number): number {
  const s = x + y;
  return sumError(x, y, s) <= 0 ? s : nextUp(s);
}

/**
 * This function gives the product of two nonnegative floats, rounded upward.
 *
 * @param x - The first value, 0 or more.
 * @param y - The second value, 0 or more.
 * @returns A float that is at least `x * y`, and at most one step above it.
 */
export function mulUp(x: number, y: number): number {
  const p = x * y;
  return productError(x, y, p) <= 0 ? p : nextUp(p);
}

/**
 * This function gives the quotient of two nonnegative floats, rounded upward. A correctly rounded quotient is at most
 * one step low.
 *
 * @param x - The dividend, 0 or more.
 * @param y - The divisor, above 0.
 * @returns A float that is at least `x / y`, and at most one step above it.
 */
export function divUp(x: number, y: number): number {
  const q = x / y;
  return x === 0 || quotientIsExact(x, y, q) ? q : nextUp(q);
}

/**
 * This function gives the difference `x - y` of two nonnegative floats, rounded downward.
 *
 * @param x - The first value, 0 or more.
 * @param y - The value to subtract, 0 or more.
 * @returns A float that is at most `x - y`, and at most one step below it.
 */
export function subDown(x: number, y: number): number {
  const s = x - y;
  return sumError(x, -y, s) >= 0 ? s : nextDown(s);
}

/**
 * This function gives the float root of index `k`. The square root is correctly rounded. A larger index uses
 * `Math.cbrt` or `Math.pow`, which are not correctly rounded. An odd root of a negative value is negative.
 *
 * @param r - The radicand.
 * @param k - The index of the root, 2 or more.
 * @returns The float root.
 */
export function floatRoot(r: number, k: number): number {
  if (k === 2) return Math.sqrt(r);
  const f = (m: number): number => (k === 3 ? Math.cbrt(m) : Math.pow(m, 1 / k));
  return k % 2 === 1 && r < 0 ? -f(-r) : f(r);
}
