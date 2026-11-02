/**
 * Intervals of real numbers with float bounds. Each operation rounds outward, so the exact result of the operation on
 * any reals inside the inputs is inside the output. An infinite bound means that the interval has no bound on that side.
 *
 * `null` is the empty interval: no point of the inputs gives a real value.
 *
 * @packageDocumentation
 */

/** A closed interval `[low, high]` of reals, or `null` for the empty interval. */
export type Interval = readonly [number, number] | null;

/** The interval that contains every real. */
export const WHOLE: readonly [number, number] = [-Infinity, Infinity];

const view = new DataView(new ArrayBuffer(8));

/**
 * This function gives the next float above a value.
 *
 * @param x - The value.
 * @returns The smallest float that is larger than `x`. `Infinity` stays `Infinity`, and `NaN` stays `NaN`.
 */
export function nextUp(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, x > 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

/**
 * This function gives the next float below a value.
 *
 * @param x - The value.
 * @returns The largest float that is smaller than `x`. `-Infinity` stays `-Infinity`, and `NaN` stays `NaN`.
 */
export function nextDown(x: number): number {
  return -nextUp(-x);
}

/**
 * This function tells if the float sum of two floats is exact. It uses the error term of `TwoSum` (Knuth).
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param s - The float sum `a + b`.
 * @returns `true` when `s` is the exact sum.
 */
function sumIsExact(a: number, b: number, s: number): boolean {
  if (!Number.isFinite(s)) return false;
  const bb = s - a;
  return a - (s - bb) + (b - bb) === 0;
}

const SPLIT = 134217729; // 2^27 + 1, the constant of the split of Veltkamp.

/**
 * This function tells if the float product of two floats is exact. It uses the error term of `TwoProduct` (Dekker).
 * Near overflow or underflow the term is not reliable, so the function then gives `false`.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param p - The float product `a * b`.
 * @returns `true` when `p` is the exact product.
 */
function productIsExact(a: number, b: number, p: number): boolean {
  if (a === 0 || b === 0) return true;
  const m = Math.abs(p);
  if (!(m > 2 ** -900 && m < 2 ** 990) || Math.abs(a) > 2 ** 990 || Math.abs(b) > 2 ** 990) return false;
  const ca = SPLIT * a;
  const ah = ca - (ca - a);
  const al = a - ah;
  const cb = SPLIT * b;
  const bh = cb - (cb - b);
  const bl = b - bh;
  return al * bl - (p - ah * bh - al * bh - ah * bl) === 0;
}

/**
 * This function gives the sum of two intervals, rounded outward.
 *
 * @param x - The first interval.
 * @param y - The second interval.
 * @returns An interval that contains each sum of a point of `x` and a point of `y`.
 */
export function add(x: Interval, y: Interval): Interval {
  if (x === null || y === null) return null;
  const lo = x[0] + y[0];
  const hi = x[1] + y[1];
  return [sumIsExact(x[0], y[0], lo) ? lo : nextDown(lo), sumIsExact(x[1], y[1], hi) ? hi : nextUp(hi)];
}

/**
 * This function gives the negation of an interval. It is exact.
 *
 * @param x - The interval.
 * @returns The interval of the negated points.
 */
export function neg(x: Interval): Interval {
  return x === null ? null : [-x[1], -x[0]];
}

/**
 * This function gives the difference of two intervals, rounded outward.
 *
 * @param x - The first interval.
 * @param y - The interval to subtract.
 * @returns An interval that contains each difference of a point of `x` and a point of `y`.
 */
export function sub(x: Interval, y: Interval): Interval {
  return add(x, neg(y));
}

/**
 * This function gives one float product for an interval bound. A zero times an infinite bound is zero, because the
 * infinite bound stands for large reals, not for infinity.
 */
function boundProduct(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : a * b;
}

/**
 * This function gives the product of two intervals, rounded outward.
 *
 * @param x - The first interval.
 * @param y - The second interval.
 * @returns An interval that contains each product of a point of `x` and a point of `y`.
 */
export function mul(x: Interval, y: Interval): Interval {
  if (x === null || y === null) return null;
  let lo = Infinity;
  let hi = -Infinity;
  let loExact = true;
  let hiExact = true;
  for (const a of x) {
    for (const b of y) {
      const p = boundProduct(a, b);
      const exact = productIsExact(a, b, p);
      if (p < lo || (p === lo && !exact)) [lo, loExact] = [p, exact];
      if (p > hi || (p === hi && !exact)) [hi, hiExact] = [p, exact];
    }
  }
  return [loExact ? lo : nextDown(lo), hiExact ? hi : nextUp(hi)];
}

/**
 * This function gives the quotient of two intervals, rounded outward. A divisor interval that contains zero gives the
 * whole line, and the point zero gives the empty interval.
 *
 * @param x - The dividend.
 * @param y - The divisor.
 * @returns An interval that contains each quotient of a point of `x` and a nonzero point of `y`.
 */
export function div(x: Interval, y: Interval): Interval {
  if (x === null || y === null) return null;
  if (y[0] === 0 && y[1] === 0) return null;
  if (y[0] <= 0 && y[1] >= 0) return WHOLE;
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of x) {
    for (const b of y) {
      const q = Number.isFinite(b) ? a / b : Number.isFinite(a) ? 0 : (a > 0) === (b > 0) ? Infinity : -Infinity;
      lo = Math.min(lo, q);
      hi = Math.max(hi, q);
    }
  }
  return [lo === 0 && x[0] === 0 && x[1] === 0 ? 0 : nextDown(lo), hi === 0 && x[0] === 0 && x[1] === 0 ? 0 : nextUp(hi)];
}

/**
 * This function gives the square of an interval, rounded outward. It is tighter than `mul(x, x)` for an interval
 * that contains zero.
 */
function square(x: readonly [number, number]): Interval {
  const [a, b] = x;
  if (a >= 0) return mul(x, x);
  if (b <= 0) return mul(neg(x), neg(x));
  const m = Math.max(-a, b);
  const top = mul([m, m], [m, m]);
  return top === null ? null : [0, top[1]];
}

/**
 * This function gives an interval to a whole power, rounded outward. The power zero gives the point one, also for a
 * base of zero. A negative power is the reciprocal of the positive power.
 *
 * @param x - The base.
 * @param n - The exponent. It must be a whole number.
 * @returns An interval that contains each power of a point of `x`.
 */
export function pow(x: Interval, n: number): Interval {
  if (x === null) return null;
  if (!Number.isInteger(n)) throw new RangeError(`pow needs a whole exponent, not ${n}.`);
  if (n < 0) return div([1, 1], pow(x, -n));
  let result: Interval = [1, 1];
  let base: Interval = x;
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) result = mul(result, base);
    if (k > 1 && base !== null) base = square(base);
  }
  return result;
}

/** This function tells if `r * r` is exactly `a`. */
function isSquareOf(r: number, a: number): boolean {
  const p = r * r;
  return p === a && productIsExact(r, r, p);
}

/**
 * This function gives the root of an interval, rounded outward. The square root uses `Math.sqrt`, which is correctly
 * rounded. A larger index uses the bounds `min(a, 1)` and `max(b, 1)`, because `x ** (1 / k)` lies between `x` and
 * `1` for each `x >= 0`. An odd index takes negative points as `-root(-x)`. An even index ignores negative points.
 *
 * @param x - The radicand.
 * @param k - The index of the root. It must be a whole number of 2 or more.
 * @returns An interval that contains the real root of each point of `x` that has one.
 */
export function root(x: Interval, k: number): Interval {
  if (x === null) return null;
  if (!Number.isInteger(k) || k < 2) throw new RangeError(`root needs a whole index of 2 or more, not ${k}.`);
  let [a, b] = x;
  if (k % 2 === 0) {
    if (b < 0) return null;
    a = Math.max(a, 0);
  }
  if (k === 2) {
    const lo = Math.sqrt(a);
    const hi = Math.sqrt(b);
    return [isSquareOf(lo, a) ? lo : Math.max(0, nextDown(lo)), isSquareOf(hi, b) ? hi : nextUp(hi)];
  }
  return [a < 0 ? Math.min(a, -1) : Math.min(a, 1), b < 0 ? Math.max(b, -1) : Math.max(b, 1)];
}

/**
 * This function gives the interval of the smallest of the points. It is exact.
 *
 * @param x - The first interval.
 * @param y - The second interval.
 * @returns The interval of `min(p, q)` for `p` in `x` and `q` in `y`.
 */
export function min(x: Interval, y: Interval): Interval {
  return x === null || y === null ? null : [Math.min(x[0], y[0]), Math.min(x[1], y[1])];
}

/**
 * This function gives the interval of the largest of the points. It is exact.
 *
 * @param x - The first interval.
 * @param y - The second interval.
 * @returns The interval of `max(p, q)` for `p` in `x` and `q` in `y`.
 */
export function max(x: Interval, y: Interval): Interval {
  return x === null || y === null ? null : [Math.max(x[0], y[0]), Math.max(x[1], y[1])];
}

/** The interval of a truth value: `1` is true and `0` is false. */
const TRUE: Interval = [1, 1];
const FALSE: Interval = [0, 0];
const UNKNOWN: Interval = [0, 1];

/**
 * This function compares two intervals with `<`. The result is the interval of the truth value, with `1` for true.
 *
 * @param x - The left side.
 * @param y - The right side.
 * @returns `[1, 1]` when `p < q` for each pair of points, `[0, 0]` when for none, and `[0, 1]` when it is not known.
 */
export function lt(x: Interval, y: Interval): Interval {
  if (x === null || y === null) return null;
  if (x[1] < y[0]) return TRUE;
  if (x[0] >= y[1]) return FALSE;
  return UNKNOWN;
}

/**
 * This function compares two intervals with `<=`. The result is the interval of the truth value, with `1` for true.
 *
 * @param x - The left side.
 * @param y - The right side.
 * @returns `[1, 1]` when `p <= q` for each pair of points, `[0, 0]` when for none, and `[0, 1]` when it is not known.
 */
export function le(x: Interval, y: Interval): Interval {
  if (x === null || y === null) return null;
  if (x[1] <= y[0]) return TRUE;
  if (x[0] > y[1]) return FALSE;
  return UNKNOWN;
}

/**
 * This function compares two intervals with `=`. The result is the interval of the truth value, with `1` for true.
 *
 * @param x - The left side.
 * @param y - The right side.
 * @returns `[1, 1]` when both are the same point, `[0, 0]` when they do not meet, and `[0, 1]` when it is not known.
 */
export function eq(x: Interval, y: Interval): Interval {
  if (x === null || y === null) return null;
  if (x[0] === x[1] && y[0] === y[1] && x[0] === y[0]) return TRUE;
  if (x[1] < y[0] || y[1] < x[0]) return FALSE;
  return UNKNOWN;
}
