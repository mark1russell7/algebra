/**
 * Quotients: a group modulo a normal subgroup, and a ring modulo an ideal. A quotient value is the canonical
 * representative of its coset, so the equality of the input carrier is the equality of the cosets.
 *
 * The subset is data too. Its laws examine the whole input carrier. If `reduce` settles and respects the operations,
 * each equation of the input holds on the cosets. So a quotient claims the laws that its input claims and that a
 * quotient keeps. The quotient holds its subset as an input, and `checkClaims` tests the subset.
 *
 * @packageDocumentation
 */
import { floor, isInteger, sub } from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { INTEGER_RING } from "./integers.ts";
import { LAWS } from "./laws.ts";
import { RATIONAL_ADD } from "./rationals.ts";
import { requireExact } from "./structure.ts";
import type {
  Binary,
  Carrier,
  Commutative,
  CommutativeIdeal,
  CommutativeRing,
  Constant,
  Group,
  Ideal,
  LawName,
  Monoid,
  NormalSubgroup,
  Ring,
  Unary,
} from "./structure.ts";

/** The data of a subset: a name, a test of membership and the canonical representative of each coset. */
export interface SubsetDefinition<T> {
  readonly name: string;
  readonly member: (a: T) => boolean;
  readonly reduce: (a: T) => T;
  /** The list of the representatives of a small quotient. The runner then examines each tuple of the quotient. */
  readonly representatives?: readonly T[];
}

/** The largest quotient of the integers that lists its elements. */
const LISTED_LIMIT = 64n;

const SUBGROUP_CLAIMS = { reduceSettles: true, memberAgrees: true, congruentLeft: true, congruentRight: true } as const;

const parts = <T>(definition: SubsetDefinition<T>): Pick<NormalSubgroup<T>, "name" | "member" | "reduce" | "representatives"> => ({
  name: definition.name,
  member: { name: "member", symbol: "∈", arity: 1, apply: definition.member },
  reduce: { name: "reduce", symbol: "r", arity: 1, apply: definition.reduce },
  ...(definition.representatives === undefined ? {} : { representatives: definition.representatives }),
});

/**
 * This function states that a subset is a normal subgroup. It does no check: `checkClaims` tests this claim.
 *
 * @param group - The group.
 * @param definition - The subset.
 */
export const normalSubgroupOf = <T>(group: Group<T>, definition: SubsetDefinition<T>): NormalSubgroup<T> => ({
  level: "normal-subgroup",
  carrier: group.carrier,
  group,
  claims: SUBGROUP_CLAIMS,
  ...parts(definition),
});

/**
 * This function states that a subset is an ideal. It does no check: `checkClaims` tests this claim.
 *
 * @param ring - The ring.
 * @param definition - The subset.
 */
export function idealOf<T>(ring: CommutativeRing<T>, definition: SubsetDefinition<T>): CommutativeIdeal<T>;
export function idealOf<T>(ring: Ring<T>, definition: SubsetDefinition<T>): Ideal<T>;
export function idealOf<T>(ring: Ring<T>, definition: SubsetDefinition<T>): Ideal<T> {
  return {
    level: "ideal",
    carrier: ring.carrier,
    group: ring.additive,
    ring,
    claims: { ...SUBGROUP_CLAIMS, absorbsLeft: true, absorbsRight: true },
    ...parts(definition),
  };
}

/**
 * This function gives the left cosets of a listed subset of a listed group. The representative of `a` is the first
 * element `e` of the carrier with `a⁻¹ · e` in the subset. It does not test the subset: the laws do that.
 */
const listedCosets = <T>(group: Group<T>, members: readonly T[]): SubsetDefinition<T> => {
  const { carrier } = group;
  const { elements } = carrier;
  if (elements === undefined) throw new TypeError(`the carrier ${carrier.name} lists no elements`);
  if (members.length === 0) throw new RangeError("a subset of a group has at least one member");
  const member = (a: T): boolean => members.some((entry) => carrier.equals(entry, a));
  const reduce = (a: T): T => {
    const inverse = group.inverse.apply(a);
    return elements.find((entry) => member(group.op.apply(inverse, entry))) ?? a;
  };
  return { name: `{${members.map(carrier.show).join(", ")}}`, member, reduce };
};

/**
 * This function gives a listed subset of a group with a listed carrier, as a claimed normal subgroup.
 *
 * @param group - A group that lists its elements.
 * @param members - The members. The function does not test them.
 * @throws TypeError when the group lists no elements. RangeError when `members` is empty.
 */
export const listedNormalSubgroup = <T>(group: Group<T>, members: readonly T[]): NormalSubgroup<T> =>
  normalSubgroupOf(group, listedCosets(group, members));

/**
 * This function gives a listed subset of a ring with a listed carrier, as a claimed ideal.
 *
 * @param ring - A ring that lists its elements.
 * @param members - The members. The function does not test them.
 * @throws TypeError when the ring lists no elements. RangeError when `members` is empty.
 */
export const listedIdeal = <T>(ring: Ring<T>, members: readonly T[]): Ideal<T> => idealOf(ring, listedCosets(ring.additive, members));

const distinct = <T>(carrier: Carrier<T>, values: readonly T[]): readonly T[] =>
  values.filter((value, index) => values.findIndex((other) => carrier.equals(other, value)) === index);

const quotientCarrier = <T>(subset: NormalSubgroup<T>): Carrier<T> => {
  const { carrier } = subset;
  const reduce = subset.reduce.apply;
  const elements = subset.representatives ?? (carrier.elements === undefined ? undefined : distinct(carrier, carrier.elements.map(reduce)));
  return {
    name: `${carrier.name}/${subset.name}`,
    description: `the cosets of ${subset.name} in ${carrier.name}, each one as its canonical representative`,
    exact: carrier.exact,
    equals: carrier.equals,
    contains: (a) => carrier.contains(a) && carrier.equals(reduce(a), a),
    sample: (random) => (elements === undefined ? reduce(carrier.sample(random)) : random.pick(elements)),
    show: carrier.show,
    ...(elements === undefined ? {} : { elements }),
  };
};

const kept = <C extends object>(claims: C): C =>
  Object.fromEntries((Object.keys(claims) as LawName[]).filter((name) => LAWS[name].preservedByQuotient).map((name) => [name, true])) as C;

const reducedBinary = <T>(op: Binary<T>, reduce: (a: T) => T): Binary<T> => ({ ...op, apply: (a, b) => reduce(op.apply(a, b)) });

const reducedUnary = <T>(op: Unary<T>, reduce: (a: T) => T): Unary<T> => ({ ...op, apply: (a) => reduce(op.apply(a)) });

const reducedConstant = <T>(constant: Constant<T>, reduce: (a: T) => T): Constant<T> => ({ ...constant, value: reduce(constant.value) });

const reducedMonoid = <T>(monoid: Monoid<T>, carrier: Carrier<T>, reduce: (a: T) => T): Monoid<T> => ({
  level: "monoid",
  name: `${carrier.name} (${monoid.op.symbol})`,
  carrier,
  op: reducedBinary(monoid.op, reduce),
  identity: reducedConstant(monoid.identity, reduce),
  claims: kept(monoid.claims),
});

const reducedGroup = <T>(group: Group<T>, carrier: Carrier<T>, reduce: (a: T) => T): Group<T> => ({
  ...reducedMonoid(group, carrier, reduce),
  level: "group",
  inverse: reducedUnary(group.inverse, reduce),
  claims: kept(group.claims),
});

/**
 * This function gives a group modulo a normal subgroup. An ideal goes in as the normal subgroup of the additive group.
 *
 * @param subset - The normal subgroup.
 * @returns A group of the canonical representatives. It claims the laws of the group that a quotient keeps. It has
 * the subset as an input, so a subset that is not normal fails in `checkClaims`, with its arguments.
 * @throws TypeError when the carrier is not exact.
 */
export const quotientGroup = <T>(subset: NormalSubgroup<T>): Group<T> => {
  requireExact(subset.carrier, "quotient");
  const carrier = quotientCarrier(subset);
  return { ...reducedGroup(subset.group, carrier, subset.reduce.apply), name: carrier.name, construction: { name: "quotient", inputs: { subset } } };
};

/**
 * This function gives a ring modulo an ideal. The result is a ring, also when the ideal is maximal: no claim of a
 * field comes from a quotient. A root extension gives a field with its proof.
 *
 * @param ideal - The ideal.
 * @returns A ring of the canonical representatives. It claims the laws of the ring that a quotient keeps. It has the
 * ideal as an input, so a subset that is not an ideal fails in `checkClaims`, with its arguments.
 * @throws TypeError when the carrier is not exact.
 */
export function quotientRing<T>(ideal: CommutativeIdeal<T>): CommutativeRing<T>;
export function quotientRing<T>(ideal: Ideal<T>): Ring<T>;
export function quotientRing<T>(ideal: Ideal<T>): Ring<T> {
  requireExact(ideal.carrier, "quotient");
  const carrier = quotientCarrier(ideal);
  const reduce = ideal.reduce.apply;
  return {
    level: "ring",
    name: carrier.name,
    carrier,
    additive: reducedGroup(ideal.ring.additive, carrier, reduce) as Commutative<Group<T>>,
    multiplicative: reducedMonoid(ideal.ring.multiplicative, carrier, reduce),
    claims: kept(ideal.ring.claims),
    construction: { name: "quotient", inputs: { ideal } },
  };
}

/**
 * This function gives the ideal of the multiples of `n` in the integers.
 *
 * @param n - A positive integer.
 * @throws RangeError when `n` is not positive.
 */
export const integerIdeal = (n: bigint): CommutativeIdeal<bigint> => {
  if (n < 1n) throw new RangeError(`not a positive integer: ${n}`);
  const listed = n <= LISTED_LIMIT ? { representatives: Array.from({ length: Number(n) }, (_, i) => BigInt(i)) } : {};
  return idealOf(INTEGER_RING, {
    name: `(${n})`,
    member: (a) => a % n === 0n,
    reduce: (a) => ((a % n) + n) % n,
    ...listed,
  });
};

/** The integers in the rationals, by the fractional part. This subset is a normal subgroup, and it is not an ideal. */
export const INTEGER_COSETS: SubsetDefinition<Rational> = {
  name: "Z",
  member: isInteger,
  reduce: (a) => sub(a, floor(a)),
};

/** The group of the rationals modulo the integers: an exact quotient with an infinite carrier. */
export const RATIONALS_MOD_INTEGERS: Group<Rational> = quotientGroup(normalSubgroupOf(RATIONAL_ADD, INTEGER_COSETS));
