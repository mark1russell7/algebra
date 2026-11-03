/**
 * The product of two structures: the first construction. It acts on each side of a pair. It claims exactly the laws
 * that both factors claim and that a product preserves. Thus the product of two fields is a ring, not a field.
 *
 * @packageDocumentation
 */
import { LAWS } from "./laws.ts";
import type {
  AnyStructure,
  Binary,
  BoundedLattice,
  Carrier,
  Constant,
  Group,
  Lattice,
  LawName,
  Magma,
  Monoid,
  Order,
  Relation,
  Ring,
  Semigroup,
  Unary,
  UnitalMagma,
} from "./structure.ts";

/** A value of a product. */
export type Pair<A, B> = readonly [A, B];

/** The largest count of elements that a product lists. The runner examines each tuple of a small carrier. */
const LISTED_LIMIT = 4096;

const productCarrier = <A, B>(a: Carrier<A>, b: Carrier<B>): Carrier<Pair<A, B>> => {
  const listed =
    a.elements !== undefined && b.elements !== undefined && a.elements.length * b.elements.length <= LISTED_LIMIT
      ? { elements: a.elements.flatMap((x) => b.elements?.map((y): Pair<A, B> => [x, y]) ?? []) }
      : {};
  return {
    name: `${a.name} × ${b.name}`,
    description: `the pairs of ${a.name} and ${b.name}`,
    exact: a.exact && b.exact,
    equals: (x, y) => a.equals(x[0], y[0]) && b.equals(x[1], y[1]),
    contains: (x) => a.contains(x[0]) && b.contains(x[1]),
    sample: (random) => [a.sample(random), b.sample(random)],
    show: (x) => `(${a.show(x[0])}, ${b.show(x[1])})`,
    ...listed,
  };
};

const sharedClaims = (a: object, b: object): Readonly<Partial<Record<LawName, true>>> =>
  Object.fromEntries(
    (Object.keys(a) as LawName[]).filter((name) => name in b && LAWS[name].preservedByProduct).map((name) => [name, true]),
  );

const binary = <A, B>(a: Binary<A>, b: Binary<B>): Binary<Pair<A, B>> => ({
  name: `${a.name} × ${b.name}`,
  symbol: `${a.symbol} × ${b.symbol}`,
  arity: 2,
  apply: (x, y) => [a.apply(x[0], y[0]), b.apply(x[1], y[1])],
});

const unary = <A, B>(a: Unary<A>, b: Unary<B>): Unary<Pair<A, B>> => ({
  name: `${a.name} × ${b.name}`,
  symbol: `${a.symbol} × ${b.symbol}`,
  arity: 1,
  apply: (x) => [a.apply(x[0]), b.apply(x[1])],
});

const constant = <A, B>(a: Constant<A>, b: Constant<B>): Constant<Pair<A, B>> => ({
  name: `${a.name} × ${b.name}`,
  symbol: `(${a.symbol}, ${b.symbol})`,
  arity: 0,
  value: [a.value, b.value],
});

const relation = <A, B>(a: Relation<A>, b: Relation<B>): Relation<Pair<A, B>> => ({
  name: `${a.name} × ${b.name}`,
  symbol: `${a.symbol} × ${b.symbol}`,
  arity: 2,
  apply: (x, y) => a.apply(x[0], y[0]) && b.apply(x[1], y[1]),
});

// The functions below read fields by presence. The overloads of `product` state the types, and `conforms` tests them.
type Wide = any;

const productMagma = (a: Wide, b: Wide, carrier: Carrier<Wide>): Wide => {
  const claims = sharedClaims(a.claims, b.claims);
  const unital = "identity" in a && "identity" in b;
  const invertible = "inverse" in a && "inverse" in b;
  const associative = claims.associative === true;
  const level = invertible ? "group" : unital ? (associative ? "monoid" : "unital-magma") : associative ? "semigroup" : "magma";
  return {
    level,
    name: `${a.name} × ${b.name}`,
    carrier,
    op: binary(a.op, b.op),
    ...(unital ? { identity: constant(a.identity, b.identity) } : {}),
    ...(invertible ? { inverse: unary(a.inverse, b.inverse) } : {}),
    claims,
  };
};

const productOrder = (a: Wide, b: Wide, carrier: Carrier<Wide>): Wide => {
  const order = {
    level: "order",
    name: `${a.name} × ${b.name}`,
    carrier,
    leq: relation(a.leq, b.leq),
    claims: sharedClaims(a.claims, b.claims),
  };
  if (!("meet" in a && "meet" in b)) return order;
  const meet = productMagma(a.meet, b.meet, carrier);
  return {
    ...order,
    level: "identity" in meet ? "bounded-lattice" : "lattice",
    meet,
    join: productMagma(a.join, b.join, carrier),
  };
};

/**
 * This function gives the product of two structures. The operations act on each side of a pair. The result has the
 * highest level that both factors reach, without `field`: a pair with a zero side has no inverse.
 *
 * @param a - The first factor.
 * @param b - The second factor.
 * @returns A new structure. Its claims are the laws that both factors claim and that a product preserves. Its
 * refutations are empty: a refuted law of a factor is only not claimed.
 * @throws TypeError when the factors are not of one family: one operation, a ring, or an order.
 */
export function product<A, B>(a: BoundedLattice<A>, b: BoundedLattice<B>): BoundedLattice<Pair<A, B>>;
export function product<A, B>(a: Lattice<A>, b: Lattice<B>): Lattice<Pair<A, B>>;
export function product<A, B>(a: Order<A>, b: Order<B>): Order<Pair<A, B>>;
export function product<A, B>(a: Ring<A>, b: Ring<B>): Ring<Pair<A, B>>;
export function product<A, B>(a: Group<A>, b: Group<B>): Group<Pair<A, B>>;
export function product<A, B>(a: Monoid<A>, b: Monoid<B>): Monoid<Pair<A, B>>;
export function product<A, B>(a: Semigroup<A>, b: Semigroup<B>): Semigroup<Pair<A, B>>;
export function product<A, B>(a: UnitalMagma<A>, b: UnitalMagma<B>): UnitalMagma<Pair<A, B>>;
export function product<A, B>(a: Magma<A>, b: Magma<B>): Magma<Pair<A, B>>;
export function product(a: AnyStructure, b: AnyStructure): AnyStructure {
  const carrier = productCarrier(a.carrier, b.carrier);
  if ("additive" in a && "additive" in b) {
    return {
      level: "ring",
      name: `${a.name} × ${b.name}`,
      carrier,
      additive: productMagma(a.additive, b.additive, carrier),
      multiplicative: productMagma(a.multiplicative, b.multiplicative, carrier),
      claims: sharedClaims(a.claims, b.claims) as Ring<unknown>["claims"],
    };
  }
  if ("leq" in a && "leq" in b) return productOrder(a, b, carrier);
  if ("op" in a && "op" in b) return productMagma(a, b, carrier);
  throw new TypeError(`no product of ${a.level} and ${b.level}`);
}
