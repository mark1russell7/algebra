/**
 * The polynomials in one variable over a ring of the catalog. A value is the list of its coefficients, the constant
 * first, with no zero at the end. This form is canonical, so the equality is the exact equality of the coefficients.
 *
 * This is a structure over a carrier. The package `@algebra/polynomial` is a different thing: a symbolic evaluator of
 * expression documents, with rational coefficients only.
 *
 * @packageDocumentation
 */
import type { Random } from "@mark1russell7/rigor-generators";
import { idealOf } from "./quotient.ts";
import { requireExact } from "./structure.ts";
import type { Carrier, Commutative, CommutativeIdeal, CommutativeRing, Group, Monoid, Ring } from "./structure.ts";

/** A polynomial: its coefficients, the constant first, with no zero at the end. The zero polynomial is the empty list. */
export type Polynomial<T> = readonly T[];

/** The largest degree of a sampled polynomial. A modulus of a higher degree gets samples of a lower degree only. */
export const SAMPLE_DEGREE = 6;

/** The largest list of the elements of a quotient by a monic polynomial. */
const LISTED_LIMIT = 4096;

const zeroOf = <T>(ring: Ring<T>): T => ring.additive.identity.value;

const oneOf = <T>(ring: Ring<T>): T => ring.multiplicative.identity.value;

/**
 * This function gives the canonical form of a list of coefficients: it removes each zero at the end.
 *
 * @param ring - The ring of the coefficients.
 * @param coefficients - The coefficients, the constant first.
 */
export const polynomial = <T>(ring: Ring<T>, coefficients: readonly T[]): Polynomial<T> => {
  const zero = zeroOf(ring);
  const last = coefficients.findLastIndex((value) => !ring.carrier.equals(value, zero));
  return coefficients.slice(0, last + 1);
};

/** This function gives the degree of a polynomial. The degree of the zero polynomial is `-1`. */
export const degree = <T>(p: Polynomial<T>): number => p.length - 1;

const coefficientAt = <T>(ring: Ring<T>, p: Polynomial<T>, index: number): T => (index < p.length ? (p[index] as T) : zeroOf(ring));

const add = <T>(ring: Ring<T>, p: Polynomial<T>, q: Polynomial<T>): Polynomial<T> =>
  polynomial(
    ring,
    Array.from({ length: Math.max(p.length, q.length) }, (_, i) => ring.additive.op.apply(coefficientAt(ring, p, i), coefficientAt(ring, q, i))),
  );

const negate = <T>(ring: Ring<T>, p: Polynomial<T>): Polynomial<T> => p.map(ring.additive.inverse.apply);

const multiply = <T>(ring: Ring<T>, p: Polynomial<T>, q: Polynomial<T>): Polynomial<T> => {
  const product: T[] = Array.from({ length: Math.max(0, p.length + q.length - 1) }, () => zeroOf(ring));
  p.forEach((a, i) => {
    q.forEach((b, j) => {
      product[i + j] = ring.additive.op.apply(product[i + j] as T, ring.multiplicative.op.apply(a, b));
    });
  });
  return polynomial(ring, product);
};

/**
 * This function gives the value of a polynomial at a point, by the scheme of Horner.
 *
 * @param ring - The ring of the coefficients.
 * @param p - The polynomial.
 * @param point - The point.
 */
export const evaluate = <T>(ring: Ring<T>, p: Polynomial<T>, point: T): T =>
  p.reduceRight((total, coefficient) => ring.additive.op.apply(ring.multiplicative.op.apply(total, point), coefficient), zeroOf(ring));

const requireMonic = <T>(ring: Ring<T>, p: Polynomial<T>): void => {
  if (p.length === 0 || !ring.carrier.equals(p[degree(p)] as T, oneOf(ring))) throw new RangeError("the polynomial is not monic");
};

/**
 * This function divides a polynomial by a monic polynomial, over any ring.
 *
 * @param ring - The ring of the coefficients.
 * @param p - The dividend.
 * @param monic - The divisor. Its last coefficient is the one of the ring.
 * @returns The quotient and the remainder. The degree of the remainder is below the degree of `monic`.
 * @throws RangeError when the divisor is not monic.
 */
export const divideMonic = <T>(
  ring: Ring<T>,
  p: Polynomial<T>,
  monic: Polynomial<T>,
): { readonly quotient: Polynomial<T>; readonly remainder: Polynomial<T> } => {
  requireMonic(ring, monic);
  const shift = degree(monic);
  const remainder = [...p];
  const quotient: T[] = Array.from({ length: Math.max(0, p.length - shift) }, () => zeroOf(ring));
  for (let index = p.length - 1; index >= shift; index -= 1) {
    const head = remainder[index] as T;
    quotient[index - shift] = head;
    monic.forEach((coefficient, offset) => {
      const position = index - shift + offset;
      const taken = ring.additive.inverse.apply(ring.multiplicative.op.apply(head, coefficient));
      remainder[position] = ring.additive.op.apply(remainder[position] as T, taken);
    });
  }
  return { quotient: polynomial(ring, quotient), remainder: polynomial(ring, remainder.slice(0, shift)) };
};

const monomialText = <T>(ring: Ring<T>, coefficient: T, power: number): string => {
  const text = ring.carrier.show(coefficient);
  if (power === 0) return text;
  const variable = power === 1 ? "x" : `x^${power}`;
  if (ring.carrier.equals(coefficient, oneOf(ring))) return variable;
  return text.includes(" ") ? `(${text})·${variable}` : `${text}·${variable}`;
};

/**
 * This function gives the text of a polynomial, the highest term first.
 *
 * @param ring - The ring of the coefficients.
 * @param p - The polynomial.
 */
export const showPolynomial = <T>(ring: Ring<T>, p: Polynomial<T>): string => {
  const terms = p.flatMap((coefficient, power) => (ring.carrier.equals(coefficient, zeroOf(ring)) ? [] : [monomialText(ring, coefficient, power)]));
  return terms.length === 0 ? ring.carrier.show(zeroOf(ring)) : terms.toReversed().join(" + ");
};

const carrierOf = <T>(ring: Ring<T>): Carrier<Polynomial<T>> => {
  const coefficients = ring.carrier;
  const edges: readonly Polynomial<T>[] = [[], polynomial(ring, [oneOf(ring)]), polynomial(ring, [zeroOf(ring), oneOf(ring)])];
  const sample = (random: Random): Polynomial<T> => {
    if (random.chance(0.15)) return random.pick(edges);
    return polynomial(
      ring,
      Array.from({ length: random.int(0, SAMPLE_DEGREE + 1) }, () => coefficients.sample(random)),
    );
  };
  return {
    name: `${coefficients.name}[x]`,
    description: `the polynomials in one variable over ${coefficients.name}`,
    exact: coefficients.exact,
    equals: (p, q) => p.length === q.length && p.every((value, i) => coefficients.equals(value, q[i] as T)),
    contains: (p) => p.every(coefficients.contains) && p.length === polynomial(ring, p).length,
    sample,
    show: (p) => showPolynomial(ring, p),
  };
};

/**
 * This function gives the ring of the polynomials over a ring.
 *
 * The claims follow from the claims of the coefficients. The result claims commutativity only when the multiplication
 * of the coefficients claims it. It claims `noZeroDivisors` only over a field, or over a ring that claims this law.
 * It does not keep `idempotent`: over the booleans, the square of `x + 1` is `x^2 + 1`. The polynomials over a field
 * are a ring, not a field: `x` has no inverse.
 *
 * @param ring - The ring of the coefficients.
 * @throws TypeError when the carrier is not exact.
 */
export function polynomialRing<T>(ring: CommutativeRing<T>): CommutativeRing<Polynomial<T>>;
export function polynomialRing<T>(ring: Ring<T>): Ring<Polynomial<T>>;
export function polynomialRing<T>(ring: Ring<T>): Ring<Polynomial<T>> {
  requireExact(ring.carrier, "polynomial ring");
  const carrier = carrierOf(ring);
  const additive: Commutative<Group<Polynomial<T>>> = {
    level: "group",
    name: `${carrier.name} (+)`,
    carrier,
    op: { name: "add", symbol: "+", arity: 2, apply: (p, q) => add(ring, p, q) },
    identity: { name: "zero", symbol: "0", arity: 0, value: [] },
    inverse: { name: "neg", symbol: "-", arity: 1, apply: (p) => negate(ring, p) },
    claims: {
      closed: true,
      associative: true,
      commutative: true,
      leftIdentity: true,
      rightIdentity: true,
      inverseClosed: true,
      leftInverse: true,
      rightInverse: true,
    },
  };
  const commutative = ring.multiplicative.claims.commutative === true;
  const multiplicative: Monoid<Polynomial<T>> = {
    level: "monoid",
    name: `${carrier.name} (×)`,
    carrier,
    op: { name: "mul", symbol: "×", arity: 2, apply: (p, q) => multiply(ring, p, q) },
    identity: { name: "one", symbol: "1", arity: 0, value: polynomial(ring, [oneOf(ring)]) },
    claims: { closed: true, associative: true, leftIdentity: true, rightIdentity: true, ...(commutative ? { commutative: true } : {}) },
  };
  const domain = ring.level === "field" || ring.claims.noZeroDivisors === true;
  return {
    level: "ring",
    name: carrier.name,
    carrier,
    additive,
    multiplicative,
    claims: { leftDistributive: true, rightDistributive: true, ...(domain ? { noZeroDivisors: true } : {}) },
    construction: { name: "polynomial-ring", inputs: { coefficients: ring } },
  };
}

/** This function gives each list of `length` values, in lexicographic order. */
export const coefficientLists = <T>(values: readonly T[], length: number): readonly (readonly T[])[] =>
  length === 0 ? [[]] : values.flatMap((value) => coefficientLists(values, length - 1).map((tail) => [value, ...tail]));

/**
 * This function gives the ideal of the multiples of a monic polynomial. Division by a monic polynomial works over any
 * commutative ring, and its remainder is the canonical representative.
 *
 * @param ring - The commutative ring of the coefficients.
 * @param modulus - A monic polynomial.
 * @throws RangeError when `modulus` is not monic. TypeError when the carrier is not exact.
 */
export const polynomialIdeal = <T>(ring: CommutativeRing<T>, modulus: Polynomial<T>): CommutativeIdeal<Polynomial<T>> => {
  const polynomials = polynomialRing(ring);
  requireMonic(ring, modulus);
  const { elements } = ring.carrier;
  const size = degree(modulus);
  const listed =
    elements !== undefined && elements.length ** size <= LISTED_LIMIT
      ? { representatives: coefficientLists(elements, size).map((entry) => polynomial(ring, entry.toReversed())) }
      : {};
  return idealOf(polynomials, {
    name: `(${showPolynomial(ring, modulus)})`,
    member: (p) => divideMonic(ring, p, modulus).remainder.length === 0,
    reduce: (p) => divideMonic(ring, p, modulus).remainder,
    ...listed,
  });
};
