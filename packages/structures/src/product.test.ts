import { describe, expect, it } from "vitest";
import type { Rational } from "@mark1russell7/rational";
import { ONE, ZERO } from "@mark1russell7/rational";
import {
  BOOLEAN_AND,
  BOOLEAN_LATTICE,
  BOOLEAN_RING,
  BOOLEAN_XOR,
  DOUBLE_ADD,
  DOUBLE_LATTICE,
  DOUBLE_MIN,
  RATIONAL_ADD,
  RATIONAL_FIELD,
  RATIONAL_LATTICE,
  RATIONAL_MIN,
  RATIONAL_MUL,
  RATIONAL_ORDER,
  checkClaims,
  conforms,
  holdsAt,
  integersMod,
  primeField,
  product,
} from "./catalog-entry.ts";
import type { AnyStructure, BoundedLattice, Group, Lattice, Magma, Monoid, Order, Pair, Ring, Semigroup, UnitalMagma } from "./catalog-entry.ts";

const passes = (structure: AnyStructure): void => {
  expect(conforms(structure)).toEqual([]);
  expect(checkClaims(structure).filter((report) => report.failure !== null)).toEqual([]);
};

describe("the product of each level", () => {
  const cases: readonly (readonly [string, AnyStructure, string])[] = [
    ["two groups", product(RATIONAL_ADD, BOOLEAN_XOR), "group"],
    ["two monoids", product(RATIONAL_MUL, BOOLEAN_AND), "monoid"],
    ["a group and a monoid", product(RATIONAL_ADD, DOUBLE_MIN), "monoid"],
    ["two semigroups", product(RATIONAL_MIN, RATIONAL_MIN), "semigroup"],
    ["a monoid and a semigroup", product(RATIONAL_MUL, RATIONAL_MIN), "semigroup"],
    ["a monoid and a unital magma", product(RATIONAL_MUL, DOUBLE_ADD), "unital-magma"],
    ["a semigroup and a unital magma", product(RATIONAL_MIN, DOUBLE_ADD), "magma"],
    ["two rings", product(integersMod(6n), BOOLEAN_RING), "ring"],
    ["two fields", product(RATIONAL_FIELD, primeField(7n)), "ring"],
    ["two orders", product(RATIONAL_ORDER, RATIONAL_ORDER), "order"],
    ["two lattices", product(RATIONAL_LATTICE, DOUBLE_LATTICE), "lattice"],
    ["two bounded lattices", product(BOOLEAN_LATTICE, DOUBLE_LATTICE), "bounded-lattice"],
    ["a product of a product", product(product(primeField(2n), primeField(3n)), integersMod(4n)), "ring"],
  ];

  it.each(cases)("%s conforms, and its claims hold", (_, structure, level) => {
    expect(structure.level).toBe(level);
    passes(structure);
  });

  it("states its level by types", () => {
    const group: Group<Pair<Rational, boolean>> = product(RATIONAL_ADD, BOOLEAN_XOR);
    const monoid: Monoid<Pair<Rational, boolean>> = product(RATIONAL_MUL, BOOLEAN_AND);
    const semigroup: Semigroup<Pair<Rational, Rational>> = product(RATIONAL_MIN, RATIONAL_MIN);
    const unital: UnitalMagma<Pair<Rational, number>> = product(RATIONAL_MUL, DOUBLE_ADD);
    const magma: Magma<Pair<Rational, number>> = product(RATIONAL_MIN, DOUBLE_ADD);
    const ring: Ring<Pair<Rational, Rational>> = product(RATIONAL_FIELD, RATIONAL_FIELD);
    const order: Order<Pair<Rational, Rational>> = product(RATIONAL_ORDER, RATIONAL_ORDER);
    const lattice: Lattice<Pair<Rational, Rational>> = product(RATIONAL_LATTICE, RATIONAL_LATTICE);
    const bounded: BoundedLattice<Pair<boolean, number>> = product(BOOLEAN_LATTICE, DOUBLE_LATTICE);
    for (const value of [group, monoid, semigroup, unital, magma, ring, order, lattice, bounded]) expect(value.claims).toBeDefined();
  });

  it("refuses factors of two families", () => {
    const wrong = product as unknown as (a: AnyStructure, b: AnyStructure) => AnyStructure;
    expect(() => wrong(RATIONAL_FIELD, RATIONAL_ADD)).toThrow(TypeError);
  });
});

describe("the claims of a product", () => {
  it("are the claims of both factors that a product preserves", () => {
    const mixed = product(RATIONAL_MUL, DOUBLE_ADD);
    expect(mixed.claims).not.toHaveProperty("associative");
    expect(Object.keys(mixed.claims).sort()).toEqual(["closed", "commutative", "leftIdentity", "rightIdentity"]);
    expect(product(DOUBLE_MIN, DOUBLE_MIN).claims).toHaveProperty("idempotent");
    expect(product(DOUBLE_MIN, RATIONAL_MUL).claims).not.toHaveProperty("idempotent");
  });

  it("leave out a law that one factor does not claim, and that law fails in the product", () => {
    const mixed = product(RATIONAL_MUL, DOUBLE_ADD);
    const left = (value: number): Pair<Rational, number> => [ONE, value];
    expect(holdsAt(mixed, "associative", [left(0.1), left(0.2), left(0.3)])).toBe(false);
  });

  it("make the product of two fields a ring with a pair that has no inverse", () => {
    const pairs = product(RATIONAL_FIELD, RATIONAL_FIELD);
    expect(pairs.level).toBe("ring");
    expect(pairs).not.toHaveProperty("units");
    expect(Object.keys(pairs.claims).sort()).toEqual(["leftDistributive", "rightDistributive"]);
    const multiply = pairs.multiplicative.op.apply;
    const witness: Pair<Rational, Rational> = [ONE, ZERO];
    expect(pairs.carrier.equals(witness, pairs.additive.identity.value)).toBe(false);
    // each product with the witness has a zero on the right, so no product gives the pair (1, 1)
    const { carrier } = pairs;
    for (const other of [[ONE, ONE], [ZERO, ONE], [ONE, ZERO]] as const) {
      expect(carrier.equals(multiply(witness, other), pairs.multiplicative.identity.value)).toBe(false);
    }
    // the witness times (0, 1) is the zero, so the pairs have zero divisors
    expect(carrier.equals(multiply(witness, [ZERO, ONE]), pairs.additive.identity.value)).toBe(true);
  });

  it("are not total for two total orders, with a pair that is not comparable", () => {
    const pairs = product(RATIONAL_ORDER, RATIONAL_ORDER);
    expect(RATIONAL_ORDER.claims.total).toBe(true);
    expect(pairs.claims).not.toHaveProperty("total");
    const first: Pair<Rational, Rational> = [ONE, ZERO];
    const second: Pair<Rational, Rational> = [ZERO, ONE];
    expect(pairs.leq.apply(first, second)).toBe(false);
    expect(pairs.leq.apply(second, first)).toBe(false);
    expect(holdsAt(pairs, "total", [first, second])).toBe(false);
  });
});

describe("the product against an independent oracle", () => {
  it("gives the ring of the integers modulo 6 from 2 and 3", () => {
    const six = integersMod(6n);
    const parts = product(integersMod(2n), integersMod(3n));
    const toPair = (value: bigint): Pair<bigint, bigint> => [value % 2n, value % 3n];
    expect(parts.carrier.elements).toHaveLength(6);
    for (const a of six.carrier.elements ?? []) {
      for (const b of six.carrier.elements ?? []) {
        const [x, y] = [toPair(a), toPair(b)];
        expect(toPair(six.additive.op.apply(a, b))).toEqual(parts.additive.op.apply(x, y));
        expect(toPair(six.multiplicative.op.apply(a, b))).toEqual(parts.multiplicative.op.apply(x, y));
      }
    }
    expect(toPair(1n)).toEqual(parts.multiplicative.identity.value);
  });

  it("checks each tuple of a small product", () => {
    const reports = checkClaims(product(integersMod(2n), integersMod(3n)));
    expect(reports.find((report) => report.law === "leftDistributive")).toMatchObject({ exhaustive: true, cases: 216 });
  });
});
