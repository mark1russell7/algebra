import { describe, expect, it } from "vitest";
import type { Rational } from "@mark1russell7/rational";
import {
  BOOLEAN_LATTICE,
  CATALOG,
  DOUBLE_ADD,
  DOUBLE_LATTICE,
  DOUBLE_MIN,
  LAWS,
  LEVELS,
  RATIONAL_ADD,
  RATIONAL_FIELD,
  RATIONAL_LATTICE,
  RATIONAL_MIN,
  RATIONAL_MUL,
  RATIONAL_ORDER,
  RATIONAL_UNITS,
  checkClaims,
  conforms,
  integersMod,
  levelsBelow,
  operationFields,
  partSpecifications,
  primeField,
  product,
  requiredLaws,
} from "./index.ts";
import type { BoundedLattice, Field, Group, Lattice, Level, Magma, Monoid, Order, Ring, Semigroup, UnitalMagma } from "./index.ts";

/** This function reads only the fields of a monoid. A group goes in with no change: this is the reduction in use. */
const fold = <T>(monoid: Monoid<T>, values: readonly T[]): T =>
  values.reduce((total, value) => monoid.op.apply(total, value), monoid.identity.value);

describe("the reduction by types", () => {
  it("assigns each level to the level below", () => {
    const group: Group<Rational> = RATIONAL_ADD;
    const monoid: Monoid<Rational> = group;
    const semigroup: Semigroup<Rational> = monoid;
    const unital: UnitalMagma<Rational> = monoid;
    const magma: Magma<Rational> = semigroup;
    const ring: Ring<Rational> = RATIONAL_FIELD;
    const additive: Group<Rational> = ring.additive;
    const multiplicative: Monoid<Rational> = ring.multiplicative;
    const units: Group<Rational> = RATIONAL_FIELD.units;
    const bounded: BoundedLattice<number> = DOUBLE_LATTICE;
    const lattice: Lattice<number> = bounded;
    const order: Order<number> = lattice;
    const meet: Monoid<number> = DOUBLE_LATTICE.meet;
    const boundedMeet: Semigroup<number> = meet;
    for (const value of [monoid, unital, magma, additive, multiplicative, units, order, boundedMeet]) expect(value.carrier).toBeDefined();
  });

  it("refuses a structure at a level that it does not reach", () => {
    // @ts-expect-error double add is not associative, so it is not a monoid
    const doubleMonoid: Monoid<number> = DOUBLE_ADD;
    // @ts-expect-error double add has no inverse
    const doubleGroup: Group<number> = DOUBLE_ADD;
    // @ts-expect-error the rationals under min have no identity
    const minMonoid: Monoid<Rational> = RATIONAL_MIN;
    // @ts-expect-error the integers modulo 6 are a ring, and not a field
    const compositeField: Field<bigint> = integersMod(6n);
    // @ts-expect-error the product of two fields is a ring
    const productField: Field<readonly [Rational, Rational]> = product(RATIONAL_FIELD, RATIONAL_FIELD);
    // @ts-expect-error the rationals have no top and no bottom
    const boundedRationals: BoundedLattice<Rational> = RATIONAL_LATTICE;
    expect([doubleMonoid, doubleGroup, minMonoid, compositeField, productField, boundedRationals].length).toBe(6);
  });

  it("lets a function of a monoid take a group, a part of a ring and a part of a lattice", () => {
    const one = RATIONAL_FIELD.multiplicative.identity.value;
    expect(fold(RATIONAL_ADD, [one, one, one])).toEqual({ n: 3n, d: 1n });
    expect(fold(RATIONAL_FIELD.additive, [one, one])).toEqual({ n: 2n, d: 1n });
    expect(fold(RATIONAL_UNITS, [one])).toEqual(one);
    expect(fold(DOUBLE_LATTICE.meet, [3, 1, 2])).toBe(1);
    expect(fold(BOOLEAN_LATTICE.join, [false, true])).toBe(true);
  });
});

describe("the table of levels", () => {
  const levels = Object.keys(LEVELS) as Level[];

  it("names each level under its own key", () => {
    for (const level of levels) expect(LEVELS[level].level).toBe(level);
  });

  it("gives each level the operations and the laws of the levels below", () => {
    for (const level of levels) {
      for (const lower of LEVELS[level].below) {
        expect(requiredLaws(level)).toEqual(expect.arrayContaining([...requiredLaws(lower)]));
        expect(operationFields(level)).toEqual(expect.arrayContaining([...operationFields(lower)]));
        expect(partSpecifications(level).map((part) => part.field)).toEqual(expect.arrayContaining(partSpecifications(lower).map((part) => part.field)));
      }
    }
  });

  it("states the reductions of the roadmap", () => {
    expect(levelsBelow("group")).toEqual(expect.arrayContaining(["monoid", "semigroup", "unital-magma", "magma"]));
    expect(LEVELS.group.operations).toEqual(["inverse"]);
    expect(partSpecifications("ring")).toMatchObject([
      { field: "additive", level: "group", laws: ["commutative"] },
      { field: "multiplicative", level: "monoid" },
    ]);
    expect(levelsBelow("field")).toContain("ring");
    expect(partSpecifications("field").map((part) => `${part.field}: ${part.level}`)).toEqual(["additive: group", "multiplicative: monoid", "units: group"]);
    expect(levelsBelow("bounded-lattice")).toEqual(["bounded-lattice", "lattice", "order"]);
    expect(partSpecifications("bounded-lattice").map((part) => part.level)).toEqual(["monoid", "monoid"]);
  });

  it("names only the laws of its level or of the levels below", () => {
    for (const level of levels) {
      for (const law of LEVELS[level].laws) expect(levelsBelow(level)).toContain(LAWS[law].level);
    }
  });
});

describe("the instances against the table", () => {
  const lower: readonly (readonly [string, Parameters<typeof conforms>[0]])[] = [
    ["monoid", RATIONAL_MUL],
    ["semigroup", RATIONAL_MIN],
    ["order", RATIONAL_ORDER],
    ["monoid with min", DOUBLE_MIN],
  ];

  it.each([...CATALOG.map((structure) => [structure.name, structure] as const), ...lower])("%s conforms", (_, structure) => {
    expect(conforms(structure)).toEqual([]);
  });

  it("finds a structure that does not conform", () => {
    const noClaim = { ...RATIONAL_ADD, claims: { closed: true } } as unknown as Group<Rational>;
    expect(conforms(noClaim).join()).toContain("no claim of associative");
    const noInverse = { ...RATIONAL_ADD, inverse: undefined } as unknown as Group<Rational>;
    expect(conforms(noInverse).join()).toContain("no operation inverse");
    const lowPart = { ...RATIONAL_FIELD, additive: RATIONAL_MUL } as unknown as Field<Rational>;
    expect(conforms(lowPart).join()).toContain("the part additive is below group");
    const otherCarrier = { ...primeField(5n), multiplicative: primeField(7n).multiplicative } as unknown as Field<bigint>;
    expect(conforms(otherCarrier).join()).toContain("the part multiplicative has another carrier");
    const both = { ...DOUBLE_ADD, claims: { ...DOUBLE_ADD.claims, associative: true } } as UnitalMagma<number>;
    expect(conforms(both).join()).toContain("both claimed and refuted");
    const wrongLevel = { ...RATIONAL_MIN, claims: { ...RATIONAL_MIN.claims, leftIdentity: true } } as unknown as Semigroup<Rational>;
    expect(conforms(wrongLevel).join()).toContain("does not have the law leftIdentity");
  });

  it("passes the claims of a part alone, as a structure of the level below", () => {
    for (const part of [RATIONAL_FIELD.additive, RATIONAL_FIELD.multiplicative, RATIONAL_FIELD.units, primeField(5n).units]) {
      expect(checkClaims(part, { samples: 100 }).filter((report) => report.failure !== null)).toEqual([]);
    }
  });
});
