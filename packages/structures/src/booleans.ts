/**
 * The booleans: a bounded lattice under and and or, and a ring under exclusive or and and. The carrier has two values,
 * so the runner examines each tuple.
 *
 * @packageDocumentation
 */
import type { BoundedLattice, Carrier, Commutative, Group, Monoid, Ring, Semilattice } from "./structure.ts";

/** The carrier of the booleans. */
export const BOOLEANS: Carrier<boolean> = {
  name: "B",
  description: "the values false and true",
  exact: true,
  equals: (a, b) => a === b,
  contains: (a) => typeof a === "boolean",
  sample: (random) => random.chance(0.5),
  show: (a) => `${a}`,
  elements: [false, true],
};

/** The monoid of the booleans under and. Its identity is `true`. */
export const BOOLEAN_AND: Semilattice<Monoid<boolean>> = {
  level: "monoid",
  name: "B (and)",
  carrier: BOOLEANS,
  op: { name: "and", symbol: "∧", arity: 2, apply: (a, b) => a && b },
  identity: { name: "true", symbol: "⊤", arity: 0, value: true },
  claims: { closed: true, associative: true, commutative: true, idempotent: true, leftIdentity: true, rightIdentity: true },
};

/** The monoid of the booleans under or. Its identity is `false`. */
export const BOOLEAN_OR: Semilattice<Monoid<boolean>> = {
  level: "monoid",
  name: "B (or)",
  carrier: BOOLEANS,
  op: { name: "or", symbol: "∨", arity: 2, apply: (a, b) => a || b },
  identity: { name: "false", symbol: "⊥", arity: 0, value: false },
  claims: { closed: true, associative: true, commutative: true, idempotent: true, leftIdentity: true, rightIdentity: true },
};

/** The commutative group of the booleans under exclusive or. Each value is its own inverse. */
export const BOOLEAN_XOR: Commutative<Group<boolean>> = {
  level: "group",
  name: "B (xor)",
  carrier: BOOLEANS,
  op: { name: "xor", symbol: "⊕", arity: 2, apply: (a, b) => a !== b },
  identity: { name: "false", symbol: "⊥", arity: 0, value: false },
  inverse: { name: "self", symbol: "id", arity: 1, apply: (a) => a },
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

/** The ring of the booleans: exclusive or is the add, and and is the multiplication. */
export const BOOLEAN_RING: Ring<boolean> = {
  level: "ring",
  name: "B (xor, and)",
  carrier: BOOLEANS,
  additive: BOOLEAN_XOR,
  multiplicative: BOOLEAN_AND,
  claims: { leftDistributive: true, rightDistributive: true },
};

/** The bounded distributive lattice of the booleans, with `false` below `true`. */
export const BOOLEAN_LATTICE: BoundedLattice<boolean> = {
  level: "bounded-lattice",
  name: "B (and, or)",
  carrier: BOOLEANS,
  leq: { name: "implies", symbol: "≤", arity: 2, apply: (a, b) => !a || b },
  meet: BOOLEAN_AND,
  join: BOOLEAN_OR,
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
