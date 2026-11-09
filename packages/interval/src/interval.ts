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
 * This function gives the exact error of a float sum. It uses the error term of `TwoSum` (Knuth).
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param s - The float sum `a + b`.
 * @returns The float `e` with `a + b = s + e` exactly, or `NaN` when `s` is not finite and the term is not reliable.
 */
export function sumError(a: number, b: number, s: number): number {
  if (!Number.isFinite(s)) return Number.NaN;
  const bb = s - a;
  return a - (s - bb) + (b - bb);
}

const SPLIT = 134217729; // 2^27 + 1, the constant of the split of Veltkamp.

/**
 * This function gives the exact error of a float product. It uses the error term of `TwoProduct` (Dekker). Near
 * overflow or underflow the term is not reliable, so the function then gives `NaN`.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param p - The float product `a * b`.
 * @returns The float `e` with `a * b = p + e` exactly, or `NaN` when the term is not reliable.
 */
export function productError(a: number, b: number, p: number): number {
  if (a === 0 || b === 0) return 0;
  const m = Math.abs(p);
  if (!(m > 2 ** -900 && m < 2 ** 990) || Math.abs(a) > 2 ** 990 || Math.abs(b) > 2 ** 990) return Number.NaN;
  const ca = SPLIT * a;
  const ah = ca - (ca - a);
  const al = a - ah;
  const cb = SPLIT * b;
  const bh = cb - (cb - b);
  const bl = b - bh;
  return al * bl - (p - ah * bh - al * bh - ah * bl);
}

/**
 * This function gives a lower bound of `v + e` for a float `v` and its exact error `e`. An exact `v` is the bound.
 * Else the bound is one float lower. Round to nearest puts `v + e` within half a step of `v`, so one step is enough.
 * An error of `NaN` is not known, and it gives the step. The sign of `e` is not used, so that each bound of A1 stays
 * the same.
 */
const below = (v: number, e: number): number => (e === 0 ? v : nextDown(v));

/** This function gives an upper bound of `v + e`, with the rule of `below`. */
const above = (v: number, e: number): number => (e === 0 ? v : nextUp(v));

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
  return [below(lo, sumError(x[0], y[0], lo)), above(hi, sumError(x[1], y[1], hi))];
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
  for (const a of x) {
    for (const b of y) {
      const p = boundProduct(a, b);
      const e = productError(a, b, p);
      lo = Math.min(lo, below(p, e));
      hi = Math.max(hi, above(p, e));
    }
  }
  return [lo, hi];
}

/**
 * This function tells if a float quotient is exact: the product `q * b` is exact and is `a`.
 *
 * @param a - The dividend.
 * @param b - The divisor.
 * @param q - The float quotient `a / b`.
 * @returns `true` when `q` is the exact quotient.
 */
export function quotientIsExact(a: number, b: number, q: number): boolean {
  const p = q * b;
  return p === a && productError(q, b, p) === 0;
}

/**
 * This function gives the quotient of two intervals, rounded outward. A divisor interval that contains zero gives the
 * whole line, and the point zero gives the empty interval. A quotient of two finite bounds moves one step outward on
 * each side when it is not exact. A quotient with an infinite bound is `0` or infinite, and it is a bound as it is.
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
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const q = a / b;
        const exact = quotientIsExact(a, b, q);
        lo = Math.min(lo, exact ? q : nextDown(q));
        hi = Math.max(hi, exact ? q : nextUp(q));
      } else {
        const q = Number.isFinite(b) ? a / b : Number.isFinite(a) ? 0 : (a > 0) === (b > 0) ? Infinity : -Infinity;
        lo = Math.min(lo, q);
        hi = Math.max(hi, q);
      }
    }
  }
  return [lo, hi];
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
  return p === a && productError(r, r, p) === 0;
}

/** This function gives the smallest power of the interval `[z, z]`, rounded downward. */
function powLow(z: number, k: number): number {
  const p = pow([z, z], k);
  return p === null ? Number.NaN : p[0];
}

/** This function gives the largest power of the interval `[z, z]`, rounded upward. */
function powHigh(z: number, k: number): number {
  const p = pow([z, z], k);
  return p === null ? Number.NaN : p[1];
}

const rootOf = (m: number, k: number): number => (k === 3 ? Math.cbrt(m) : Math.pow(m, 1 / k));

/** The most steps of the search of `rootUp` and `rootDown`. After them, each function gives its trivial bound. */
const STEPS = 64;

/**
 * This function gives a float `z >= 0` with `z^k >= m`, for `m >= 0`. The check uses the outward powers of `pow`.
 * Near overflow the check cannot pass, and the function gives `Infinity`.
 */
function rootUp(m: number, k: number): number {
  let z = rootOf(m, k);
  for (let i = 0; z < Infinity && i < STEPS; i++) {
    if (powLow(z, k) >= m) return z;
    z = i < 8 ? nextUp(z) : z * (1 + 2 ** (i - 60));
  }
  return Infinity;
}

/** This function gives a float `z >= 0` with `z^k <= m`, for `m >= 0`. After `STEPS` steps it gives `0`. */
function rootDown(m: number, k: number): number {
  let z = rootOf(m, k);
  if (m === Infinity) return z;
  for (let i = 0; z > 0 && i < STEPS; i++) {
    if (powHigh(z, k) <= m) return z;
    z = i < 8 ? nextDown(z) : z * (1 - 2 ** (i - 60));
  }
  return 0;
}

/**
 * This function gives the root of an interval, rounded outward. The square root uses `Math.sqrt`, which is correctly
 * rounded, and one step on each bound. A larger index starts from `Math.pow` and moves each bound until the outward
 * power of `pow` shows the side of the bound. The root is monotone, so the bounds of the ends are the bounds. An odd
 * index takes negative points as `-root(-x)`. An even index ignores negative points.
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
  return [a < 0 ? -rootUp(-a, k) : rootDown(a, k), b < 0 ? -rootDown(-b, k) : rootUp(b, k)];
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
