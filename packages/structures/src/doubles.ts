/**
 * The doubles. An instance here claims only the laws that hold on each double, with `Object.is` as the equality.
 *
 * - Double add is commutative and it has an identity, but it is not associative. So it is a unital magma, not a monoid.
 * - The identity of double add is `-0`. The value `0` is not an identity, because `-0 + 0` is `0`.
 * - Min and max are exact on the doubles without `NaN`, with `-0` below `0`. They give a bounded distributive lattice.
 * - `NaN` is not in the carrier of min and max. With `NaN`, the law of absorption fails.
 *
 * @packageDocumentation
 */
import type { Random } from "@mark1russell7/rigor-generators";
import type { BoundedLattice, Carrier, Monoid, Semilattice, UnitalMagma } from "./structure.ts";

const NUMBERS: readonly number[] = [0, -0, 1, -1, 0.1, 0.2, 0.3, Number.EPSILON, Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE];

const INFINITIES: readonly number[] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

/** This function draws a finite double of a random magnitude, from the subnormals to the largest values. */
const sampleFinite = (random: Random): number => random.range(-2, 2) * 2 ** random.int(-1074, 1023);

/** The carrier of all doubles, with `NaN`, both infinities and both zeros. */
export const DOUBLES: Carrier<number> = {
  name: "double",
  description: "all doubles, with NaN, both infinities and both zeros",
  exact: false,
  equals: Object.is,
  contains: (a) => typeof a === "number",
  sample: (random) => (random.chance(0.3) ? random.pick([...NUMBERS, ...INFINITIES, Number.NaN]) : sampleFinite(random)),
  show: (a) => (Object.is(a, -0) ? "-0" : `${a}`),
};

/** The carrier of the doubles without `NaN`. It has a total order, with `-0` below `0`. */
export const ORDERED_DOUBLES: Carrier<number> = {
  ...DOUBLES,
  name: "double without NaN",
  description: "the doubles without NaN, with both infinities and both zeros",
  contains: (a) => typeof a === "number" && !Number.isNaN(a),
  sample: (random) => (random.chance(0.3) ? random.pick([...NUMBERS, ...INFINITIES]) : sampleFinite(random)),
};

/**
 * The doubles under add. This instance does not claim `associative`, and the refutation gives a counterexample.
 * It has no inverse: the add of a value and its negative gives `0`, not the identity `-0`, and infinities give `NaN`.
 */
export const DOUBLE_ADD: UnitalMagma<number> = {
  level: "unital-magma",
  name: "double (+)",
  carrier: DOUBLES,
  op: { name: "add", symbol: "+", arity: 2, apply: (a, b) => a + b },
  identity: { name: "negative zero", symbol: "-0", arity: 0, value: -0 },
  claims: { closed: true, commutative: true, leftIdentity: true, rightIdentity: true },
  refuted: [{ law: "associative", arguments: [0.1, 0.2, 0.3], note: "(0.1 + 0.2) + 0.3 is 0.6000000000000001, and 0.1 + (0.2 + 0.3) is 0.6" }],
};

/** The doubles without `NaN` under min. Its identity is the positive infinity, the top of the lattice. */
export const DOUBLE_MIN: Semilattice<Monoid<number>> = {
  level: "monoid",
  name: "double (min)",
  carrier: ORDERED_DOUBLES,
  op: { name: "min", symbol: "∧", arity: 2, apply: (a, b) => Math.min(a, b) },
  identity: { name: "positive infinity", symbol: "⊤", arity: 0, value: Number.POSITIVE_INFINITY },
  claims: { closed: true, associative: true, commutative: true, idempotent: true, leftIdentity: true, rightIdentity: true },
};

/** The doubles without `NaN` under max. Its identity is the negative infinity, the bottom of the lattice. */
export const DOUBLE_MAX: Semilattice<Monoid<number>> = {
  level: "monoid",
  name: "double (max)",
  carrier: ORDERED_DOUBLES,
  op: { name: "max", symbol: "∨", arity: 2, apply: (a, b) => Math.max(a, b) },
  identity: { name: "negative infinity", symbol: "⊥", arity: 0, value: Number.NEGATIVE_INFINITY },
  claims: { closed: true, associative: true, commutative: true, idempotent: true, leftIdentity: true, rightIdentity: true },
};

/** The bounded distributive lattice of the doubles without `NaN`. The test of `1 / a` puts `-0` below `0`. */
export const DOUBLE_LATTICE: BoundedLattice<number> = {
  level: "bounded-lattice",
  name: "double (min, max)",
  carrier: ORDERED_DOUBLES,
  leq: { name: "leq", symbol: "≤", arity: 2, apply: (a, b) => a < b || (a === b && 1 / a <= 1 / b) },
  meet: DOUBLE_MIN,
  join: DOUBLE_MAX,
  claims: {
    reflexive: true,
    antisymmetric: true,
    transitive: true,
    total: true,
    meetAgrees: true,
    joinAgrees: true,
    meetAbsorbs: true,
    joinAbsorbs: true,
    distributive: true,
  },
};
