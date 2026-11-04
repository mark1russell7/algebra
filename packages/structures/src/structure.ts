/**
 * The types of the structures. A structure is plain data: it names its carrier, its operations and the laws that it
 * claims. Each level adds to the level below, and the types state this: a `Group<T>` is assignable to a `Monoid<T>`.
 *
 * @packageDocumentation
 */
import type { Random } from "@mark1russell7/rigor-generators";

/**
 * A set of values. The function `equals` is exact: it has no tolerance. The doubles use `Object.is` for this reason.
 * The field `exact` tells if the values are exact mathematical values. Doubles are rounded, so their field is `false`.
 */
export interface Carrier<T> {
  /** The short name, for example `"Q"`. */
  readonly name: string;
  /** One line that tells which values the set has. */
  readonly description: string;
  readonly exact: boolean;
  readonly equals: (a: T, b: T) => boolean;
  /** This function tells if a value of the host type is a member of the set. */
  readonly contains: (a: T) => boolean;
  /** This function draws a member from a seeded source. The draw includes the edge values of the set. */
  readonly sample: (random: Random) => T;
  /** This function gives the text of a member. */
  readonly show: (a: T) => string;
  /** The list of the members of a small finite set. The runner then examines each tuple, not a sample. */
  readonly elements?: readonly T[];
}

/** A constant: an operation with no arguments. */
export interface Constant<T> {
  readonly name: string;
  readonly symbol: string;
  readonly arity: 0;
  readonly value: T;
}

/** An operation with one argument. */
export interface Unary<T> {
  readonly name: string;
  readonly symbol: string;
  readonly arity: 1;
  readonly apply: (a: T) => T;
}

/** An operation with two arguments. */
export interface Binary<T> {
  readonly name: string;
  readonly symbol: string;
  readonly arity: 2;
  readonly apply: (a: T, b: T) => T;
}

/** A relation between two values. */
export interface Relation<T> {
  readonly name: string;
  readonly symbol: string;
  readonly arity: 2;
  readonly apply: (a: T, b: T) => boolean;
}

/** A test of one value. A normal subgroup and an ideal use it for their members. */
export interface Predicate<T> {
  readonly name: string;
  readonly symbol: string;
  readonly arity: 1;
  readonly apply: (a: T) => boolean;
}

/** The names of the laws of one operation. */
export type MagmaLaw =
  | "closed"
  | "associative"
  | "commutative"
  | "idempotent"
  | "leftIdentity"
  | "rightIdentity"
  | "inverseClosed"
  | "leftInverse"
  | "rightInverse";

/** The names of the laws of a ring and a field. */
export type RingLaw = "leftDistributive" | "rightDistributive" | "noZeroDivisors" | "nontrivial" | "unitsAreNonzero" | "unitsAgree";

/** The names of the laws of a normal subgroup and an ideal. They examine the whole carrier, not only the representatives. */
export type CongruenceLaw = "reduceSettles" | "memberAgrees" | "congruentLeft" | "congruentRight" | "absorbsLeft" | "absorbsRight";

/** The names of the laws of an order and a lattice. */
export type OrderLaw =
  | "reflexive"
  | "antisymmetric"
  | "transitive"
  | "total"
  | "meetAgrees"
  | "joinAgrees"
  | "meetAbsorbs"
  | "joinAbsorbs"
  | "distributive";

/** The name of a law. The catalog `LAWS` has one law for each name. */
export type LawName = MagmaLaw | RingLaw | OrderLaw | CongruenceLaw;

/** The laws that a structure claims. The names of `Required` are necessary, and the names of `Optional` are permitted. */
export type Claims<Required extends LawName, Optional extends LawName = never> = { readonly [K in Required]: true } & {
  readonly [K in Optional]?: true;
};

/**
 * A law that a structure does not claim, with the arguments of a counterexample. A test replays each refutation, so
 * the note is not only a promise.
 */
export interface Refutation<T> {
  readonly law: LawName;
  /** The values of the counterexample. Their count is the arity of the law. */
  readonly arguments: readonly T[];
  /** The counterexample as text. */
  readonly note: string;
}

/** The names of the levels. The table `LEVELS` tells what each level adds. */
export type Level =
  | "magma"
  | "semigroup"
  | "unital-magma"
  | "monoid"
  | "group"
  | "ring"
  | "field"
  | "order"
  | "lattice"
  | "bounded-lattice"
  | "normal-subgroup"
  | "ideal";

/**
 * This record tells how a root extension knows if its polynomial is irreducible. The verdict `unknown` gives no claim
 * of a field. The law runner cannot find a reducible polynomial by samples over an infinite carrier, so this proof
 * carries the claim of a field.
 */
export interface Evidence {
  readonly verdict: "irreducible" | "reducible" | "unknown";
  /** The method of the verdict. The value `none` means that no method applied. */
  readonly method: "degree-one" | "trial-division" | "rational-root" | "eisenstein" | "none";
  /** The verdict as text. */
  readonly note: string;
}

/** This record tells how a structure came from other structures. The runner tests the inputs too. */
export interface Construction {
  readonly name: "quotient" | "polynomial-ring" | "root-extension";
  /** The input structures, by their role in the construction. */
  readonly inputs: Readonly<Record<string, AnyStructure>>;
  readonly evidence?: Evidence;
}

type OptionalMagmaLaw = "associative" | "commutative" | "idempotent";

/** A carrier with one binary operation. This level claims only closure. */
export interface Magma<T> {
  readonly level: "magma" | "semigroup" | "unital-magma" | "monoid" | "group";
  readonly name: string;
  readonly carrier: Carrier<T>;
  readonly op: Binary<T>;
  readonly claims: Claims<"closed", OptionalMagmaLaw>;
  readonly refuted?: readonly Refutation<T>[];
  readonly construction?: Construction;
}

/** A magma whose operation is associative. */
export interface Semigroup<T> extends Magma<T> {
  readonly level: "semigroup" | "monoid" | "group";
  readonly claims: Claims<"closed" | "associative", OptionalMagmaLaw>;
}

/** A magma with an identity. The doubles under add are at this level, because their add is not associative. */
export interface UnitalMagma<T> extends Magma<T> {
  readonly level: "unital-magma" | "monoid" | "group";
  readonly identity: Constant<T>;
  readonly claims: Claims<"closed" | "leftIdentity" | "rightIdentity", OptionalMagmaLaw>;
}

/** A semigroup with an identity. */
export interface Monoid<T> extends Semigroup<T>, UnitalMagma<T> {
  readonly level: "monoid" | "group";
  readonly claims: Claims<"closed" | "associative" | "leftIdentity" | "rightIdentity", OptionalMagmaLaw>;
}

/** A monoid with an inverse for each value. */
export interface Group<T> extends Monoid<T> {
  readonly level: "group";
  readonly inverse: Unary<T>;
  readonly claims: Claims<
    "closed" | "associative" | "leftIdentity" | "rightIdentity" | "inverseClosed" | "leftInverse" | "rightInverse",
    OptionalMagmaLaw
  >;
}

/** This type adds the claim of commutativity to a structure with one operation. */
export type Commutative<S> = S & { readonly claims: { readonly commutative: true } };

/** This type adds the claims of a semilattice to a structure with one operation: commutative and idempotent. */
export type Semilattice<S> = S & {
  readonly claims: { readonly commutative: true; readonly idempotent: true };
};

/** A carrier with an additive commutative group and a multiplicative monoid that distributes over the add. */
export interface Ring<T> {
  readonly level: "ring" | "field";
  readonly name: string;
  readonly carrier: Carrier<T>;
  readonly additive: Commutative<Group<T>>;
  readonly multiplicative: Monoid<T>;
  readonly claims: Claims<"leftDistributive" | "rightDistributive", "noZeroDivisors">;
  readonly refuted?: readonly Refutation<T>[];
  readonly construction?: Construction;
}

/** A ring with a commutative multiplication. */
export type CommutativeRing<T> = Ring<T> & { readonly multiplicative: Commutative<Monoid<T>> };

/** A ring with a commutative multiplication, and a commutative group of units: all the values that are not zero. */
export interface Field<T> extends Ring<T> {
  readonly level: "field";
  readonly multiplicative: Commutative<Monoid<T>>;
  readonly units: Commutative<Group<T>>;
  readonly claims: Claims<"leftDistributive" | "rightDistributive" | "nontrivial" | "unitsAreNonzero" | "unitsAgree", "noZeroDivisors">;
}

/** A carrier with a partial order. The claim `total` is optional, because a product of total orders is not total. */
export interface Order<T> {
  readonly level: "order" | "lattice" | "bounded-lattice";
  readonly name: string;
  readonly carrier: Carrier<T>;
  readonly leq: Relation<T>;
  readonly claims: Claims<"reflexive" | "antisymmetric" | "transitive", "total">;
  readonly refuted?: readonly Refutation<T>[];
  readonly construction?: Construction;
}

type LatticeLaw = "reflexive" | "antisymmetric" | "transitive" | "meetAgrees" | "joinAgrees" | "meetAbsorbs" | "joinAbsorbs";

/** An order with a meet and a join. Each one is a commutative idempotent semigroup that agrees with the order. */
export interface Lattice<T> extends Order<T> {
  readonly level: "lattice" | "bounded-lattice";
  readonly meet: Semilattice<Semigroup<T>>;
  readonly join: Semilattice<Semigroup<T>>;
  readonly claims: Claims<LatticeLaw, "total" | "distributive">;
}

/** A lattice with a top and a bottom: the meet and the join are monoids. The identity of the meet is the top. */
export interface BoundedLattice<T> extends Lattice<T> {
  readonly level: "bounded-lattice";
  readonly meet: Semilattice<Monoid<T>>;
  readonly join: Semilattice<Monoid<T>>;
}

/**
 * A subset of a group, as a map to one representative of each coset. The carrier is the whole group, so the runner
 * examines the laws on each value and not only on the representatives. The laws state that `reduce` respects the
 * operation. Thus the kernel of `reduce` is a normal subgroup, and a quotient keeps each equation of the group.
 */
export interface NormalSubgroup<T> {
  readonly level: "normal-subgroup" | "ideal";
  readonly name: string;
  readonly carrier: Carrier<T>;
  readonly group: Group<T>;
  readonly member: Predicate<T>;
  /** This operation gives the canonical representative of the coset of a value. */
  readonly reduce: Unary<T>;
  /** The list of the representatives, when the quotient is small and finite. */
  readonly representatives?: readonly T[];
  readonly claims: Claims<"reduceSettles" | "memberAgrees" | "congruentLeft" | "congruentRight">;
  readonly refuted?: readonly Refutation<T>[];
  readonly construction?: Construction;
}

/** A normal subgroup of the additive group of a ring, and `reduce` respects the multiplication too. */
export interface Ideal<T> extends NormalSubgroup<T> {
  readonly level: "ideal";
  readonly group: Commutative<Group<T>>;
  readonly ring: Ring<T>;
  readonly claims: Claims<"reduceSettles" | "memberAgrees" | "congruentLeft" | "congruentRight" | "absorbsLeft" | "absorbsRight">;
}

/** An ideal of a ring with a commutative multiplication. */
export type CommutativeIdeal<T> = Ideal<T> & { readonly ring: CommutativeRing<T> };

/** A structure of any level. */
export type Structure<T> = Magma<T> | Ring<T> | Order<T> | NormalSubgroup<T>;

/** A structure of any carrier, for a list of mixed structures. The type of each structure ties its values together. */
export type AnyStructure = Structure<any>;

/**
 * This function gives the carrier of the values that are not `zero`. A field uses it for its group of units.
 *
 * @param name - The name of the new carrier.
 * @param carrier - The whole carrier.
 * @param zero - The value to remove.
 */
export const withoutZero = <T>(name: string, carrier: Carrier<T>, zero: T): Carrier<T> => {
  const nonzero = (a: T): boolean => !carrier.equals(a, zero);
  const sample = (random: Random): T => {
    for (;;) {
      const value = carrier.sample(random);
      if (nonzero(value)) return value;
    }
  };
  return {
    name,
    description: `the values of ${carrier.name} without ${carrier.show(zero)}`,
    exact: carrier.exact,
    equals: carrier.equals,
    contains: (a) => carrier.contains(a) && nonzero(a),
    sample,
    show: carrier.show,
    ...(carrier.elements === undefined ? {} : { elements: carrier.elements.filter(nonzero) }),
  };
};

/**
 * This function refuses an inexact carrier. A construction over rounded values has no exact equality of cosets or of
 * coefficients, so it claims nothing.
 *
 * @param carrier - The input carrier.
 * @param construction - The name of the construction, for the message.
 * @throws TypeError when the carrier is not exact.
 */
export const requireExact = <T>(carrier: Carrier<T>, construction: string): void => {
  if (!carrier.exact) throw new TypeError(`no ${construction} over the inexact carrier ${carrier.name}`);
};
