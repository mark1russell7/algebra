/**
 * Binary floats with a precision that the caller selects (roadmap item A7). A value is `sign × mantissa × 2^exponent`.
 * The mantissa is a `bigint`, so the only limit of the precision is memory.
 *
 * `add`, `sub`, `mul`, `div`, `sqrt` and `root` round correctly. Each result is the exact real result, rounded one time
 * to the precision of the operation in the selected mode. `neg`, `abs`, `compare` and `toRational` are exact.
 *
 * The method is the same for each operation. It makes an integer `m` with enough bits, and a sticky flag that tells if
 * the exact value is strictly between `m` and `m + 1`. One function then rounds that pair. With at least one bit below
 * the precision, the pair decides each mode. A tie needs a zero flag and exactly the half pattern.
 *
 * A value is finite. This type has no infinity, no not-a-number and no negative zero, so each case without a real result
 * is a `RangeError`. An exponent past `MAX_EXPONENT` is a `RangeError` too.
 */
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/**
 * A finite binary float. The value is `sign × mantissa × 2^exponent`.
 *
 * Each value is in one form. Zero has the sign 0, the mantissa `0n` and the exponent 0. Another value has an odd
 * mantissa, so two equal values have equal `sign`, `mantissa` and `exponent`. The mantissa has at most `precision` bits.
 */
export interface BigFloat {
  /** The sign: -1, 0 or 1. */
  readonly sign: -1 | 0 | 1;
  /** The size of the value in units of `2^exponent`: `0n` for zero, else an odd positive integer. */
  readonly mantissa: bigint;
  /** The power of two of the unit of the mantissa. Its size is at most `MAX_EXPONENT`. */
  readonly exponent: number;
  /** The precision in bits of the operation that made this value. It does not change the value. */
  readonly precision: number;
}

/**
 * The rounding mode of an operation. `nearest` selects the nearest value, and a tie selects the even mantissa. `down`
 * goes to negative infinity, `up` to positive infinity, and `zero` to zero.
 */
export type Rounding = "nearest" | "down" | "up" | "zero";

/** The settings of an operation. */
export interface Context {
  /** The precision of the result in bits, 1 or more. The default is the largest precision of the operands. */
  readonly precision?: number;
  /** The rounding mode. The default is `nearest`. */
  readonly rounding?: Rounding;
}

/** The precision of a double, and the default of the conversions. */
export const DOUBLE_PRECISION = 53;

/**
 * The largest size of an exponent. A sum of two exponents stays exact in a `number`, so no step of an operation can lose
 * a unit of an exponent.
 */
export const MAX_EXPONENT: number = 2 ** 52;

/** The settings of an operation after the defaults. */
interface Settings {
  readonly precision: number;
  readonly rounding: Rounding;
}

/** This function gives the settings, and it refuses a precision that is not a whole number of 1 or more. */
function settings(context: Context | undefined, fallback: number): Settings {
  const precision = context?.precision ?? fallback;
  if (!Number.isSafeInteger(precision) || precision < 1) throw new RangeError(`not a precision: ${precision}`);
  return { precision, rounding: context?.rounding ?? "nearest" };
}

/** This function gives the count of bits of a positive `bigint`. The hexadecimal text costs linear time. */
function bitLength(x: bigint): number {
  const text = x.toString(16);
  return (text.length - 1) * 4 + 32 - Math.clz32(Number.parseInt(text[0] as string, 16));
}

/** This function gives the count of zero bits at the low end of a positive `bigint`. */
const trailingZeros = (x: bigint): number => bitLength(x & -x) - 1;

/** This function gives the first bit above a nonzero value: `|x| < 2^top(x)`, and `|x| >= 2^(top(x) - 1)`. */
const top = (x: BigFloat): number => bitLength(x.mantissa) + x.exponent;

/** This function gives the signed mantissa of a value, shifted to the left. */
const signed = (x: BigFloat, shift: number): bigint => (x.sign < 0 ? -x.mantissa : x.mantissa) << BigInt(shift);

/**
 * This function makes zero at a precision.
 *
 * @param precision - The precision in bits. The default is `DOUBLE_PRECISION`.
 * @throws RangeError when the precision is not a whole number of 1 or more.
 */
export const zero = (precision: number = DOUBLE_PRECISION): BigFloat => ({
  sign: 0,
  mantissa: 0n,
  exponent: 0,
  precision: settings({ precision }, DOUBLE_PRECISION).precision,
});

/** This function tells if rounding moves the kept integer one step away from zero. */
function roundsAway(rounding: Rounding, sign: -1 | 1, inexact: boolean, half: -1 | 0 | 1, odd: boolean): boolean {
  if (!inexact) return false;
  switch (rounding) {
    case "zero":
      return false;
    case "down":
      return sign < 0;
    case "up":
      return sign > 0;
    case "nearest":
      return half > 0 || (half === 0 && odd);
  }
}

/**
 * This function rounds `sign × (m + f) × 2^exponent`, with `f = 0` when `sticky` is false and `0 < f < 1` when it is
 * true. Each operation ends here. When `sticky` is true, `m` must have at least `precision + 1` bits.
 *
 * @throws RangeError when the exponent of the result is past `MAX_EXPONENT`.
 */
function finish(sign: -1 | 1, m: bigint, exponent: number, sticky: boolean, s: Settings): BigFloat {
  if (m === 0n) return zero(s.precision);
  let kept = m;
  let e = exponent;
  const drop = bitLength(m) - s.precision;
  if (drop > 0) {
    const d = BigInt(drop);
    kept = m >> d;
    const rest = m - (kept << d);
    const half = 1n << (d - 1n);
    const position = rest > half ? 1 : rest < half ? -1 : sticky ? 1 : 0;
    if (roundsAway(s.rounding, sign, rest !== 0n || sticky, position, (kept & 1n) === 1n)) kept += 1n;
    e += drop;
  }
  const zeros = trailingZeros(kept);
  e += zeros;
  if (Math.abs(e) > MAX_EXPONENT) throw new RangeError(`the exponent ${e} is out of range`);
  return { sign, mantissa: kept >> BigInt(zeros), exponent: e, precision: s.precision };
}

/**
 * This function rounds a value to the precision of a context.
 *
 * @param x - The value.
 * @param context - The precision and the rounding mode. The default precision is the precision of `x`.
 */
export const round = (x: BigFloat, context?: Context): BigFloat => {
  const s = settings(context, x.precision);
  return x.sign === 0 ? zero(s.precision) : finish(x.sign, x.mantissa, x.exponent, false, s);
};

/**
 * This function gives the value of an integer, rounded to the precision of a context.
 *
 * @param n - The integer.
 * @param context - The precision and the rounding mode. The default precision holds each bit of `n`, so the result is
 * exact.
 */
export const fromBigInt = (n: bigint, context?: Context): BigFloat => {
  if (n === 0n) return zero(context?.precision ?? 1);
  const m = n < 0n ? -n : n;
  return finish(n < 0n ? -1 : 1, m, 0, false, settings(context, bitLength(m)));
};

/**
 * This function gives the correctly rounded value of a rational.
 *
 * @param q - The rational.
 * @param context - The precision and the rounding mode. The default precision is `DOUBLE_PRECISION`.
 */
export const fromRational = (q: Rational, context?: Context): BigFloat => {
  const s = settings(context, DOUBLE_PRECISION);
  if (q.n === 0n) return zero(s.precision);
  const m = q.n < 0n ? -q.n : q.n;
  const shift = Math.max(0, s.precision + 2 + bitLength(q.d) - bitLength(m));
  const scaled = m << BigInt(shift);
  const quotient = scaled / q.d;
  return finish(q.n < 0n ? -1 : 1, quotient, -shift, quotient * q.d !== scaled, s);
};

/**
 * This function gives the value of a finite double. The default precision holds each double, so the result is exact.
 * The value `-0` gives zero.
 *
 * @param x - The double.
 * @param context - The precision and the rounding mode. The default precision is `DOUBLE_PRECISION`.
 * @throws RangeError when the number is not finite.
 */
export const fromNumber = (x: number, context?: Context): BigFloat => fromRational(Q.fromFloat(x), context);

/**
 * This function gives the exact value as a rational. The cost grows with `|exponent|`, so a value with a very large
 * exponent is out of the range of a `bigint`.
 *
 * @param x - The value.
 */
export const toRational = (x: BigFloat): Rational =>
  x.exponent >= 0 ? Q.rational(signed(x, x.exponent)) : Q.rational(signed(x, 0), 1n << BigInt(-x.exponent));

/** The first bit above the doubles, and a limit under the half of the smallest double. */
const DOUBLE_TOP = 1025;
const DOUBLE_BOTTOM = -1080;

/**
 * This function gives the nearest double, with ties to even. A value past the range of the doubles gives an infinity,
 * and a value too small gives zero or a subnormal.
 *
 * @param x - The value.
 */
export const toNumber = (x: BigFloat): number => {
  if (x.sign === 0) return 0;
  const t = top(x);
  if (t > DOUBLE_TOP) return x.sign * Infinity;
  if (t < DOUBLE_BOTTOM) return x.sign * 0;
  return Q.toNumber(toRational(x));
};

/** This function gives `-x`. The result is exact, and it keeps the precision of `x`. */
export const neg = (x: BigFloat): BigFloat => (x.sign === 0 ? x : { ...x, sign: x.sign < 0 ? 1 : -1 });

/** This function gives `|x|`. The result is exact, and it keeps the precision of `x`. */
export const abs = (x: BigFloat): BigFloat => (x.sign < 0 ? neg(x) : x);

/**
 * This function gives -1, 0 or 1 for `a < b`, `a = b` or `a > b`. The result is exact. Its cost does not depend on the
 * distance between the exponents.
 */
export const compare = (a: BigFloat, b: BigFloat): -1 | 0 | 1 => {
  if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
  if (a.sign === 0) return 0;
  const ta = top(a);
  const tb = top(b);
  if (ta !== tb) return (ta < tb ? -a.sign : a.sign) as -1 | 1;
  const low = Math.min(a.exponent, b.exponent);
  const x = signed(a, a.exponent - low);
  const y = signed(b, b.exponent - low);
  return x < y ? -1 : x > y ? 1 : 0;
};

/** This function tells if two values are equal. A value has one form, so the test ignores only the precision. */
export const equals = (a: BigFloat, b: BigFloat): boolean =>
  a.sign === b.sign && a.exponent === b.exponent && a.mantissa === b.mantissa;

/**
 * This function gives `a + b`, correctly rounded. An operand far below the other adds only a sticky flag, so the cost
 * does not depend on the distance between the exponents.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param context - The precision and the rounding mode. The default precision is the larger precision of the operands.
 */
export const add = (a: BigFloat, b: BigFloat, context?: Context): BigFloat => {
  const s = settings(context, Math.max(a.precision, b.precision));
  if (a.sign === 0) return round(b, s);
  if (b.sign === 0) return round(a, s);
  const [x, y] = top(a) >= top(b) ? [a, b] : [b, a];
  // `x` is a whole count of units of `2^cut` with at least `precision + 3` bits
  const cut = Math.min(x.exponent, top(x) - s.precision - 3);
  if (top(y) <= cut) {
    // `|y|` is less than one unit, so the exact sum is strictly between two whole counts of units
    const big = x.mantissa << BigInt(x.exponent - cut);
    return finish(x.sign as -1 | 1, x.sign === y.sign ? big : big - 1n, cut, true, s);
  }
  const low = Math.min(x.exponent, y.exponent);
  const sum = signed(x, x.exponent - low) + signed(y, y.exponent - low);
  return sum < 0n ? finish(-1, -sum, low, false, s) : finish(1, sum, low, false, s);
};

/**
 * This function gives `a - b`, correctly rounded.
 *
 * @param a - The first value.
 * @param b - The value to subtract.
 * @param context - The precision and the rounding mode. The default precision is the larger precision of the operands.
 */
export const sub = (a: BigFloat, b: BigFloat, context?: Context): BigFloat => add(a, neg(b), context);

/**
 * This function gives `a × b`, correctly rounded.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param context - The precision and the rounding mode. The default precision is the larger precision of the operands.
 * @throws RangeError when the exponent of the result is past `MAX_EXPONENT`.
 */
export const mul = (a: BigFloat, b: BigFloat, context?: Context): BigFloat => {
  const s = settings(context, Math.max(a.precision, b.precision));
  if (a.sign === 0 || b.sign === 0) return zero(s.precision);
  return finish(a.sign === b.sign ? 1 : -1, a.mantissa * b.mantissa, a.exponent + b.exponent, false, s);
};

/**
 * This function gives `a / b`, correctly rounded.
 *
 * @param a - The dividend.
 * @param b - The divisor.
 * @param context - The precision and the rounding mode. The default precision is the larger precision of the operands.
 * @throws RangeError when `b` is 0, or when the exponent of the result is past `MAX_EXPONENT`.
 */
export const div = (a: BigFloat, b: BigFloat, context?: Context): BigFloat => {
  const s = settings(context, Math.max(a.precision, b.precision));
  if (b.sign === 0) throw new RangeError("division by zero");
  if (a.sign === 0) return zero(s.precision);
  // a quotient of `n` and `d` bits has at least `n - d` bits, so this shift gives `precision + 2` bits
  const shift = Math.max(0, s.precision + 2 + bitLength(b.mantissa) - bitLength(a.mantissa));
  const scaled = a.mantissa << BigInt(shift);
  const quotient = scaled / b.mantissa;
  const sign = a.sign === b.sign ? 1 : -1;
  return finish(sign, quotient, a.exponent - b.exponent - shift, quotient * b.mantissa !== scaled, s);
};

/**
 * This function gives the root of index `k` of `x`, correctly rounded. An odd index gives the negative root of a
 * negative value.
 *
 * @param x - The value.
 * @param k - The index, a whole number of 1 or more.
 * @param context - The precision and the rounding mode. The default precision is the precision of `x`.
 * @throws RangeError when `k` is not a whole number of 1 or more, or when `k` is even and `x` is less than 0.
 */
export const root = (x: BigFloat, k: number, context?: Context): BigFloat => {
  const s = settings(context, x.precision);
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`not an index of a root: ${k}`);
  if (x.sign < 0 && k % 2 === 0) throw new RangeError("an even root of a negative value is not real");
  if (x.sign === 0) return zero(s.precision);
  // a value of `k × (precision + 1) + 1` bits has a root of at least `precision + 2` bits
  const wanted = Math.max(0, k * (s.precision + 1) + 1 - bitLength(x.mantissa));
  // the exponent of the radicand must be a multiple of `k`
  const shift = wanted + (((x.exponent - wanted) % k) + k) % k;
  const radicand = x.mantissa << BigInt(shift);
  const r = Q.integerRoot(radicand, k);
  return finish(x.sign, r, (x.exponent - shift) / k, r ** BigInt(k) !== radicand, s);
};

/**
 * This function gives the square root of `x`, correctly rounded.
 *
 * @param x - The value.
 * @param context - The precision and the rounding mode. The default precision is the precision of `x`.
 * @throws RangeError when `x` is less than 0.
 */
export const sqrt = (x: BigFloat, context?: Context): BigFloat => root(x, 2, context);
