/**
 * Polynomials in several variables with exact rational coefficients, in one canonical form. Two polynomials that are
 * equal as functions have equal fields and equal keys. The rationals are in lowest terms, and the rules below fix the
 * rest.
 *
 * - The variables of a term are sorted by the code units of their names, and each variable occurs one time.
 * - The terms are in the graded lexicographic order: the larger total degree is first, and then the larger exponent of
 *   the first variable that differs.
 * - No term has a coefficient of zero. Thus the zero polynomial has no terms.
 *
 * Each operation of this module is exact. A product and a power stop at the limits, and they give `"no claim"`.
 *
 * @packageDocumentation
 */
import { EXACT_BITS, NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/** One variable of a term, with an exponent of 1 or more. */
export interface Power {
  readonly variable: string;
  readonly exponent: number;
}

/** One term: a coefficient that is not zero and the powers of its variables. A constant has no powers. */
export interface Term {
  readonly coefficient: Rational;
  readonly powers: readonly Power[];
}

/** A polynomial in canonical form. The functions of this module make only values of this form. */
export interface Polynomial {
  readonly terms: readonly Term[];
}

/** The limits of the size of a polynomial. A node past a limit gives `"no claim"`. */
export interface Limits {
  /** The largest count of terms of a node. A product also stops at this count of monomials, before cancellation. */
  readonly maxTerms: number;
  /** The largest total degree of a node, and the largest exponent of `pow` and index of `root`. */
  readonly maxDegree: number;
  /** The largest count of bits of the numerator and of the denominator of a coefficient. */
  readonly maxBits: number;
  /** The largest count of products of two terms in one node. This limit keeps the time of one node small. */
  readonly maxProducts: number;
}

/** The default largest count of terms of a node. */
export const TERM_LIMIT: number = 4096;
/** The default largest total degree of a node. */
export const DEGREE_LIMIT: number = 4096;
/** The default largest count of products of two terms in one node. */
export const PRODUCT_LIMIT: number = 1_048_576;

/** The default limits. The limit of the bits is `EXACT_BITS`, the limit of the verb `exact`. */
export const LIMITS: Limits = { maxTerms: TERM_LIMIT, maxDegree: DEGREE_LIMIT, maxBits: EXACT_BITS, maxProducts: PRODUCT_LIMIT };

/** The result of an operation that has limits: a polynomial, or `"no claim"` past a limit. */
export type Limited = Polynomial | typeof NO_CLAIM;

/** The zero polynomial. */
export const ZERO: Polynomial = { terms: [] };
/** The polynomial 1. */
export const ONE: Polynomial = { terms: [{ coefficient: Q.ONE, powers: [] }] };

const degreeOf = (powers: readonly Power[]): number => powers.reduce((sum, p) => sum + p.exponent, 0);

/** This function gives the order of two names by their code units. It does not use a locale. */
const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** This function gives the graded lexicographic order of two monomials. The larger monomial is first. */
function compareMonomials(a: readonly Power[], b: readonly Power[]): number {
  const degrees = degreeOf(b) - degreeOf(a);
  if (degrees !== 0) return degrees;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const p = a[i] as Power;
    const q = b[i] as Power;
    if (p.variable !== q.variable) return compareNames(p.variable, q.variable);
    if (p.exponent !== q.exponent) return q.exponent - p.exponent;
  }
  return 0;
}

/** This function gives the text of a monomial, which is the same for equal monomials. A constant gives the empty text. */
const monomialText = (powers: readonly Power[]): string =>
  powers.map((p) => (p.exponent === 1 ? p.variable : `${p.variable}^${p.exponent}`)).join("*");

/** This function gives the product of two monomials: a merge of two sorted lists. */
function multiplyMonomials(a: readonly Power[], b: readonly Power[]): readonly Power[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out: Power[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const p = a[i] as Power;
    const q = b[j] as Power;
    const order = compareNames(p.variable, q.variable);
    if (order < 0) {
      out.push(p);
      i += 1;
    } else if (order > 0) {
      out.push(q);
      j += 1;
    } else {
      out.push({ variable: p.variable, exponent: p.exponent + q.exponent });
      i += 1;
      j += 1;
    }
  }
  while (i < a.length) out.push(a[i++] as Power);
  while (j < b.length) out.push(b[j++] as Power);
  return out;
}

/** A collection of terms by the text of the monomial. A coefficient can be zero until `canonical`. */
type Collected = Map<string, Term>;

/** This function adds a coefficient to the term of a monomial. */
function collect(out: Collected, coefficient: Rational, powers: readonly Power[]): void {
  const text = monomialText(powers);
  const found = out.get(text);
  out.set(text, { coefficient: found === undefined ? coefficient : Q.add(found.coefficient, coefficient), powers });
}

/** This function gives the canonical form of a collection: it removes the zero terms and sorts the others. */
function canonical(terms: Collected): Polynomial {
  const kept = [...terms.values()].filter((t) => Q.sign(t.coefficient) !== 0);
  return { terms: kept.sort((a, b) => compareMonomials(a.powers, b.powers)) };
}

/** This function gives the polynomial of one constant. */
export function constant(value: Rational): Polynomial {
  return Q.sign(value) === 0 ? ZERO : { terms: [{ coefficient: value, powers: [] }] };
}

/** This function gives the polynomial of one variable. */
export function variable(name: string): Polynomial {
  return { terms: [{ coefficient: Q.ONE, powers: [{ variable: name, exponent: 1 }] }] };
}

/** This function gives the value of a polynomial with no variables, and `undefined` for each other polynomial. */
export function constantOf(p: Polynomial): Rational | undefined {
  const [first] = p.terms;
  if (first === undefined) return Q.ZERO;
  return p.terms.length === 1 && first.powers.length === 0 ? first.coefficient : undefined;
}

/** This function gives the total degree. The zero polynomial has the degree 0 here. */
export function degree(p: Polynomial): number {
  // the graded order puts a term of the largest degree first
  const [first] = p.terms;
  return first === undefined ? 0 : degreeOf(first.powers);
}

/** This function gives the sum of the polynomials. */
export function sum(parts: readonly Polynomial[]): Polynomial {
  const out: Collected = new Map();
  for (const part of parts) for (const t of part.terms) collect(out, t.coefficient, t.powers);
  return canonical(out);
}

/** This function gives the polynomial `value × p`. */
export function scale(p: Polynomial, value: Rational): Polynomial {
  if (Q.sign(value) === 0) return ZERO;
  return { terms: p.terms.map((t) => ({ coefficient: Q.mul(t.coefficient, value), powers: t.powers })) };
}

/** This function gives `-p`. */
export function negate(p: Polynomial): Polynomial {
  return { terms: p.terms.map((t) => ({ coefficient: Q.neg(t.coefficient), powers: t.powers })) };
}

/** This function gives `a - b`. */
export function subtract(a: Polynomial, b: Polynomial): Polynomial {
  return sum([a, negate(b)]);
}

/** This function gives the coefficient bound of `maxBits` as one `bigint`. */
const bitBound = (limits: Limits): bigint => 1n << BigInt(limits.maxBits);

/**
 * This function gives the polynomial when it is in the limits, and `"no claim"` when it is not.
 *
 * @param p - The polynomial.
 * @param limits - The limits.
 * @returns The same polynomial, or `"no claim"`.
 */
export function within(p: Polynomial, limits: Limits): Limited {
  if (p.terms.length > limits.maxTerms || degree(p) > limits.maxDegree) return NO_CLAIM;
  const bound = bitBound(limits);
  for (const { coefficient: c } of p.terms) if ((c.n < 0n ? -c.n : c.n) >= bound || c.d >= bound) return NO_CLAIM;
  return p;
}

/**
 * This function gives `a × b`. It stops before the first product when the count of products is past `maxProducts`. It
 * stops during the products when the count of different monomials is past `maxTerms`. Both counts do not depend on the
 * order of `a` and `b`, so `a × b` and `b × a` give one result.
 *
 * @param a - The left factor.
 * @param b - The right factor.
 * @param limits - The limits.
 * @returns The product, or `"no claim"` past a limit.
 */
export function multiply(a: Polynomial, b: Polynomial, limits: Limits): Limited {
  if (a.terms.length * b.terms.length > limits.maxProducts) return NO_CLAIM;
  const out: Collected = new Map();
  for (const s of a.terms) {
    for (const t of b.terms) {
      collect(out, Q.mul(s.coefficient, t.coefficient), multiplyMonomials(s.powers, t.powers));
      if (out.size > limits.maxTerms) return NO_CLAIM;
    }
  }
  return within(canonical(out), limits);
}

/**
 * This function gives `p` to a whole power of 0 or more. The power 0 of each polynomial, the zero polynomial too, is 1.
 * The products of all steps count against `maxProducts`.
 *
 * @param p - The base.
 * @param exponent - The whole exponent.
 * @param limits - The limits.
 * @returns The power, or `"no claim"` when the exponent or a step is past a limit.
 */
export function power(p: Polynomial, exponent: number, limits: Limits): Limited {
  if (exponent === 0) return ONE;
  if (exponent > limits.maxDegree) return NO_CLAIM;
  let products = 0;
  let out = p;
  for (let i = 1; i < exponent; i++) {
    products += out.terms.length * p.terms.length;
    if (products > limits.maxProducts) return NO_CLAIM;
    const next = multiply(out, p, limits);
    if (next === NO_CLAIM) return NO_CLAIM;
    out = next;
  }
  return out;
}

/**
 * This function gives the partial derivative. The result is exact. It is the derivative of the polynomial function, so
 * the limits do not apply.
 *
 * @param p - The polynomial.
 * @param name - The name of the variable.
 * @returns The derivative of `p` for the variable.
 */
export function differentiate(p: Polynomial, name: string): Polynomial {
  const out: Collected = new Map();
  for (const t of p.terms) {
    const found = t.powers.find((q) => q.variable === name);
    if (found === undefined) continue;
    const powers = t.powers.flatMap((q) => (q !== found ? [q] : q.exponent === 1 ? [] : [{ variable: name, exponent: q.exponent - 1 }]));
    collect(out, Q.mul(t.coefficient, Q.rational(BigInt(found.exponent))), powers);
  }
  return canonical(out);
}

/**
 * This function gives the value of a polynomial at a point. The result is exact.
 *
 * @param p - The polynomial.
 * @param values - The value of each variable of `p`.
 * @returns The exact value.
 * @throws RangeError when a variable of `p` has no value.
 */
export function evaluate(p: Polynomial, values: Readonly<Record<string, Rational>>): Rational {
  let out = Q.ZERO;
  for (const t of p.terms) {
    let term = t.coefficient;
    for (const { variable: name, exponent } of t.powers) {
      const value = values[name];
      if (value === undefined) throw new RangeError(`The variable ${name} has no value.`);
      term = Q.mul(term, Q.pow(value, exponent));
    }
    out = Q.add(out, term);
  }
  return out;
}

/**
 * This function gives the canonical text of a polynomial, for example `x^2 + 2*x*y - 3/2*y + 1`. Two polynomials have
 * equal keys when, and only when, they are equal. The zero polynomial has the key `0`.
 *
 * @param p - The polynomial.
 * @returns The text.
 */
export function key(p: Polynomial): string {
  if (p.terms.length === 0) return "0";
  return p.terms
    .map((t, i) => {
      const magnitude = Q.abs(t.coefficient);
      const monomial = monomialText(t.powers);
      const text = monomial === "" ? Q.toString(magnitude) : Q.equals(magnitude, Q.ONE) ? monomial : `${Q.toString(magnitude)}*${monomial}`;
      const minus = Q.sign(t.coefficient) < 0;
      return i === 0 ? `${minus ? "-" : ""}${text}` : `${minus ? " - " : " + "}${text}`;
    })
    .join("");
}
