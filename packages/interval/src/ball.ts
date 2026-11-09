/**
 * Balls of real numbers: a float midpoint and a float radius, with the "midrad" arithmetic of Rump and of Arb. Each
 * function is a plain function of `{ mid, rad }` values. The midpoint of a result is the float result of the same
 * operation on the midpoints. The radius is the propagated radius of the parts plus the error of the rounding of the
 * midpoint. Each operation of the radius rounds upward.
 *
 * A finite radius is a claim. The exact result of the operation on each point of the input balls is at most the
 * radius from the midpoint. A radius of `Infinity` makes no claim. The radius rounds upward by one float step only
 * when its float operation is not exact, so an exact result has the radius zero.
 *
 * Proof sketch of the bound. Let the exact inputs of an operation be `X = a + dx` and `Y = b + dy`, with `|dx| <= ra`
 * and `|dy| <= rb`. Let `m` be the float result and `e` the error of its rounding.
 *
 * - A sum: `X + Y - m = e + dx + dy`, so `ra + rb + |e|` is a radius. `TwoSum` gives `e` exactly.
 * - A product: `XY - m = e + a dy + b dx + dx dy`, so `|a| rb + |b| ra + ra rb + |e|` is a radius. `TwoProduct`
 *   gives `e` exactly away from overflow and underflow. Else `u |m| + 2^-1074` bounds `|e|`.
 * - A quotient, with `rb < |b|` so that `Y` is not zero: `X / Y - a / b = (b dx - a dy) / (b Y)`, and
 *   `|b Y| >= |b| (|b| - rb)`. So `(ra + |a / b| rb) / (|b| - rb) + |e|` is a radius. Else the radius is `Infinity`.
 * - The smallest and the largest move at most by the largest radius of a part. `min` and `max` are 1-Lipschitz in
 *   the largest distance. When the two balls do not meet, the extreme is one of them, so its radius is enough.
 * - A root goes through `interval.root` of `[m - r, m + r]`, rounded outward. The radius is the largest distance from
 *   the midpoint to an end. An even root of a ball that holds a negative value has the radius `Infinity`.
 * - A comparison is decided when the outward intervals of the two balls decide it. The midpoint is then the truth
 *   value and the radius is zero. Else the radius is one.
 *
 * The radius functions (`sumRadius`, `productRadius`, `quotientRadius`, `extremeRadius` and `rootRadius`) make no
 * object. An evaluator that keeps the midpoint and the radius in two numbers uses them.
 *
 * @packageDocumentation
 */
import * as I from "./interval.ts";
import type { Interval } from "./interval.ts";
import { addUp, divUp, floatRoot, mulUp, subDown } from "./rounding.ts";

/** A ball: the reals at most `rad` from `mid`. */
export interface Ball {
  /** The midpoint. */
  readonly mid: number;
  /** The radius. `Infinity` makes no claim. */
  readonly rad: number;
}

const U = 2 ** -53;
const MIN = Number.MIN_VALUE;

/** The ball that makes no claim. */
export const NO_CLAIM: Ball = { mid: Number.NaN, rad: Infinity };

/**
 * This function gives a bound of the error `|e|` of the rounding of a float result `m`. An exact error term `e`
 * gives `|e|`. An error term of `NaN` is not known, and it gives `u |m| + 2^-1074`, rounded upward.
 *
 * @param e - The exact error term, or `NaN`.
 * @param m - The float result.
 * @returns A bound of the error, rounded upward.
 */
export function roundingBound(e: number, m: number): number {
  return e === e ? Math.abs(e) : addUp(mulUp(U, Math.abs(m)), MIN);
}

/**
 * This function keeps a radius as a claim only when the midpoint is finite and the radius is a number.
 *
 * @param m - The midpoint.
 * @param r - The radius.
 * @returns `r`, or `Infinity` when `m` is not finite or `r` is `NaN`.
 */
export function claim(m: number, r: number): number {
  return m - m === 0 && r <= Infinity ? r : Infinity;
}

/**
 * This function makes a ball. A midpoint that is not finite gives the radius `Infinity`.
 *
 * @param mid - The midpoint.
 * @param rad - The radius, 0 or more. The default is 0.
 * @returns The ball.
 * @throws RangeError when the radius is negative or `NaN`.
 */
export function ball(mid: number, rad = 0): Ball {
  if (!(rad >= 0)) throw new RangeError(`The radius of a ball must be 0 or more, not ${rad}.`);
  return { mid, rad: claim(mid, rad) };
}

/**
 * This function gives the interval `[mid - rad, mid + rad]` of a ball, rounded outward.
 *
 * @param x - The ball.
 * @returns An interval that contains each point of the ball. A ball that makes no claim gives the whole line.
 */
export function toInterval(x: Ball): Interval {
  if (!(x.rad < Infinity)) return I.WHOLE;
  return I.add([x.mid, x.mid], [-x.rad, x.rad]);
}

/**
 * This function gives a ball that contains an interval. The midpoint is the float midpoint of the ends, and the
 * radius is the larger distance to an end, rounded upward.
 *
 * @param x - The interval.
 * @returns A ball that contains each point of `x`. The empty interval and an infinite end give `NO_CLAIM`.
 */
export function fromInterval(x: Interval): Ball {
  if (x === null || !(x[0] - x[0] === 0 && x[1] - x[1] === 0)) return NO_CLAIM;
  const [lo, hi] = x;
  const mid = lo / 2 + hi / 2;
  const d = I.sub([hi, hi], [mid, mid]) as readonly [number, number];
  const e = I.sub([mid, mid], [lo, lo]) as readonly [number, number];
  return { mid, rad: claim(mid, Math.max(d[1], e[1], 0)) };
}

/**
 * This function gives the radius of a sum `m = fl(a + b)`.
 *
 * @param m - The float sum of the midpoints.
 * @param a - The first midpoint.
 * @param ra - The first radius.
 * @param b - The second midpoint.
 * @param rb - The second radius.
 * @returns The radius of the sum, rounded upward.
 */
export function sumRadius(m: number, a: number, ra: number, b: number, rb: number): number {
  return claim(m, addUp(addUp(ra, rb), roundingBound(I.sumError(a, b, m), m)));
}

/**
 * This function gives the radius of a product `m = fl(a * b)`.
 *
 * @param m - The float product of the midpoints.
 * @param a - The first midpoint.
 * @param ra - The first radius.
 * @param b - The second midpoint.
 * @param rb - The second radius.
 * @returns The radius of the product, rounded upward.
 */
export function productRadius(m: number, a: number, ra: number, b: number, rb: number): number {
  const spread = addUp(addUp(mulUp(Math.abs(a), rb), mulUp(Math.abs(b), ra)), mulUp(ra, rb));
  return claim(m, addUp(spread, roundingBound(I.productError(a, b, m), m)));
}

/**
 * This function gives the radius of a quotient `q = fl(a / b)`.
 *
 * @param q - The float quotient of the midpoints.
 * @param a - The midpoint of the dividend.
 * @param ra - The radius of the dividend.
 * @param b - The midpoint of the divisor.
 * @param rb - The radius of the divisor.
 * @returns The radius of the quotient, rounded upward, or `Infinity` when the ball of the divisor can hold zero.
 */
export function quotientRadius(q: number, a: number, ra: number, b: number, rb: number): number {
  const m = Math.abs(b);
  if (!(rb < m) || !(q - q === 0)) return Infinity;
  const ratio = q === 0 ? 0 : I.nextUp(Math.abs(q));
  const spread = divUp(addUp(ra, mulUp(ratio, rb)), subDown(m, rb));
  const e = I.quotientIsExact(a, b, q) ? 0 : addUp(mulUp(U, Math.abs(q)), MIN);
  return claim(q, addUp(spread, e));
}

/**
 * This function gives the radius of the largest (`sign = 1`) or the smallest (`sign = -1`) of two balls. When the
 * outward intervals of the balls do not meet, the extreme is one ball, and its radius is the radius. Else the radius
 * is the larger radius.
 *
 * @param sign - `1` for the largest, `-1` for the smallest.
 * @param a - The first midpoint.
 * @param ra - The first radius.
 * @param b - The second midpoint.
 * @param rb - The second radius.
 * @returns The radius of the extreme. Give it to `claim` with the midpoint of the extreme.
 */
export function extremeRadius(sign: 1 | -1, a: number, ra: number, b: number, rb: number): number {
  const sa = I.add([sign * a, sign * a], [-ra, ra]) as readonly [number, number];
  const sb = I.add([sign * b, sign * b], [-rb, rb]) as readonly [number, number];
  if (sa[0] >= sb[1]) return ra;
  if (sb[0] >= sa[1]) return rb;
  return Math.max(ra, rb);
}

/**
 * This function gives the radius of a root `v = floatRoot(r, k)`. The radius is the largest distance from `v` to an
 * end of `interval.root` of the ball of the radicand, rounded upward.
 *
 * @param v - The float root of the midpoint.
 * @param r - The midpoint of the radicand.
 * @param rr - The radius of the radicand.
 * @param k - The index of the root, a whole number of 2 or more.
 * @returns The radius of the root, or `Infinity` when an even root can meet a negative value.
 */
export function rootRadius(v: number, r: number, rr: number, k: number): number {
  if (!(rr < Infinity) || !(v - v === 0)) return Infinity;
  const span = I.add([r, r], [-rr, rr]);
  if (span === null || (k % 2 === 0 && span[0] < 0)) return Infinity;
  const d = I.sub([v, v], I.root(span, k));
  return d === null ? Infinity : claim(v, Math.max(-d[0], d[1]));
}

/**
 * This function gives the sum of two balls.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns A ball that contains each sum of a point of `x` and a point of `y`.
 */
export function add(x: Ball, y: Ball): Ball {
  const m = x.mid + y.mid;
  return { mid: m, rad: sumRadius(m, x.mid, x.rad, y.mid, y.rad) };
}

/**
 * This function gives the difference of two balls.
 *
 * @param x - The first ball.
 * @param y - The ball to subtract.
 * @returns A ball that contains each difference of a point of `x` and a point of `y`.
 */
export function sub(x: Ball, y: Ball): Ball {
  const m = x.mid - y.mid;
  return { mid: m, rad: sumRadius(m, x.mid, x.rad, -y.mid, y.rad) };
}

/**
 * This function gives the negative of a ball. It is exact.
 *
 * @param x - The ball.
 * @returns The ball of the negative points.
 */
export function neg(x: Ball): Ball {
  return { mid: -x.mid, rad: x.rad };
}

/**
 * This function gives the product of two balls.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns A ball that contains each product of a point of `x` and a point of `y`.
 */
export function mul(x: Ball, y: Ball): Ball {
  const m = x.mid * y.mid;
  return { mid: m, rad: productRadius(m, x.mid, x.rad, y.mid, y.rad) };
}

/**
 * This function gives the quotient of two balls.
 *
 * @param x - The dividend.
 * @param y - The divisor.
 * @returns A ball that contains each quotient of a point of `x` and a point of `y`. A divisor that can hold zero gives
 *   the radius `Infinity`.
 */
export function div(x: Ball, y: Ball): Ball {
  const q = x.mid / y.mid;
  return { mid: q, rad: quotientRadius(q, x.mid, x.rad, y.mid, y.rad) };
}

/**
 * This function gives the smallest of two balls.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns A ball that contains `min(p, q)` for each point `p` of `x` and `q` of `y`.
 */
export function min(x: Ball, y: Ball): Ball {
  const m = Math.min(x.mid, y.mid);
  return { mid: m, rad: claim(m, extremeRadius(-1, x.mid, x.rad, y.mid, y.rad)) };
}

/**
 * This function gives the largest of two balls.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns A ball that contains `max(p, q)` for each point `p` of `x` and `q` of `y`.
 */
export function max(x: Ball, y: Ball): Ball {
  const m = Math.max(x.mid, y.mid);
  return { mid: m, rad: claim(m, extremeRadius(1, x.mid, x.rad, y.mid, y.rad)) };
}

/**
 * This function gives a ball to a whole power, with repeated squares. Each product uses the rule of `mul`. A negative
 * power is the quotient of one by the positive power. The power zero gives one, with the radius zero when the base
 * makes a claim.
 *
 * @param x - The base.
 * @param n - The exponent, a whole number.
 * @returns A ball that contains the power of each point of `x`.
 */
export function pow(x: Ball, n: number): Ball {
  if (!Number.isInteger(n)) throw new RangeError(`pow needs a whole exponent, not ${n}.`);
  let bv = x.mid;
  let br = x.rad;
  if (n === 0) return { mid: 1, rad: br < Infinity ? 0 : Infinity };
  let rv = 1;
  let rr = 0;
  let first = true;
  for (let k = Math.abs(n); k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) {
      if (first) {
        rv = bv;
        rr = br;
        first = false;
      } else {
        const m = rv * bv;
        rr = productRadius(m, rv, rr, bv, br);
        rv = m;
      }
    }
    if (k > 1) {
      const s = bv * bv;
      br = productRadius(s, bv, br, bv, br);
      bv = s;
    }
  }
  if (n > 0) return { mid: rv, rad: rr };
  const v = 1 / rv;
  return { mid: v, rad: quotientRadius(v, 1, 0, rv, rr) };
}

/**
 * This function gives the root of index `k` of a ball.
 *
 * @param x - The radicand.
 * @param k - The index of the root, a whole number of 2 or more.
 * @returns A ball that contains the real root of each point of `x`. An even root of a ball that can hold a negative
 *   value gives the radius `Infinity`.
 */
export function root(x: Ball, k: number): Ball {
  if (!Number.isInteger(k) || k < 2) throw new RangeError(`root needs a whole index of 2 or more, not ${k}.`);
  const v = floatRoot(x.mid, k);
  return { mid: v, rad: rootRadius(v, x.mid, x.rad, k) };
}

/** This function decides a comparison of two balls with the outward intervals of the balls. */
function comparison(kind: "lt" | "le" | "eq", x: Ball, y: Ball): Ball {
  if (!(x.rad < Infinity && y.rad < Infinity)) return NO_CLAIM;
  const truth = I[kind](toInterval(x), toInterval(y)) as readonly [number, number];
  if (truth[0] === truth[1]) return { mid: truth[0], rad: 0 };
  const a = x.mid;
  const b = y.mid;
  return { mid: (kind === "lt" ? a < b : kind === "le" ? a <= b : a === b) ? 1 : 0, rad: 1 };
}

/**
 * This function compares two balls with `<`.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns The truth value `1` or `0` with the radius zero when the balls decide it. Else the float truth value of
 *   the midpoints with the radius one.
 */
export function lt(x: Ball, y: Ball): Ball {
  return comparison("lt", x, y);
}

/**
 * This function compares two balls with `<=`.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns The truth value with the rule of `lt`.
 */
export function le(x: Ball, y: Ball): Ball {
  return comparison("le", x, y);
}

/**
 * This function compares two balls with `=`.
 *
 * @param x - The first ball.
 * @param y - The second ball.
 * @returns The truth value with the rule of `lt`.
 */
export function eq(x: Ball, y: Ball): Ball {
  return comparison("eq", x, y);
}
