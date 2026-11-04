/**
 * Rational functions in one canonical form: a quotient of two polynomials in lowest terms. The form also records the
 * points where the function has no value.
 *
 * Two fields hold the value. The numerator and the denominator have no common factor that is not a constant, and the
 * denominator has the leading coefficient 1. Each element of the field of rational functions has one such pair.
 *
 * The field `domain` is the stated answer for a zero denominator. The cancellation of `x / x` gives the pair `1 / 1`, but
 * the document has no value at 0. The domain keeps that fact. It is a monic polynomial with no repeated factor, and at
 * each real point `p`:
 *
 * - When the domain is 0 at `p`, the function has no value at `p`.
 * - When the domain is not 0 at `p`, the denominator is not 0 at `p`, and the value is the quotient of the two fields.
 *
 * Each zero of the denominator is a zero of the domain. The domain can have other zeros, and these are the holes.
 *
 * @packageDocumentation
 */
import { NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { attempt, divide, gcd, monic, must, radical, STEP_BITS } from "./gcd.ts";
import { constantOf, differentiate as differentiatePolynomial, evaluate as evaluatePolynomial, key as polynomialKey, LIMITS, multiply as multiplyPolynomials, negate as negatePolynomial, ONE, power as polynomialPower, scale, subtract as subtractPolynomials, sum, within, ZERO } from "./polynomial.ts";
import type { Limits, Polynomial } from "./polynomial.ts";

/** A rational function in canonical form. The functions of this module make only values of this form. */
export interface RationalFunction {
  readonly numerator: Polynomial;
  readonly denominator: Polynomial;
  /** The monic polynomial with no repeated factor whose real zeros are the points without a value. */
  readonly domain: Polynomial;
}

/** The result of an operation that has limits: a function, or `"no claim"` past a limit. */
export type LimitedFunction = RationalFunction | typeof NO_CLAIM;

/** The result of an operation that can have no value at each point. The value `null` states that. */
export type PartialFunction = RationalFunction | null | typeof NO_CLAIM;

/** This function gives a polynomial as a rational function. It has a value at each point. */
export function fromPolynomial(p: Polynomial): RationalFunction {
  return { numerator: p, denominator: ONE, domain: ONE };
}

/** This function gives the product of two polynomials. A product before a cancellation can hold more bits than its result. */
const times = (a: Polynomial, b: Polynomial, limits: Limits): Polynomial => must(multiplyPolynomials(a, b, { ...limits, maxBits: limits.maxBits * STEP_BITS }));

/** This function gives `a / b` for a division that is known to be exact. */
function over(a: Polynomial, b: Polynomial, limits: Limits): Polynomial {
  const out = must(divide(a, b, limits));
  if (out === undefined) throw new RangeError("A division that the proof calls exact has a remainder.");
  return out;
}

/** This function gives the quotient in lowest terms, with a monic denominator. */
function reduced(numerator: Polynomial, denominator: Polynomial, domain: Polynomial, limits: Limits): RationalFunction {
  const common = must(gcd(numerator, denominator, limits));
  const low = over(denominator, common, limits);
  const lead = low.terms[0]?.coefficient ?? Q.ONE;
  return { numerator: scale(over(numerator, common, limits), Q.inverse(lead)), denominator: monic(low), domain };
}

/** This function gives a monic polynomial with the zeros of `a` and `b`. Each one has no repeated factor. */
function joined(a: Polynomial, b: Polynomial, limits: Limits): Polynomial {
  if (a === ONE || constantOf(a) !== undefined) return b;
  if (b === ONE || constantOf(b) !== undefined) return a;
  if (polynomialKey(a) === polynomialKey(b)) return a;
  return monic(times(a, over(b, must(gcd(a, b, limits)), limits), limits));
}

/** This function gives a function with the zeros of `extra` added to its domain. */
function withDomain(f: RationalFunction, extra: Polynomial, limits: Limits): RationalFunction {
  return { ...f, domain: joined(f.domain, extra, limits) };
}

/**
 * This function gives a function with the zeros of another domain added. The value does not change at a point with a
 * value.
 *
 * @param f - The function.
 * @param domain - The other domain.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The function, or `"no claim"` past a limit.
 */
export function restrict(f: RationalFunction, domain: Polynomial, limits: Limits = LIMITS): LimitedFunction {
  return attempt(() => withDomain(f, domain, limits));
}

/**
 * This function gives `a + b` in lowest terms. The sum has no value where a part has no value.
 *
 * @param a - The left part.
 * @param b - The right part.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The sum, or `"no claim"` past a limit.
 */
export function add(a: RationalFunction, b: RationalFunction, limits: Limits = LIMITS): LimitedFunction {
  return attempt(() => {
    const domain = joined(a.domain, b.domain, limits);
    const common = must(gcd(a.denominator, b.denominator, limits));
    const left = over(b.denominator, common, limits);
    const right = over(a.denominator, common, limits);
    const numerator = sum([times(a.numerator, left, limits), times(b.numerator, right, limits)]);
    return reduced(numerator, times(a.denominator, left, limits), domain, limits);
  });
}

/** This function gives `-f`. */
export function negate(f: RationalFunction): RationalFunction {
  return { ...f, numerator: negatePolynomial(f.numerator) };
}

/**
 * This function gives `a - b` in lowest terms.
 *
 * @param a - The left part.
 * @param b - The right part.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The difference, or `"no claim"` past a limit.
 */
export function subtract(a: RationalFunction, b: RationalFunction, limits: Limits = LIMITS): LimitedFunction {
  return add(a, negate(b), limits);
}

/**
 * This function gives `a × b` in lowest terms. The product has no value where a part has no value, also where the other
 * part is 0.
 *
 * @param a - The left factor.
 * @param b - The right factor.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The product, or `"no claim"` past a limit.
 */
export function multiply(a: RationalFunction, b: RationalFunction, limits: Limits = LIMITS): LimitedFunction {
  return attempt(() => {
    const domain = joined(a.domain, b.domain, limits);
    return reduced(times(a.numerator, b.numerator, limits), times(a.denominator, b.denominator, limits), domain, limits);
  });
}

/**
 * This function gives `1 / f`. The inverse has no value where `f` has no value or where `f` is 0.
 *
 * @param f - The function.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The inverse, `null` when `f` is 0 at each point, or `"no claim"` past a limit.
 */
export function inverse(f: RationalFunction, limits: Limits = LIMITS): PartialFunction {
  const [first] = f.numerator.terms;
  if (first === undefined) return null;
  return attempt(() => {
    const domain = joined(f.domain, must(radical(f.numerator, limits)), limits);
    const scaled = Q.inverse(first.coefficient);
    return { numerator: scale(f.denominator, scaled), denominator: scale(f.numerator, scaled), domain };
  });
}

/**
 * This function gives `a / b`. The quotient has no value where a part has no value or where `b` is 0.
 *
 * @param a - The dividend.
 * @param b - The divisor.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The quotient, `null` when `b` is 0 at each point, or `"no claim"` past a limit.
 */
export function divideFunctions(a: RationalFunction, b: RationalFunction, limits: Limits = LIMITS): PartialFunction {
  const flipped = inverse(b, limits);
  return flipped === null || flipped === NO_CLAIM ? flipped : multiply(a, flipped, limits);
}

/**
 * This function gives `f` to a whole power. The power 0 is 1 where `f` has a value, as in the verb `exact`. A negative
 * power is the power of the inverse. A power of a pair in lowest terms stays in lowest terms, so this function needs no
 * gcd.
 *
 * @param f - The base.
 * @param exponent - The whole exponent.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The power, `null` for a negative power of 0, or `"no claim"` past a limit.
 */
export function power(f: RationalFunction, exponent: number, limits: Limits = LIMITS): PartialFunction {
  if (exponent < 0) {
    const flipped = inverse(f, limits);
    return flipped === null || flipped === NO_CLAIM ? flipped : power(flipped, -exponent, limits);
  }
  return attempt(() => ({
    numerator: must(polynomialPower(f.numerator, exponent, limits)),
    denominator: must(polynomialPower(f.denominator, exponent, limits)),
    domain: f.domain,
  }));
}

/**
 * This function gives the partial derivative by the quotient rule, in lowest terms. The derivative has the domain of
 * `f`, because the set of points with a value is open.
 *
 * @param f - The function.
 * @param name - The name of the variable.
 * @param limits - The limits of the operation. The default is `LIMITS`.
 * @returns The derivative, or `"no claim"` past a limit.
 */
export function differentiate(f: RationalFunction, name: string, limits: Limits = LIMITS): LimitedFunction {
  return attempt(() => {
    const left = times(differentiatePolynomial(f.numerator, name), f.denominator, limits);
    const right = times(f.numerator, differentiatePolynomial(f.denominator, name), limits);
    return reduced(subtractPolynomials(left, right), times(f.denominator, f.denominator, limits), f.domain, limits);
  });
}

/**
 * This function gives the value of a rational function at a point. The result is exact.
 *
 * @param f - The function.
 * @param values - The value of each variable of `f`.
 * @returns The exact value, or `null` when the function has no value at the point.
 * @throws RangeError when a variable of `f` has no value.
 */
export function evaluate(f: RationalFunction, values: Readonly<Record<string, Rational>>): Rational | null {
  if (Q.sign(evaluatePolynomial(f.domain, values)) === 0) return null;
  return Q.div(evaluatePolynomial(f.numerator, values), evaluatePolynomial(f.denominator, values));
}

/** This function gives the constant value of a function, and `undefined` for a function that is not a constant. */
export function constantValue(f: RationalFunction): Rational | undefined {
  return constantOf(f.denominator) === undefined ? undefined : constantOf(f.numerator);
}

/**
 * This function gives the canonical text of the value of a rational function, for example `(x + 1) / (x - 1)`. Two
 * functions have equal keys when, and only when, they are one element of the field of rational functions. The key does
 * not hold the domain.
 *
 * @param f - The function.
 * @returns The text.
 */
export function key(f: RationalFunction): string {
  const text = polynomialKey(f.numerator);
  if (f.denominator.terms.length === 1 && constantOf(f.denominator) !== undefined) return text;
  return `(${text}) / (${polynomialKey(f.denominator)})`;
}

/**
 * This function gives the function when each of its fields is in the limits.
 *
 * @param f - The function.
 * @param limits - The limits.
 * @returns The same function, or `"no claim"`.
 */
export function withinLimits(f: RationalFunction, limits: Limits): LimitedFunction {
  const fields = [f.numerator, f.denominator, f.domain];
  return fields.some((p) => within(p, limits) === NO_CLAIM) ? NO_CLAIM : f;
}

/** The constant function 0. */
export const ZERO_FUNCTION: RationalFunction = fromPolynomial(ZERO);
/** The constant function 1. */
export const ONE_FUNCTION: RationalFunction = fromPolynomial(ONE);
