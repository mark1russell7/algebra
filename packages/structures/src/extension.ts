/**
 * Root extensions: a field `K` with a root of a monic polynomial `f`, as the quotient `K[x]/(f)`. The result is always
 * a commutative ring. It is a field exactly when `f` is irreducible over `K`.
 *
 * The runner cannot find a reducible `f` by samples over an infinite carrier: a zero divisor of `Q[x]/(x^2 - 9)` is a
 * rare draw. So the claim of a field needs a proof, and these functions make the proof themselves. A caller cannot give
 * a verdict. The field `evidence` of the construction tells how the verdict came.
 *
 * - Over a listed finite field, trial division is complete up to `SEARCH_LIMIT` divisors.
 * - Over the rationals, the rational root test is complete up to degree 3. It finds each linear factor at each degree.
 * - Over the rationals, the criterion of Eisenstein with a given prime is a proof at each degree. The function examines
 *   the prime. A false prime gives no proof.
 * - In the other cases, the verdict is `unknown`, and the result claims no field. The polynomial `x^4 + 4` has no
 *   rational root and it is reducible, so a test of roots alone is no proof at degree 4.
 *
 * @packageDocumentation
 */
import { ONE, neg, rational } from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { MAX_MODULUS, isPrime } from "./integers-mod.ts";
import { coefficientLists, degree, divideMonic, evaluate, polynomial, polynomialIdeal, showPolynomial } from "./polynomial-ring.ts";
import type { Polynomial } from "./polynomial-ring.ts";
import { quotientRing } from "./quotient.ts";
import { RATIONAL_FIELD } from "./rationals.ts";
import { requireExact, withoutZero } from "./structure.ts";
import type { Commutative, CommutativeRing, Evidence, Field, Group, Ring } from "./structure.ts";

/** The largest count of monic divisors that trial division tries. */
export const SEARCH_LIMIT = 65536;

/** The largest absolute value of the first and the last integer coefficient in the rational root test. */
export const ROOT_TEST_LIMIT: bigint = 2n ** 40n;

/** The result of a root extension. */
export interface RootExtension<T> {
  /** The commutative ring `K[x]/(f)`. It states the evidence and, for a reducible `f`, a refutation. */
  readonly ring: CommutativeRing<Polynomial<T>>;
  /** The same structure as a field. It is `null` unless the verdict is `irreducible`. */
  readonly field: Field<Polynomial<T>> | null;
  readonly evidence: Evidence;
}

/** A verdict with its factors, for a reducible polynomial. */
interface Decision<T> {
  readonly evidence: Evidence;
  readonly factors?: readonly [Polynomial<T>, Polynomial<T>];
}

const scale = <T>(field: Field<T>, p: Polynomial<T>, factor: T): Polynomial<T> => p.map((value) => field.multiplicative.op.apply(value, factor));

const monicOf = <T>(field: Field<T>, p: Polynomial<T>): Polynomial<T> => {
  const canonical = polynomial(field, p);
  const head = canonical[degree(canonical)];
  if (head === undefined) throw new RangeError("the modulus is zero");
  const monic = scale(field, canonical, field.units.inverse.apply(head));
  if (degree(monic) < 1) throw new RangeError("the modulus has no root: its degree is 0");
  return monic;
};

const divide = <T>(
  field: Field<T>,
  p: Polynomial<T>,
  divisor: Polynomial<T>,
): { readonly quotient: Polynomial<T>; readonly remainder: Polynomial<T> } => {
  const factor = field.units.inverse.apply(divisor[degree(divisor)] as T);
  const { quotient, remainder } = divideMonic(field, p, scale(field, divisor, factor));
  return { quotient: scale(field, quotient, factor), remainder };
};

/**
 * This function gives the inverse of `a` modulo `f`, by the extended Euclid algorithm. A proof that `f` is irreducible
 * makes it total.
 */
const inverseModulo = <T>(field: Field<T>, polynomials: Ring<Polynomial<T>>, modulus: Polynomial<T>, a: Polynomial<T>): Polynomial<T> => {
  const multiply = polynomials.multiplicative.op.apply;
  const subtract = (p: Polynomial<T>, q: Polynomial<T>): Polynomial<T> => polynomials.additive.op.apply(p, polynomials.additive.inverse.apply(q));
  // Each r is the product of its s and a, modulo the modulus.
  let [r, nextR] = [modulus, a];
  let [s, nextS] = [polynomials.additive.identity.value, polynomials.multiplicative.identity.value];
  while (nextR.length > 0) {
    const { quotient, remainder } = divide(field, r, nextR);
    [r, nextR] = [nextR, remainder];
    [s, nextS] = [nextS, subtract(s, multiply(quotient, nextS))];
  }
  if (degree(r) !== 0) throw new RangeError("the value has no inverse");
  return divide(field, scale(field, s, field.units.inverse.apply(r[0] as T)), modulus).remainder;
};

const build = <T>(base: Field<T>, modulus: Polynomial<T>, decision: Decision<T>): RootExtension<T> => {
  const { evidence, factors } = decision;
  const ideal = polynomialIdeal(base, modulus);
  const quotient = quotientRing(ideal);
  const refuted =
    factors === undefined
      ? {}
      : {
          refuted: [
            {
              law: "noZeroDivisors" as const,
              arguments: [...factors],
              note: `(${quotient.carrier.show(factors[0])}) × (${quotient.carrier.show(factors[1])}) is 0 modulo ${ideal.name}`,
            },
          ],
        };
  const construction = { name: "root-extension", inputs: { base, ideal }, evidence } as const;
  const ring: CommutativeRing<Polynomial<T>> = { ...quotient, ...refuted, construction };
  if (evidence.verdict !== "irreducible") return { ring, field: null, evidence };
  const units: Commutative<Group<Polynomial<T>>> = {
    ...ring.multiplicative,
    level: "group",
    name: `${ring.name}* (×)`,
    carrier: withoutZero(`${ring.name}*`, ring.carrier, ring.additive.identity.value),
    inverse: { name: "inverse", symbol: "⁻¹", arity: 1, apply: (a) => inverseModulo(base, ideal.ring, modulus, a) },
    claims: { ...ring.multiplicative.claims, inverseClosed: true, leftInverse: true, rightInverse: true },
  };
  const field: Field<Polynomial<T>> = {
    ...ring,
    level: "field",
    units,
    claims: { ...ring.claims, nontrivial: true, unitsAreNonzero: true, unitsAgree: true },
  };
  return { ring, field, evidence };
};

/**
 * This function decides by trial division if a monic polynomial is irreducible over a listed field.
 *
 * @param field - A field that lists its elements.
 * @param modulus - A monic polynomial of degree 1 or more.
 * @returns The verdict `irreducible` or `reducible`, or `unknown` when the search passes `SEARCH_LIMIT` divisors.
 * @throws TypeError when the field lists no elements.
 */
const decideByTrialDivision = <T>(field: Field<T>, modulus: Polynomial<T>): Decision<T> => {
  const { elements } = field.carrier;
  if (elements === undefined) throw new TypeError(`the field ${field.name} lists no elements`);
  const size = degree(modulus);
  if (size === 1) return { evidence: { verdict: "irreducible", method: "degree-one", note: "a polynomial of degree 1 is irreducible" } };
  const half = Math.floor(size / 2);
  const searched = Array.from({ length: half }, (_, i) => elements.length ** (i + 1)).reduce((total, count) => total + count, 0);
  if (searched > SEARCH_LIMIT) {
    return { evidence: { verdict: "unknown", method: "none", note: `the search needs ${searched} divisors, and the limit is ${SEARCH_LIMIT}` } };
  }
  const one = field.multiplicative.identity.value;
  for (let divisorDegree = 1; divisorDegree <= half; divisorDegree += 1) {
    for (const low of coefficientLists(elements, divisorDegree)) {
      const divisor = [...low, one];
      const { quotient, remainder } = divideMonic(field, modulus, divisor);
      if (remainder.length === 0) {
        const note = `${showPolynomial(field, modulus)} has the monic divisor ${showPolynomial(field, divisor)}`;
        return { evidence: { verdict: "reducible", method: "trial-division", note }, factors: [divisor, quotient] };
      }
    }
  }
  return { evidence: { verdict: "irreducible", method: "trial-division", note: `no monic divisor of degree 1 to ${half} over ${field.name}` } };
};

/**
 * This function gives a listed finite field with a root of a polynomial. The verdict comes from trial division.
 *
 * @param field - A field that lists its elements.
 * @param modulus - The polynomial, of degree 1 or more. The function makes it monic.
 * @returns The ring `K[x]/(f)`, and the field when `f` is irreducible.
 * @throws RangeError when the degree is below 1. TypeError when the carrier is not exact or lists no elements.
 */
export const extendFinite = <T>(field: Field<T>, modulus: Polynomial<T>): RootExtension<T> => {
  requireExact(field.carrier, "root extension");
  const monic = monicOf(field, modulus);
  return build(field, monic, decideByTrialDivision(field, monic));
};

const magnitude = (a: bigint): bigint => (a < 0n ? -a : a);

/** This function gives the greatest common divisor through the lowest terms of the home of the rationals. */
const gcd = (a: bigint, b: bigint): bigint => {
  if (b === 0n) return magnitude(a);
  if (a === 0n) return magnitude(b);
  return magnitude(a) / magnitude(rational(a, b).n);
};

/** This function gives the primitive integer polynomial that is a rational multiple of `f`. */
const integerForm = (f: Polynomial<Rational>): readonly bigint[] => {
  const denominator = f.reduce((total, { d }) => (total * d) / gcd(total, d), 1n);
  const scaled = f.map(({ n, d }) => (n * denominator) / d);
  const content = scaled.reduce((total, value) => gcd(total, value), 0n);
  return scaled.map((value) => value / content);
};

/** This function gives the positive divisors of a positive integer, by trial up to the square root. */
const divisorsOf = (n: bigint): readonly bigint[] => {
  const found: bigint[] = [];
  for (let d = 1n; d * d <= n; d += 1n) {
    if (n % d === 0n) found.push(d, n / d);
  }
  return found;
};

/** This function tells if a prime proves that an integer polynomial is irreducible, by the criterion of Eisenstein. */
const eisensteinHolds = (coefficients: readonly bigint[], prime: bigint): boolean => {
  if (prime > MAX_MODULUS || !isPrime(prime)) return false;
  const head = coefficients.at(-1) ?? 0n;
  const last = coefficients[0] ?? 0n;
  return head % prime !== 0n && coefficients.slice(0, -1).every((value) => value % prime === 0n) && last % (prime * prime) !== 0n;
};

const linearFactor = (root: Rational): Polynomial<Rational> => [neg(root), ONE];

/** This function finds a rational root of a monic polynomial with integer form `integers`. */
const rationalRootOf = (monic: Polynomial<Rational>, integers: readonly bigint[]): Rational | undefined => {
  const last = integers[0] ?? 0n;
  const head = integers.at(-1) ?? 1n;
  if (last === 0n) return rational(0n);
  const candidates = divisorsOf(magnitude(last)).flatMap((p) => divisorsOf(magnitude(head)).flatMap((q) => [rational(p, q), rational(-p, q)]));
  return candidates.find((candidate) => evaluate(RATIONAL_FIELD, monic, candidate).n === 0n);
};

const decideOverRationals = (monic: Polynomial<Rational>, prime: bigint | undefined): Decision<Rational> => {
  const size = degree(monic);
  const text = showPolynomial(RATIONAL_FIELD, monic);
  if (size === 1) return { evidence: { verdict: "irreducible", method: "degree-one", note: "a polynomial of degree 1 is irreducible" } };
  const integers = integerForm(monic);
  if (prime !== undefined && eisensteinHolds(integers, prime)) {
    return { evidence: { verdict: "irreducible", method: "eisenstein", note: `the criterion of Eisenstein holds at the prime ${prime}` } };
  }
  const outer = [integers[0] ?? 0n, integers.at(-1) ?? 0n].map(magnitude);
  if (outer.some((value) => value > ROOT_TEST_LIMIT)) {
    return { evidence: { verdict: "unknown", method: "none", note: `the outer integer coefficients of ${text} pass the limit of the root test` } };
  }
  const root = rationalRootOf(monic, integers);
  if (root !== undefined) {
    const factor = linearFactor(root);
    const note = `${text} has the rational root ${showPolynomial(RATIONAL_FIELD, [root])}`;
    return { evidence: { verdict: "reducible", method: "rational-root", note }, factors: [factor, divideMonic(RATIONAL_FIELD, monic, factor).quotient] };
  }
  if (size <= 3) return { evidence: { verdict: "irreducible", method: "rational-root", note: `${text} has degree ${size} and no rational root` } };
  return { evidence: { verdict: "unknown", method: "none", note: `${text} has degree ${size} and no rational root, and no proof applies` } };
};

/**
 * This function gives the rationals with a root of a polynomial.
 *
 * @param modulus - The polynomial, of degree 1 or more. The function makes it monic.
 * @param eisenstein - A prime for the criterion of Eisenstein, not more than `MAX_MODULUS`. The function examines it.
 * @returns The ring `Q[x]/(f)`, and the field when a proof shows that `f` is irreducible.
 * @throws RangeError when the degree is below 1.
 */
export const extendRationals = (modulus: Polynomial<Rational>, eisenstein?: bigint): RootExtension<Rational> => {
  const monic = monicOf(RATIONAL_FIELD, modulus);
  return build(RATIONAL_FIELD, monic, decideOverRationals(monic, eisenstein));
};
