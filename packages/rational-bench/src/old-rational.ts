/**
 * The old rationals of `@mark1russell7/quantity`: the base arm of the bench. The code is a copy of
 * `packages/quantity/src/rational.ts` of the repository `mark1russell7/systems` at the commit
 * `3179488596e060505f2b747c7b8a0445922e3659`. That commit is the parent of `b435114`, where quantity changed to
 * `@mark1russell7/rational`. Only the comments are new. Do not change the code: it is the base of the time claim of A2.
 *
 * @packageDocumentation
 */

/** A rational number over `bigint`. */
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

/** This function makes the rational `n / d` in lowest terms. */
export const rational = (n: bigint, d: bigint = 1n): Rational => {
  if (d === 0n) throw new RangeError("a rational cannot have a zero denominator");
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
};

/** The rational 1. */
export const ONE: Rational = rational(1n);
/** The rational 0. */
export const ZERO: Rational = rational(0n);

/** This function reads a decimal from its text, exactly. */
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

/** This function reads a finite number as JavaScript prints it. */
export const fromNumber = (value: number): Rational => {
  if (!Number.isFinite(value)) throw new RangeError(`not a finite number: ${String(value)}`);
  return fromDecimal(String(value));
};

/** This function gives `a + b`. */
export const add = (a: Rational, b: Rational): Rational =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
/** This function gives `a - b`. */
export const sub = (a: Rational, b: Rational): Rational =>
  rational(a.n * b.d - b.n * a.d, a.d * b.d);
/** This function gives `a × b`. */
export const mul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
/** This function gives `a / b`. */
export const div = (a: Rational, b: Rational): Rational => {
  if (b.n === 0n) throw new RangeError("division by zero");
  return rational(a.n * b.d, a.d * b.n);
};
/** This function gives `-a`. */
export const neg = (a: Rational): Rational => rational(-a.n, a.d);
/** This function gives `a` to an integer power. */
export const pow = (a: Rational, exponent: number): Rational => {
  if (!Number.isInteger(exponent)) throw new RangeError(`not an integer exponent: ${exponent}`);
  const e = BigInt(Math.abs(exponent));
  const raised = rational(a.n ** e, a.d ** e);
  return exponent < 0 ? div(ONE, raised) : raised;
};
/** This function gives -1, 0 or 1 for `a < b`, `a = b` or `a > b`. */
export const cmp = (a: Rational, b: Rational): number => {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
};
/** This function tells if the value is an integer. */
export const isInteger = (a: Rational): boolean => a.d === 1n;

/** This function gives the greatest integer that is not more than the value. */
export const floor = (a: Rational): Rational => {
  const whole = a.n / a.d;
  return rational(a.n < 0n && whole * a.d !== a.n ? whole - 1n : whole);
};

/** This function gives the least integer that is not less than the value. */
export const ceil = (a: Rational): Rational => neg(floor(neg(a)));

/** This function gives a double near the value, from a decimal text of 20 significant digits. */
export const toNumber = (a: Rational): number => {
  if (a.d === 1n) return Number(a.n);
  const negative = a.n < 0n;
  const n = negative ? -a.n : a.n;
  // the decimal places give 20 significant digits for each size of the value, then one rounding
  const places = 20 + Math.max(0, a.d.toString().length - n.toString().length);
  const value = Number(`${(n * 10n ** BigInt(places)) / a.d}e-${places}`);
  return negative ? -value : value;
};
