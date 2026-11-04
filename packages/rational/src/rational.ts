/**
 * Exact rationals over `bigint`. Each value is in lowest terms, so two equal rationals have equal fields.
 * Each operation is exact. Only `toNumber` rounds, and its result is the nearest double.
 */

/**
 * A rational number `n / d` over `bigint`. The denominator `d` is more than 0, and `gcd(n, d)` is 1.
 * Zero is `0 / 1`. The functions of this module make only values of this form.
 */
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

const abs64 = (x: bigint): bigint => (x < 0n ? -x : x);

/**
 * This function gives the greatest common divisor of `|a|` and `|b|`. The result for `0` and `0` is `0`.
 *
 * @param a - An integer.
 * @param b - An integer.
 * @returns The exact divisor. It is not negative.
 */
export const gcd = (a: bigint, b: bigint): bigint => {
  let x = abs64(a);
  let y = abs64(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

/** This function makes a rational from fields that are already in lowest terms, with `d > 0`. It does no check. */
const make = (n: bigint, d: bigint): Rational => ({ n, d });

/**
 * This function makes the rational `n / d` in lowest terms. The result is exact.
 *
 * @param n - The numerator.
 * @param d - The denominator. The default is `1n`.
 * @throws RangeError when `d` is `0n`.
 */
export const rational = (n: bigint, d: bigint = 1n): Rational => {
  if (d === 0n) throw new RangeError("a rational cannot have a zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return g === 1n ? make(n, d) : make(n / g, d / g);
};

/** The rational 1. */
export const ONE: Rational = make(1n, 1n);
/** The rational 0. */
export const ZERO: Rational = make(0n, 1n);

/**
 * This function reads a decimal from its text, exactly. The text `"0.0254"` gives 127/5000, and `"1e-9"` gives 1/10^9.
 *
 * @throws RangeError when the text is not a decimal.
 */
export const fromDecimal = (text: string): Rational => {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text.trim());
  if (match === null || (match[2] === "" && (match[3] ?? "") === "")) {
    throw new RangeError(`not a decimal: ${text}`);
  }
  const [, sign, whole = "", fraction = "", exponent = "0"] = match;
  const digits = BigInt(`${whole}${fraction}` || "0");
  const shift = BigInt(exponent) - BigInt(fraction.length);
  const magnitude = shift >= 0n ? rational(digits * 10n ** shift) : rational(digits, 10n ** -shift);
  return sign === "-" ? neg(magnitude) : magnitude;
};

/**
 * This function reads a finite number as JavaScript prints it. That text is the shortest decimal that reads back as
 * the same number. Thus `0.1` gives 1/10, not the exact value of the double. Use `fromFloat` for the exact value.
 *
 * @throws RangeError when the number is not finite.
 */
export const fromNumber = (value: number): Rational => {
  if (!Number.isFinite(value)) throw new RangeError(`not a finite number: ${String(value)}`);
  return fromDecimal(String(value));
};

const view = new DataView(new ArrayBuffer(8));

/**
 * This function gives the exact value of a finite double. Thus `0.1` gives 3602879701896397/2^55. The value `-0`
 * gives 0.
 *
 * @throws RangeError when the number is not finite.
 */
export const fromFloat = (value: number): Rational => {
  if (!Number.isFinite(value)) throw new RangeError(`not a finite number: ${String(value)}`);
  if (Number.isSafeInteger(value)) return make(BigInt(value), 1n);
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xfffffffffffffn;
  let mantissa = biased === 0 ? fraction : fraction | 0x10000000000000n;
  let exponent = (biased === 0 ? 1 : biased) - 1075;
  // the denominator is a power of 2, so the lowest terms remove the factors 2 of the mantissa
  while (exponent < 0 && (mantissa & 1n) === 0n) {
    mantissa >>= 1n;
    exponent += 1;
  }
  const n = bits >> 63n === 1n ? -mantissa : mantissa;
  return exponent >= 0 ? make(n << BigInt(exponent), 1n) : make(n, 1n << BigInt(-exponent));
};

/** This function gives `a + b`. The result is exact. */
export const add = (a: Rational, b: Rational): Rational =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);

/** This function gives `a - b`. The result is exact. */
export const sub = (a: Rational, b: Rational): Rational =>
  rational(a.n * b.d - b.n * a.d, a.d * b.d);

/** This function gives `a × b`. The result is exact. */
export const mul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);

/**
 * This function gives `a / b`. The result is exact.
 *
 * @throws RangeError when `b` is 0.
 */
export const div = (a: Rational, b: Rational): Rational => {
  if (b.n === 0n) throw new RangeError("division by zero");
  return rational(a.n * b.d, a.d * b.n);
};

/** This function gives `-a`. The result is exact. */
export const neg = (a: Rational): Rational => make(-a.n, a.d);

/** This function gives `|a|`. The result is exact. */
export const abs = (a: Rational): Rational => (a.n < 0n ? make(-a.n, a.d) : a);

/**
 * This function gives `1 / a`. The result is exact.
 *
 * @throws RangeError when `a` is 0.
 */
export const inverse = (a: Rational): Rational => {
  if (a.n === 0n) throw new RangeError("division by zero");
  return a.n < 0n ? make(-a.d, -a.n) : make(a.d, a.n);
};

/**
 * This function gives `a` to an integer power. The result is exact. The power 0 of each value, 0 too, is 1.
 *
 * @throws RangeError when the exponent is not an integer, or when `a` is 0 and the exponent is less than 0.
 */
export const pow = (a: Rational, exponent: number): Rational => {
  if (!Number.isInteger(exponent)) throw new RangeError(`not an integer exponent: ${exponent}`);
  const e = BigInt(Math.abs(exponent));
  // the powers of two coprime integers are coprime, so the result needs no gcd
  const raised = make(a.n ** e, a.d ** e);
  return exponent < 0 ? inverse(raised) : raised;
};

/**
 * This function gives the floor of the `k`-th root of `n`: the largest integer `r` with `r^k <= n`. The result is
 * exact. The search starts above the root, from the bit length of `n`, and the Newton steps go down to the root.
 *
 * @param n - A value that is not less than `0n`.
 * @param k - An integer index of 1 or more.
 * @throws RangeError when `n` is less than `0n`, or when `k` is not an integer of 1 or more.
 */
export const integerRoot = (n: bigint, k: number): bigint => {
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`not an index of a root: ${k}`);
  if (n < 0n) throw new RangeError("integerRoot needs a value of 0 or more");
  if (n < 2n || k === 1) return n;
  const K = BigInt(k);
  // 2^ceil(bits / k) is more than the root, and from above each Newton step goes down and stays above the root
  let x = 1n << BigInt(Math.ceil(hexBits(n) / k));
  for (;;) {
    const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
    if (y >= x) return x;
    x = y;
  }
};

/**
 * This function gives the `k`-th root of `a` when it is a rational, and `null` when it is not. The root of a rational
 * in lowest terms is rational only when its numerator and its denominator are both `k`-th powers of integers. An odd
 * index gives the negative root of a negative value. The result is exact.
 *
 * @param a - The value.
 * @param k - An integer index of 1 or more.
 * @throws RangeError when `k` is not an integer of 1 or more, or when `k` is even and `a` is less than 0.
 */
export const root = (a: Rational, k: number): Rational | null => {
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`not an index of a root: ${k}`);
  const negative = a.n < 0n;
  if (negative && k % 2 === 0) throw new RangeError("an even root of a negative value is not real");
  const K = BigInt(k);
  const n = negative ? -a.n : a.n;
  const rn = integerRoot(n, k);
  if (rn ** K !== n) return null;
  const rd = integerRoot(a.d, k);
  if (rd ** K !== a.d) return null;
  // the roots of two coprime integers are coprime, so the result needs no gcd
  return make(negative ? -rn : rn, rd);
};

/** This function gives -1, 0 or 1 for `a < b`, `a = b` or `a > b`. The result is exact. */
export const compare = (a: Rational, b: Rational): -1 | 0 | 1 => {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
};

/** This function is `compare`, with the name that `@mark1russell7/quantity` uses. */
export const cmp: (a: Rational, b: Rational) => -1 | 0 | 1 = compare;

/** This function tells if `a = b`. Each rational is in lowest terms, so the test compares the fields. */
export const equals = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;

/** This function gives -1, 0 or 1 for a value that is less than 0, equal to 0 or more than 0. */
export const sign = (a: Rational): -1 | 0 | 1 => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);

/** This function tells if the value is an integer. */
export const isInteger = (a: Rational): boolean => a.d === 1n;

/** This function gives the greatest integer that is not more than the value. The result is exact. */
export const floor = (a: Rational): Rational => {
  const whole = a.n / a.d;
  return make(a.n < 0n && whole * a.d !== a.n ? whole - 1n : whole, 1n);
};

/** This function gives the least integer that is not less than the value. The result is exact. */
export const ceil = (a: Rational): Rational => neg(floor(neg(a)));

/** This function gives the text `"n/d"`, or `"n"` for an integer. The text is exact. */
export const toString = (a: Rational): string => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

const SAFE = 2n ** 53n;

/** This function gives a count of bits that is not less than the bit length of a positive `bigint`, and at most 3 more. */
const hexBits = (x: bigint): number => x.toString(16).length * 4;

/** This function gives `x × 2^k` with steps that stay in the range of normal doubles. */
const scale2 = (x: number, k: number): number => {
  while (k > 1000) {
    x *= 2 ** 1000;
    k -= 1000;
  }
  while (k < -1000) {
    x *= 2 ** -1000;
    k += 1000;
  }
  return x * 2 ** k;
};

/**
 * This function gives the nearest double to the value, with ties to even. The error is at most half a unit in the last
 * place. A value past the range of the doubles gives an infinity, and a value too small gives 0 or a subnormal.
 */
export const toNumber = (a: Rational): number => {
  const negative = a.n < 0n;
  const n = negative ? -a.n : a.n;
  const d = a.d;
  // both fields are exact doubles, and one IEEE division rounds to the nearest double
  if (n <= SAFE && d <= SAFE) return Number(a.n) / Number(d);
  if (d === 1n) return Number(a.n);
  const bitsN = hexBits(n);
  const bitsD = hexBits(d);
  let value: number;
  // the value is more than 2^(bitsN - 4 - bitsD), so a small gap of bits skips the exact test
  if (bitsD - bitsN + 4 > 1022 && n << 1022n < d) {
    // the value is less than 2^-1022: round to a whole count of the subnormal step 2^-1074, ties to even
    const scaled = n << 1074n;
    let q = scaled / d;
    const twice = (scaled - q * d) << 1n;
    if (twice > d || (twice === d && (q & 1n) === 1n)) q += 1n;
    value = Number(q) * Number.MIN_VALUE;
  } else {
    // a quotient of at least 67 bits, and a sticky bit for the remainder, give one correct rounding in Number()
    const s = bitsD - bitsN + 70;
    const top = s >= 0 ? n << BigInt(s) : n;
    const bottom = s >= 0 ? d : d << BigInt(-s);
    const q = top / bottom;
    const sticky = q * bottom === top ? 0n : 1n;
    value = scale2(Number((q << 1n) | sticky), -(s + 1));
  }
  return negative ? -value : value;
};
