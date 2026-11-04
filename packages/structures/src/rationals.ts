/**
 * The rationals of `@mark1russell7/rational`: a field and an order. Their values are exact, so each law holds with
 * exact equality.
 *
 * @packageDocumentation
 */
import { ONE, ZERO, add, compare, equals, inverse, mul, neg, rational, toString } from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import type { Random } from "@mark1russell7/rigor-generators";
import { withoutZero } from "./structure.ts";
import type { Binary, Carrier, Commutative, Field, Group, Lattice, Monoid, Order, Semigroup, Semilattice } from "./structure.ts";

const EDGES: readonly Rational[] = [ZERO, ONE, neg(ONE), rational(1n, 2n), rational(-1n, 3n)];

const BOUNDS: readonly number[] = [2 ** 4, 2 ** 16, 2 ** 31];

/** This function draws a rational: an edge value, or a quotient of integers of up to 62 bits. */
const sampleRational = (random: Random): Rational => {
  if (random.chance(0.15)) return random.pick(EDGES);
  const bound = random.pick(BOUNDS);
  const numerator = BigInt(random.int(-bound, bound)) * BigInt(random.int(1, bound));
  return rational(numerator, BigInt(random.int(1, bound)));
};

/** The carrier of the rationals. */
export const RATIONALS: Carrier<Rational> = {
  name: "Q",
  description: "the rationals over bigint, in lowest terms",
  exact: true,
  equals,
  contains: (a) => a.d > 0n && equals(rational(a.n, a.d), a),
  sample: sampleRational,
  show: toString,
};

const addition: Binary<Rational> = { name: "add", symbol: "+", arity: 2, apply: add };
const multiplication: Binary<Rational> = { name: "mul", symbol: "×", arity: 2, apply: mul };

/** The commutative group of the rationals under add. */
export const RATIONAL_ADD: Commutative<Group<Rational>> = {
  level: "group",
  name: "Q (+)",
  carrier: RATIONALS,
  op: addition,
  identity: { name: "zero", symbol: "0", arity: 0, value: ZERO },
  inverse: { name: "neg", symbol: "-", arity: 1, apply: neg },
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

/** The commutative monoid of the rationals under multiplication. */
export const RATIONAL_MUL: Commutative<Monoid<Rational>> = {
  level: "monoid",
  name: "Q (×)",
  carrier: RATIONALS,
  op: multiplication,
  identity: { name: "one", symbol: "1", arity: 0, value: ONE },
  claims: { closed: true, associative: true, commutative: true, leftIdentity: true, rightIdentity: true },
};

/** The commutative group of the rationals that are not zero, under multiplication. */
export const RATIONAL_UNITS: Commutative<Group<Rational>> = {
  ...RATIONAL_MUL,
  level: "group",
  name: "Q* (×)",
  carrier: withoutZero("Q*", RATIONALS, ZERO),
  inverse: { name: "inverse", symbol: "⁻¹", arity: 1, apply: inverse },
  claims: { ...RATIONAL_MUL.claims, inverseClosed: true, leftInverse: true, rightInverse: true },
};

/** The field of the rationals. */
export const RATIONAL_FIELD: Field<Rational> = {
  level: "field",
  name: "Q",
  carrier: RATIONALS,
  additive: RATIONAL_ADD,
  multiplicative: RATIONAL_MUL,
  units: RATIONAL_UNITS,
  claims: { leftDistributive: true, rightDistributive: true, nontrivial: true, unitsAreNonzero: true, unitsAgree: true },
};

const leastOf = (a: Rational, b: Rational): Rational => (compare(a, b) <= 0 ? a : b);
const greatestOf = (a: Rational, b: Rational): Rational => (compare(a, b) >= 0 ? a : b);

const semilatticeClaims = { closed: true, associative: true, commutative: true, idempotent: true } as const;

/** The rationals under the least of two values. It has no identity, because the rationals have no top. */
export const RATIONAL_MIN: Semilattice<Semigroup<Rational>> = {
  level: "semigroup",
  name: "Q (min)",
  carrier: RATIONALS,
  op: { name: "min", symbol: "∧", arity: 2, apply: leastOf },
  claims: semilatticeClaims,
};

/** The rationals under the greatest of two values. It has no identity, because the rationals have no bottom. */
export const RATIONAL_MAX: Semilattice<Semigroup<Rational>> = {
  level: "semigroup",
  name: "Q (max)",
  carrier: RATIONALS,
  op: { name: "max", symbol: "∨", arity: 2, apply: greatestOf },
  claims: semilatticeClaims,
};

/** The total order of the rationals. */
export const RATIONAL_ORDER: Order<Rational> = {
  level: "order",
  name: "Q (≤)",
  carrier: RATIONALS,
  leq: { name: "leq", symbol: "≤", arity: 2, apply: (a, b) => compare(a, b) <= 0 },
  claims: { reflexive: true, antisymmetric: true, transitive: true, total: true },
};

/** The lattice of the rationals under min and max. It has no top and no bottom. */
export const RATIONAL_LATTICE: Lattice<Rational> = {
  ...RATIONAL_ORDER,
  level: "lattice",
  name: "Q (min, max)",
  meet: RATIONAL_MIN,
  join: RATIONAL_MAX,
  claims: {
    ...RATIONAL_ORDER.claims,
    meetAgrees: true,
    joinAgrees: true,
    meetAbsorbs: true,
    joinAbsorbs: true,
    distributive: true,
  },
};
