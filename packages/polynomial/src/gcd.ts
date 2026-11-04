/**
 * The greatest common divisor of two polynomials in several variables over the rationals, by the subresultant remainder
 * sequence. The polynomial ring is a unique factorization domain, so the gcd is one polynomial up to a constant factor.
 * The functions of this module fix the factor.
 *
 * Each operation is exact, and each one has the budget `maxProducts` of products of two terms. The coefficients of the
 * steps of a sequence are larger than the coefficients of the result. Thus a step can hold `STEP_BITS` times `maxBits` bits. An operation past a limit gives `"no claim"`.
 *
 * @packageDocumentation
 */
import { NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import { coefficientsIn, constantOf, degree, differentiate, fromCoefficients, LIMITS, multiply, ONE, scale, subtract, variablesOf, ZERO } from "./polynomial.ts";
import type { Limited, Limits, Polynomial } from "./polynomial.ts";

/** The factor of `maxBits` for the coefficients of the steps of a sequence. */
export const STEP_BITS = 16;

/** The signal of an operation that is past a limit. `attempt` changes it into `"no claim"`. */
class PastLimit extends Error {}

/** This function gives a value. It stops the operation of `attempt` when the value is `"no claim"`. */
export function must<T>(value: T | typeof NO_CLAIM): T {
  if (value === NO_CLAIM) throw new PastLimit();
  return value as T;
}

/** This function stops the operation of `attempt`. */
export function stop(): never {
  throw new PastLimit();
}

/** This function gives the result of an operation, or `"no claim"` when the operation stops at a limit. */
export function attempt<T>(run: () => T): T | typeof NO_CLAIM {
  try {
    return run();
  } catch (error) {
    if (error instanceof PastLimit) return NO_CLAIM;
    throw error;
  }
}

/** The budget of one operation. */
interface Work {
  readonly limits: Limits;
  left: number;
}

const workOf = (limits: Limits): Work => ({ limits: { ...limits, maxBits: limits.maxBits * STEP_BITS }, left: limits.maxProducts });

/** This function gives `a × b`, and it takes the products from the budget. */
function times(a: Polynomial, b: Polynomial, work: Work): Polynomial {
  work.left -= a.terms.length * b.terms.length;
  if (work.left < 0) stop();
  return must(multiply(a, b, work.limits));
}

function raised(p: Polynomial, exponent: number, work: Work): Polynomial {
  let out = ONE;
  for (let i = 0; i < exponent; i++) out = times(out, p, work);
  return out;
}

const magnitude = (value: bigint): bigint => (value < 0n ? -value : value);

/**
 * This function gives the greatest common divisor of two integers. The rationals of `@mark1russell7/rational` are in
 * lowest terms, so `a / b` has the numerator `a / gcd(a, b)`.
 */
export function integerGcd(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return magnitude(a + b);
  return magnitude(a / Q.rational(a, b).n);
}

/**
 * This function gives the one constant multiple of a polynomial with integer coefficients, a gcd of 1 of these
 * coefficients and a positive leading coefficient. The zero polynomial gives the zero polynomial.
 *
 * @param p - The polynomial.
 * @returns The multiple.
 */
export function primitive(p: Polynomial): Polynomial {
  const [first] = p.terms;
  if (first === undefined) return ZERO;
  let common = 1n;
  for (const { coefficient: c } of p.terms) common *= Q.rational(c.d, common).n;
  let content = 0n;
  for (const { coefficient: c } of p.terms) {
    content = integerGcd(content, c.n * (common / c.d));
    if (content === 1n) break;
  }
  return scale(p, Q.rational(Q.sign(first.coefficient) < 0 ? -common : common, content));
}

/**
 * This function gives the one constant multiple of a polynomial with the leading coefficient 1. The zero polynomial
 * gives the zero polynomial.
 *
 * @param p - The polynomial.
 * @returns The multiple.
 */
export function monic(p: Polynomial): Polynomial {
  const [first] = p.terms;
  return first === undefined ? ZERO : scale(p, Q.inverse(first.coefficient));
}

/** This function gives the first variable of two polynomials, in the order of the code units of the names. */
function mainVariable(a: Polynomial, b: Polynomial): string {
  const [first] = [...variablesOf(a), ...variablesOf(b)].sort();
  if (first === undefined) throw new RangeError("Two constants have no variable.");
  return first;
}

/** This function removes the zero coefficients at the end of a list. */
function trimmed(coefficients: readonly Polynomial[]): Polynomial[] {
  const out = [...coefficients];
  while (out.length > 0 && (out[out.length - 1] as Polynomial).terms.length === 0) out.pop();
  return out;
}

/** This function gives `a / b` when `b` divides `a`, and `undefined` when it does not. */
function quotient(a: Polynomial, b: Polynomial, work: Work): Polynomial | undefined {
  if (a.terms.length === 0) return ZERO;
  const value = constantOf(b);
  if (value !== undefined) return scale(a, Q.inverse(value));
  if (constantOf(a) !== undefined) return undefined;
  const name = mainVariable(a, b);
  const rest = [...coefficientsIn(a, name)];
  const divisor = coefficientsIn(b, name);
  const top = divisor.length - 1;
  const lead = divisor[top] as Polynomial;
  if (rest.length < divisor.length) return undefined;
  const out: Polynomial[] = Array.from({ length: rest.length - top }, () => ZERO);
  for (let k = rest.length - divisor.length; k >= 0; k--) {
    const head = rest[k + top] as Polynomial;
    if (head.terms.length === 0) continue;
    const step = quotient(head, lead, work);
    if (step === undefined) return undefined;
    out[k] = step;
    divisor.forEach((c, i) => {
      rest[k + i] = subtract(rest[k + i] as Polynomial, times(step, c, work));
    });
  }
  return rest.every((c) => c.terms.length === 0) ? fromCoefficients(out, name) : undefined;
}

/** This function gives `a / b` for a division that is known to be exact. */
function exactly(a: Polynomial, b: Polynomial, work: Work): Polynomial {
  const out = quotient(a, b, work);
  if (out === undefined) throw new RangeError("A division that the proof calls exact has a remainder.");
  return out;
}

/** This function gives the content of a list of coefficients: their gcd. */
function contentOf(coefficients: readonly Polynomial[], work: Work): Polynomial {
  let out = ZERO;
  for (const c of coefficients) {
    out = gcdOf(out, c, work);
    if (out.terms.length === 1 && constantOf(out) !== undefined) return ONE;
  }
  return out;
}

/** This function gives the pseudo-remainder: `c × a - q × b`, with `c` the power `deg a - deg b + 1` of the lead of `b`. */
function pseudoRemainder(a: readonly Polynomial[], b: readonly Polynomial[], work: Work): Polynomial[] {
  const lead = b[b.length - 1] as Polynomial;
  let rest = [...a];
  let left = a.length - b.length + 1;
  while (rest.length >= b.length) {
    const head = rest[rest.length - 1] as Polynomial;
    const shift = rest.length - b.length;
    const next = rest.map((c) => times(c, lead, work));
    b.forEach((c, i) => {
      next[i + shift] = subtract(next[i + shift] as Polynomial, times(head, c, work));
    });
    rest = trimmed(next);
    left -= 1;
  }
  const factor = raised(lead, left, work);
  return rest.map((c) => times(c, factor, work));
}

/**
 * This function gives the gcd of two lists of coefficients with content 1. It is the subresultant remainder sequence
 * of Brown and Traub. Each division of the sequence is exact, and the coefficients stay small.
 */
function sequence(first: readonly Polynomial[], second: readonly Polynomial[], work: Work): readonly Polynomial[] {
  let [a, b] = first.length >= second.length ? [first, second] : [second, first];
  let g = ONE;
  let h = ONE;
  for (;;) {
    const delta = a.length - b.length;
    const rest = pseudoRemainder(a, b, work);
    if (rest.length === 0) {
      const content = contentOf(b, work);
      return b.map((c) => exactly(c, content, work));
    }
    if (rest.length === 1) return [ONE];
    const divisor = times(g, raised(h, delta, work), work);
    a = b;
    b = rest.map((c) => exactly(c, divisor, work));
    g = a[a.length - 1] as Polynomial;
    h = delta === 0 ? h : exactly(raised(g, delta, work), raised(h, delta - 1, work), work);
  }
}

/** This function gives the content of a polynomial in one variable and its quotient by that content. */
function split(p: Polynomial, name: string, work: Work): readonly [Polynomial, readonly Polynomial[]] {
  const coefficients = coefficientsIn(p, name);
  const content = contentOf(coefficients, work);
  return [content, coefficients.map((c) => exactly(c, content, work))];
}

/** This function gives the gcd with integer coefficients, a gcd of 1 of these coefficients and a positive lead. */
function gcdOf(first: Polynomial, second: Polynomial, work: Work): Polynomial {
  const a = primitive(first);
  const b = primitive(second);
  if (a.terms.length === 0) return b;
  if (b.terms.length === 0) return a;
  if (constantOf(a) !== undefined || constantOf(b) !== undefined) return ONE;
  const name = mainVariable(a, b);
  const [contentA, restA] = split(a, name, work);
  const [contentB, restB] = split(b, name, work);
  const content = gcdOf(contentA, contentB, work);
  return primitive(times(content, fromCoefficients(sequence(restA, restB, work), name), work));
}

/**
 * This function gives the greatest common divisor of two polynomials. The result has integer coefficients, a gcd of 1
 * of these coefficients and a positive leading coefficient, so it is one polynomial for each pair. The gcd of a
 * polynomial and zero is its `primitive` multiple. The gcd of two zero polynomials is zero.
 *
 * @param a - The first polynomial.
 * @param b - The second polynomial.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The gcd, or `"no claim"` past a limit.
 */
export function gcd(a: Polynomial, b: Polynomial, limits: Limits = LIMITS): Limited {
  return attempt(() => gcdOf(a, b, workOf(limits)));
}

/**
 * This function gives the exact quotient of two polynomials.
 *
 * @param a - The dividend.
 * @param b - The divisor. It must not be zero.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The quotient, `undefined` when `b` does not divide `a`, or `"no claim"` past a limit.
 * @throws RangeError when `b` is zero.
 */
export function divide(a: Polynomial, b: Polynomial, limits: Limits = LIMITS): Limited | undefined {
  if (b.terms.length === 0) throw new RangeError("A polynomial has no quotient by zero.");
  return attempt(() => quotient(a, b, workOf(limits)));
}

/** This function gives the product of the different irreducible factors of a polynomial. */
function radicalOf(p: Polynomial, work: Work): Polynomial {
  if (constantOf(p) !== undefined) return p.terms.length === 0 ? ZERO : ONE;
  const name = variablesOf(p)[0] as string;
  const [content, rest] = split(p, name, work);
  const free = fromCoefficients(rest, name);
  return times(radicalOf(content, work), exactly(free, gcdOf(free, differentiate(free, name), work), work), work);
}

/**
 * This function gives the radical of a polynomial: the monic product of its different irreducible factors. The
 * polynomial and its radical have the same zeros, over the complex numbers too. The radical of a constant that is not
 * zero is 1.
 *
 * @param p - The polynomial.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The radical, or `"no claim"` past a limit.
 */
export function radical(p: Polynomial, limits: Limits = LIMITS): Limited {
  return attempt(() => monic(radicalOf(p, workOf(limits))));
}

/** One factor of a square-free decomposition: a polynomial with no repeated factor and the power of that polynomial. */
export interface SquareFreeFactor {
  readonly factor: Polynomial;
  readonly multiplicity: number;
}

/**
 * This function gives the square-free decomposition of a polynomial in one variable, by the algorithm of Yun. The
 * polynomial is a constant times the product of each `factor` to the power `multiplicity`. The factors have no common
 * zero.
 *
 * @param p - The polynomial. It has the one variable `name`, and it is not zero.
 * @param name - The name of the variable.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The factors that are not constants, or `"no claim"` past a limit.
 */
export function squareFree(p: Polynomial, name: string, limits: Limits = LIMITS): readonly SquareFreeFactor[] | typeof NO_CLAIM {
  return attempt(() => {
    const work = workOf(limits);
    const slope = differentiate(p, name);
    const common = gcdOf(p, slope, work);
    let rest = exactly(p, common, work);
    let change = subtract(exactly(slope, common, work), differentiate(rest, name));
    const out: SquareFreeFactor[] = [];
    for (let multiplicity = 1; degree(rest) > 0; multiplicity++) {
      const factor = gcdOf(rest, change, work);
      rest = exactly(rest, factor, work);
      change = subtract(exactly(change, factor, work), differentiate(rest, name));
      if (degree(factor) > 0) out.push({ factor, multiplicity });
    }
    return out;
  });
}
