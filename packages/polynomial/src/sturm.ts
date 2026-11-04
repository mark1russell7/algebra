/**
 * The isolation of the real roots of a polynomial in one variable with integer coefficients, by the theorem of Sturm.
 * The count of sign changes of the Sturm chain at two points gives the count of different roots between them. Thus each
 * result of this module is a proof and not an estimate.
 *
 * A polynomial here is a list of integer coefficients, from the power 0. The last element is not zero.
 *
 * @packageDocumentation
 */
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { integerGcd, STEP_BITS, stop } from "./gcd.ts";
import { coefficientsIn, constantOf } from "./polynomial.ts";
import type { Limits, Polynomial } from "./polynomial.ts";

/** A polynomial in one variable with integer coefficients, from the power 0. */
export type Dense = readonly bigint[];

/** The budget of one solution: the count of products of two integers that are left, and the bound of a coefficient. */
export interface Work {
  left: number;
  readonly bound: bigint;
}

/** This function gives the budget of one solution. */
export const workOf = (limits: Limits): Work => ({ left: limits.maxProducts, bound: 1n << BigInt(limits.maxBits * STEP_BITS) });

/** This function takes products from the budget. */
function charge(work: Work, count: number): void {
  work.left -= count;
  if (work.left < 0) stop();
}

const TWO = Q.rational(2n);
const magnitude = (value: bigint): bigint => (value < 0n ? -value : value);

/** This function gives the list of a polynomial in the variable `name`. Each coefficient of `p` is an integer. */
export function denseOf(p: Polynomial, name: string): Dense {
  return coefficientsIn(p, name).map((c) => {
    const value = constantOf(c);
    if (value === undefined || !Q.isInteger(value)) throw new RangeError("A dense polynomial has integer coefficients and one variable.");
    return value.n;
  });
}

/** This function gives the product of two polynomials. */
export function denseProduct(a: Dense, b: Dense, work: Work): Dense {
  charge(work, a.length * b.length);
  const out: bigint[] = Array.from({ length: a.length + b.length - 1 }, () => 0n);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = (out[i + j] as bigint) + x * y)));
  return out;
}

/**
 * This function gives the sign of a polynomial at a rational. The Horner form below has no denominator, and it is the
 * value times a positive power of `x.d`.
 *
 * @param p - The polynomial.
 * @param x - The point.
 * @param work - The budget.
 * @returns The exact sign of the value.
 */
export function signAt(p: Dense, x: Rational, work: Work): -1 | 0 | 1 {
  charge(work, 3 * p.length);
  let value = 0n;
  let scale = 1n;
  for (let i = p.length - 1; i >= 0; i--) {
    value = value * x.n + (p[i] as bigint) * scale;
    scale *= x.d;
  }
  return value < 0n ? -1 : value > 0n ? 1 : 0;
}

/** This function divides a polynomial by the gcd of its coefficients. The divisor is positive, so the signs stay. */
function withoutContent(p: Dense, work: Work): Dense {
  let content = 0n;
  for (const c of p) {
    content = integerGcd(content, c);
    if (content === 1n) break;
  }
  const out = content === 1n ? p : p.map((c) => c / content);
  if (out.some((c) => magnitude(c) >= work.bound)) stop();
  return out;
}

/** This function gives a positive multiple of `a`, minus a multiple of `b`, with a degree less than the degree of `b`. */
function remainder(a: Dense, b: Dense, work: Work): Dense {
  const lead = b[b.length - 1] as bigint;
  const size = magnitude(lead);
  const side = lead < 0n ? -1n : 1n;
  let rest = [...a];
  while (rest.length >= b.length) {
    const top = rest[rest.length - 1] as bigint;
    const shift = rest.length - b.length;
    charge(work, rest.length + b.length);
    const next = rest.map((c) => c * size);
    b.forEach((c, i) => (next[i + shift] = (next[i + shift] as bigint) - side * top * c));
    next.pop();
    while (next.length > 0 && next[next.length - 1] === 0n) next.pop();
    rest = next;
  }
  return rest;
}

/** This function gives the Sturm chain of a polynomial with no repeated root. It ends at a constant that is not zero. */
function sturmChain(p: Dense, work: Work): readonly Dense[] {
  const slope = p.slice(1).map((c, i) => c * BigInt(i + 1));
  const chain = [withoutContent(p, work), withoutContent(slope, work)];
  for (;;) {
    const a = chain[chain.length - 2] as Dense;
    const b = chain[chain.length - 1] as Dense;
    if (b.length === 1) return chain;
    const rest = remainder(a, b, work);
    if (rest.length === 0) throw new RangeError("A Sturm chain needs a polynomial with no repeated root.");
    chain.push(withoutContent(rest, work).map((c) => -c));
  }
}

/** This function gives the count of sign changes of a chain at a point. A zero is not a change. */
function variations(chain: readonly Dense[], x: Rational, work: Work): number {
  let count = 0;
  let last = 0;
  for (const p of chain) {
    const s = signAt(p, x, work);
    if (s !== 0 && s !== last) {
      if (last !== 0) count += 1;
      last = s;
    }
  }
  return count;
}

/** This function gives a power of two with no root of `p` at or past its magnitude, by the bound of Cauchy. */
function rootBound(p: Dense): bigint {
  const lead = magnitude(p[p.length - 1] as bigint);
  const largest = p.slice(0, -1).reduce((best, c) => (magnitude(c) > best ? magnitude(c) : best), 0n);
  return 1n << BigInt((largest / lead + 2n).toString(2).length);
}

/** An isolated root: an exact value, or an open interval with one root and no root at its ends. */
export type Bracket = { readonly value: Rational } | { readonly lower: Rational; readonly upper: Rational };

/**
 * This function isolates the real roots of a polynomial with no repeated root. The count of `V(a) - V(b)` of a half-open
 * interval `(a, b]` is the count of roots in it, also when `a` or `b` is a root. Thus a bisection keeps each root, and
 * the brackets of the result have each real root one time, in increasing order.
 *
 * @param p - The polynomial, with a degree of 1 or more.
 * @param work - The budget.
 * @returns The brackets.
 */
export function isolate(p: Dense, work: Work): readonly Bracket[] {
  const chain = sturmChain(p, work);
  const count = (x: Rational): number => variations(chain, x, work);
  const bound = Q.rational(rootBound(p));
  const lowest = Q.neg(bound);
  const out: Bracket[] = [];
  const stack = [{ lower: lowest, upper: bound, low: count(lowest), high: count(bound) }];
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const { lower, upper, low, high } = item;
    const inside = low - high;
    if (inside === 0) continue;
    if (inside === 1) {
      if (signAt(p, upper, work) === 0) {
        out.push({ value: upper });
        continue;
      }
      if (signAt(p, lower, work) !== 0) {
        out.push({ lower, upper });
        continue;
      }
    }
    const middle = Q.div(Q.add(lower, upper), TWO);
    const at = count(middle);
    stack.push({ lower: middle, upper, low: at, high }, { lower, upper: middle, low, high: at });
  }
  return out;
}

/**
 * This function narrows an interval with one root of multiplicity 1, and it tells if the root is rational. A rational root of an
 * integer polynomial is a multiple of `1 / a`, for the leading coefficient `a`: this fact is the rational root theorem.
 * An interval shorter than `1 / a` holds one such multiple or none, so one exact substitution decides. A bracket with
 * ends in the result holds an irrational root.
 *
 * @param p - The polynomial, with one sign at `lower` and the other sign at `upper`.
 * @param bracket - The interval.
 * @param tolerance - The largest width of an interval of the result.
 * @param work - The budget.
 * @returns The exact root, or an interval that is not wider than `tolerance` around an irrational root.
 */
export function narrow(p: Dense, bracket: { readonly lower: Rational; readonly upper: Rational }, tolerance: Rational, work: Work): Bracket {
  let { lower, upper } = bracket;
  const below = signAt(p, lower, work);
  const lead = Q.rational(magnitude(p[p.length - 1] as bigint));
  const unit = Q.inverse(lead);
  const width = (): Rational => Q.sub(upper, lower);
  /** This function halves the interval, and it gives the middle when the middle is the root. */
  const halve = (): Rational | undefined => {
    const middle = Q.div(Q.add(lower, upper), TWO);
    const s = signAt(p, middle, work);
    if (s === 0) return middle;
    if (s === below) lower = middle;
    else upper = middle;
    return undefined;
  };
  while (Q.compare(width(), unit) >= 0) {
    const root = halve();
    if (root !== undefined) return { value: root };
  }
  const candidate = Q.div(Q.ceil(Q.mul(lower, lead)), lead);
  const inside = Q.compare(lower, candidate) < 0 && Q.compare(candidate, upper) < 0;
  if (inside && signAt(p, candidate, work) === 0) return { value: candidate };
  while (Q.compare(width(), tolerance) > 0) {
    const root = halve();
    if (root !== undefined) return { value: root };
  }
  return { lower, upper };
}
