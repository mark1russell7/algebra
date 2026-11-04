/**
 * The laws, as data. A law names its arity, its statement and its check. One generic runner reads this catalog, so a
 * new law needs no new test code.
 *
 * @packageDocumentation
 */
import type {
  BoundedLattice,
  Field,
  Group,
  Ideal,
  Lattice,
  LawName,
  Level,
  Magma,
  Monoid,
  NormalSubgroup,
  Order,
  Ring,
  Semigroup,
  UnitalMagma,
} from "./structure.ts";

/** The count of the values of a law. */
export type Arity = 0 | 1 | 2 | 3;

/** The arguments of a law of arity `N`. */
export type LawArguments<T, N extends Arity> = N extends 0
  ? readonly []
  : N extends 1
    ? readonly [T]
    : N extends 2
      ? readonly [T, T]
      : readonly [T, T, T];

/** The type of the structure of each level. */
export interface LevelShapes<T> {
  readonly magma: Magma<T>;
  readonly semigroup: Semigroup<T>;
  readonly "unital-magma": UnitalMagma<T>;
  readonly monoid: Monoid<T>;
  readonly group: Group<T>;
  readonly ring: Ring<T>;
  readonly field: Field<T>;
  readonly order: Order<T>;
  readonly lattice: Lattice<T>;
  readonly "bounded-lattice": BoundedLattice<T>;
  readonly "normal-subgroup": NormalSubgroup<T>;
  readonly ideal: Ideal<T>;
}

/** A law of the structures of level `L` and above, over `N` values of the carrier. */
export interface Law<L extends Level, N extends Arity> {
  readonly name: LawName;
  /** The lowest level that has the operations of the law. */
  readonly level: L;
  readonly arity: N;
  /** The law as text. */
  readonly statement: string;
  /**
   * This field tells if a product keeps the law. A law that holds at each pair of a product keeps it, when it holds in
   * each factor. A law with a choice in it (`total`) or a claim of two different values (`nontrivial`) does not.
   */
  readonly preservedByProduct: boolean;
  /**
   * This field tells if a quotient keeps the law. An equation over the operations stays true on the cosets. A law with
   * a claim of two different values does not stay true: the integers have no zero divisors, and the integers modulo 6 do.
   */
  readonly preservedByQuotient: boolean;
  readonly check: <T>(structure: LevelShapes<T>[L], values: LawArguments<T, N>) => boolean;
}

/** A law of any level and arity. The runner gives it the structure and the values that the catalog tells. */
export interface AnyLaw {
  readonly name: LawName;
  readonly level: Level;
  readonly arity: Arity;
  readonly statement: string;
  readonly preservedByProduct: boolean;
  readonly preservedByQuotient: boolean;
  readonly check: (structure: never, values: never) => boolean;
}

const law = <L extends Level, N extends Arity>(definition: Law<L, N>): AnyLaw => definition;

const same = <T>(structure: { readonly carrier: { readonly equals: (a: T, b: T) => boolean } }, a: T, b: T): boolean =>
  structure.carrier.equals(a, b);

/** The laws, by name. */
export const LAWS: Readonly<Record<LawName, AnyLaw>> = {
  closed: law<"magma", 2>({
    name: "closed",
    level: "magma",
    arity: 2,
    statement: "a · b is in the carrier",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a, b]) => s.carrier.contains(s.op.apply(a, b)),
  }),
  associative: law<"magma", 3>({
    name: "associative",
    level: "magma",
    arity: 3,
    statement: "(a · b) · c = a · (b · c)",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a, b, c]) => same(s, s.op.apply(s.op.apply(a, b), c), s.op.apply(a, s.op.apply(b, c))),
  }),
  commutative: law<"magma", 2>({
    name: "commutative",
    level: "magma",
    arity: 2,
    statement: "a · b = b · a",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a, b]) => same(s, s.op.apply(a, b), s.op.apply(b, a)),
  }),
  idempotent: law<"magma", 1>({
    name: "idempotent",
    level: "magma",
    arity: 1,
    statement: "a · a = a",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a]) => same(s, s.op.apply(a, a), a),
  }),
  leftIdentity: law<"unital-magma", 1>({
    name: "leftIdentity",
    level: "unital-magma",
    arity: 1,
    statement: "e · a = a",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a]) => same(s, s.op.apply(s.identity.value, a), a),
  }),
  rightIdentity: law<"unital-magma", 1>({
    name: "rightIdentity",
    level: "unital-magma",
    arity: 1,
    statement: "a · e = a",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a]) => same(s, s.op.apply(a, s.identity.value), a),
  }),
  inverseClosed: law<"group", 1>({
    name: "inverseClosed",
    level: "group",
    arity: 1,
    statement: "the inverse of a is in the carrier",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a]) => s.carrier.contains(s.inverse.apply(a)),
  }),
  leftInverse: law<"group", 1>({
    name: "leftInverse",
    level: "group",
    arity: 1,
    statement: "a⁻¹ · a = e",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a]) => same(s, s.op.apply(s.inverse.apply(a), a), s.identity.value),
  }),
  rightInverse: law<"group", 1>({
    name: "rightInverse",
    level: "group",
    arity: 1,
    statement: "a · a⁻¹ = e",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a]) => same(s, s.op.apply(a, s.inverse.apply(a)), s.identity.value),
  }),
  leftDistributive: law<"ring", 3>({
    name: "leftDistributive",
    level: "ring",
    arity: 3,
    statement: "a × (b + c) = (a × b) + (a × c)",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a, b, c]) => {
      const add = s.additive.op.apply;
      const mul = s.multiplicative.op.apply;
      return same(s, mul(a, add(b, c)), add(mul(a, b), mul(a, c)));
    },
  }),
  rightDistributive: law<"ring", 3>({
    name: "rightDistributive",
    level: "ring",
    arity: 3,
    statement: "(a + b) × c = (a × c) + (b × c)",
    preservedByProduct: true,
    preservedByQuotient: true,
    check: (s, [a, b, c]) => {
      const add = s.additive.op.apply;
      const mul = s.multiplicative.op.apply;
      return same(s, mul(add(a, b), c), add(mul(a, c), mul(b, c)));
    },
  }),
  noZeroDivisors: law<"ring", 2>({
    name: "noZeroDivisors",
    level: "ring",
    arity: 2,
    statement: "a × b = 0 gives a = 0 or b = 0",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => {
      const zero = s.additive.identity.value;
      return !same(s, s.multiplicative.op.apply(a, b), zero) || same(s, a, zero) || same(s, b, zero);
    },
  }),
  nontrivial: law<"field", 0>({
    name: "nontrivial",
    level: "field",
    arity: 0,
    statement: "0 ≠ 1",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s) => !same(s, s.additive.identity.value, s.multiplicative.identity.value),
  }),
  unitsAreNonzero: law<"field", 1>({
    name: "unitsAreNonzero",
    level: "field",
    arity: 1,
    statement: "a is a unit when a ≠ 0",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a]) => s.units.carrier.contains(a) === !same(s, a, s.additive.identity.value),
  }),
  unitsAgree: law<"field", 2>({
    name: "unitsAgree",
    level: "field",
    arity: 2,
    statement: "the operation of the units is the multiplication",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => {
      const zero = s.additive.identity.value;
      return same(s, a, zero) || same(s, b, zero) || same(s, s.units.op.apply(a, b), s.multiplicative.op.apply(a, b));
    },
  }),
  reflexive: law<"order", 1>({
    name: "reflexive",
    level: "order",
    arity: 1,
    statement: "a ≤ a",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a]) => s.leq.apply(a, a),
  }),
  antisymmetric: law<"order", 2>({
    name: "antisymmetric",
    level: "order",
    arity: 2,
    statement: "a ≤ b and b ≤ a give a = b",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b]) => !s.leq.apply(a, b) || !s.leq.apply(b, a) || same(s, a, b),
  }),
  transitive: law<"order", 3>({
    name: "transitive",
    level: "order",
    arity: 3,
    statement: "a ≤ b and b ≤ c give a ≤ c",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b, c]) => !s.leq.apply(a, b) || !s.leq.apply(b, c) || s.leq.apply(a, c),
  }),
  total: law<"order", 2>({
    name: "total",
    level: "order",
    arity: 2,
    statement: "a ≤ b or b ≤ a",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => s.leq.apply(a, b) || s.leq.apply(b, a),
  }),
  meetAgrees: law<"lattice", 2>({
    name: "meetAgrees",
    level: "lattice",
    arity: 2,
    statement: "a ≤ b exactly when a ∧ b = a",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b]) => s.leq.apply(a, b) === same(s, s.meet.op.apply(a, b), a),
  }),
  joinAgrees: law<"lattice", 2>({
    name: "joinAgrees",
    level: "lattice",
    arity: 2,
    statement: "a ≤ b exactly when a ∨ b = b",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b]) => s.leq.apply(a, b) === same(s, s.join.op.apply(a, b), b),
  }),
  meetAbsorbs: law<"lattice", 2>({
    name: "meetAbsorbs",
    level: "lattice",
    arity: 2,
    statement: "a ∧ (a ∨ b) = a",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b]) => same(s, s.meet.op.apply(a, s.join.op.apply(a, b)), a),
  }),
  joinAbsorbs: law<"lattice", 2>({
    name: "joinAbsorbs",
    level: "lattice",
    arity: 2,
    statement: "a ∨ (a ∧ b) = a",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b]) => same(s, s.join.op.apply(a, s.meet.op.apply(a, b)), a),
  }),
  distributive: law<"lattice", 3>({
    name: "distributive",
    level: "lattice",
    arity: 3,
    statement: "a ∧ (b ∨ c) = (a ∧ b) ∨ (a ∧ c)",
    preservedByProduct: true,
    preservedByQuotient: false,
    check: (s, [a, b, c]) => {
      const meet = s.meet.op.apply;
      const join = s.join.op.apply;
      return same(s, meet(a, join(b, c)), join(meet(a, b), meet(a, c)));
    },
  }),
  reduceSettles: law<"normal-subgroup", 1>({
    name: "reduceSettles",
    level: "normal-subgroup",
    arity: 1,
    statement: "r(r(a)) = r(a)",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a]) => same(s, s.reduce.apply(s.reduce.apply(a)), s.reduce.apply(a)),
  }),
  memberAgrees: law<"normal-subgroup", 1>({
    name: "memberAgrees",
    level: "normal-subgroup",
    arity: 1,
    statement: "a is a member exactly when r(a) = r(e)",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a]) => s.member.apply(a) === same(s, s.reduce.apply(a), s.reduce.apply(s.group.identity.value)),
  }),
  congruentLeft: law<"normal-subgroup", 2>({
    name: "congruentLeft",
    level: "normal-subgroup",
    arity: 2,
    statement: "r(a · b) = r(r(a) · b)",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => {
      const { reduce, group } = s;
      return same(s, reduce.apply(group.op.apply(a, b)), reduce.apply(group.op.apply(reduce.apply(a), b)));
    },
  }),
  congruentRight: law<"normal-subgroup", 2>({
    name: "congruentRight",
    level: "normal-subgroup",
    arity: 2,
    statement: "r(a · b) = r(a · r(b))",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => {
      const { reduce, group } = s;
      return same(s, reduce.apply(group.op.apply(a, b)), reduce.apply(group.op.apply(a, reduce.apply(b))));
    },
  }),
  absorbsRight: law<"ideal", 2>({
    name: "absorbsRight",
    level: "ideal",
    arity: 2,
    statement: "r(a × b) = r(r(a) × b)",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => {
      const { reduce } = s;
      const mul = s.ring.multiplicative.op.apply;
      return same(s, reduce.apply(mul(a, b)), reduce.apply(mul(reduce.apply(a), b)));
    },
  }),
  absorbsLeft: law<"ideal", 2>({
    name: "absorbsLeft",
    level: "ideal",
    arity: 2,
    statement: "r(a × b) = r(a × r(b))",
    preservedByProduct: false,
    preservedByQuotient: false,
    check: (s, [a, b]) => {
      const { reduce } = s;
      const mul = s.ring.multiplicative.op.apply;
      return same(s, reduce.apply(mul(a, b)), reduce.apply(mul(a, reduce.apply(b))));
    },
  }),
};

/** The names of the laws, in the order of the catalog. */
export const LAW_NAMES: readonly LawName[] = Object.values(LAWS).map((entry) => entry.name);
