import { describe, expect, it } from "vitest";
import { fromDecimal, rational } from "@mark1russell7/rational";
import {
  BOOLEAN_RING,
  INTEGER_COSETS,
  LAWS,
  RATIONAL_ADD,
  RATIONAL_FIELD,
  RATIONALS_MOD_INTEGERS,
  alternatingSubgroup,
  checkClaims,
  conforms,
  extendFinite,
  holdsAt,
  idealOf,
  integerIdeal,
  integersMod,
  isEven,
  listedIdeal,
  listedNormalSubgroup,
  normalSubgroupOf,
  primeField,
  quotientGroup,
  quotientRing,
  symmetricGroup,
} from "./catalog-entry.ts";
import type { AnyStructure, Carrier, Group, LawReport, Permutation, Ring } from "./catalog-entry.ts";

const failuresOf = (structure: AnyStructure): readonly LawReport[] => checkClaims(structure).filter((report) => report.failure !== null);

const passes = (structure: AnyStructure): void => {
  expect(conforms(structure)).toEqual([]);
  expect(failuresOf(structure)).toEqual([]);
};

/** This function gives the structure without its inputs: the runner then sees only the representatives. */
const alone = <T>(ring: Ring<T>): Ring<T> => {
  const { construction: _, ...rest } = ring;
  return rest;
};

const pairs = <T>(elements: readonly T[]): readonly (readonly [T, T])[] => elements.flatMap((a) => elements.map((b) => [a, b] as const));

describe("the integers modulo n as a quotient of the integers", () => {
  it.each(Array.from({ length: 12 }, (_, i) => BigInt(i + 1)))("agree with integersMod(%s) on each element and each pair", (n) => {
    const quotient = quotientRing(integerIdeal(n));
    const ring = integersMod(n);
    const elements = ring.carrier.elements ?? [];
    expect(quotient.carrier.elements).toEqual(elements);
    expect(quotient.additive.identity.value).toBe(ring.additive.identity.value);
    expect(quotient.multiplicative.identity.value).toBe(ring.multiplicative.identity.value);
    for (const a of elements) {
      expect(quotient.additive.inverse.apply(a)).toBe(ring.additive.inverse.apply(a));
      expect(quotient.carrier.contains(a)).toBe(true);
    }
    for (const [a, b] of pairs(elements)) {
      expect(quotient.additive.op.apply(a, b)).toBe(ring.additive.op.apply(a, b));
      expect(quotient.multiplicative.op.apply(a, b)).toBe(ring.multiplicative.op.apply(a, b));
    }
    expect(quotient.carrier.contains(n)).toBe(false);
    expect(quotient.carrier.contains(-1n)).toBe(false);
    passes(quotient);
  });

  it("claim the laws of the integers that a quotient keeps", () => {
    const quotient = quotientRing(integerIdeal(6n));
    expect(Object.keys(quotient.claims).sort()).toEqual(["leftDistributive", "rightDistributive"]);
    expect(holdsAt(quotient, "noZeroDivisors", [2n, 3n])).toBe(false);
    expect(LAWS.noZeroDivisors.preservedByQuotient).toBe(false);
  });

  it("keep a large modulus by samples, with the canonical representative of a negative value", () => {
    const ideal = integerIdeal(2n ** 40n + 15n);
    expect(ideal.reduce.apply(-1n)).toBe(2n ** 40n + 14n);
    const quotient = quotientRing(ideal);
    expect(quotient.carrier.elements).toBeUndefined();
    passes(quotient);
  });

  it("refuse a modulus that is not positive", () => {
    expect(() => integerIdeal(0n)).toThrow(RangeError);
    expect(() => integerIdeal(-3n)).toThrow(RangeError);
  });
});

describe("a quotient of a listed ring", () => {
  it("gives the integers modulo 4 from the integers modulo 12", () => {
    const quotient = quotientRing(listedIdeal(integersMod(12n), [0n, 4n, 8n]));
    const four = integersMod(4n);
    expect(quotient.carrier.elements).toEqual(four.carrier.elements);
    for (const [a, b] of pairs(four.carrier.elements ?? [])) {
      expect(quotient.additive.op.apply(a, b)).toBe(four.additive.op.apply(a, b));
      expect(quotient.multiplicative.op.apply(a, b)).toBe(four.multiplicative.op.apply(a, b));
    }
    passes(quotient);
  });

  it("examines the ideal on each pair of the input", () => {
    const reports = checkClaims(quotientRing(listedIdeal(integersMod(12n), [0n, 4n, 8n])));
    const absorbs = reports.find((report) => report.law === "absorbsLeft");
    expect(absorbs).toMatchObject({ exhaustive: true, cases: 144, failure: null });
    expect(absorbs?.path).toBe("Z/12/{0, 4, 8}/ideal");
  });

  it("does not claim a law that the input does not claim", () => {
    const ring = integersMod(6n);
    const { commutative: _, ...claims } = ring.multiplicative.claims;
    const weaker: Ring<bigint> = { ...ring, multiplicative: { ...ring.multiplicative, claims } };
    const quotient = quotientRing(listedIdeal(weaker, [0n, 3n]));
    expect(quotient.multiplicative.claims).not.toHaveProperty("commutative");
    expect(quotientRing(listedIdeal(ring, [0n, 3n])).multiplicative.claims).toHaveProperty("commutative");
  });

  it("keeps the idempotent multiplication of the booleans on the cosets", () => {
    const quotient = quotientRing(listedIdeal(BOOLEAN_RING, [false]));
    expect(quotient.multiplicative.claims).toHaveProperty("idempotent");
    passes(quotient);
  });
});

describe("a group modulo a normal subgroup", () => {
  const s3 = symmetricGroup(3);

  it("gives the sign from S3 and A3", () => {
    const quotient = quotientGroup(alternatingSubgroup(s3));
    expect(quotient.carrier.elements).toHaveLength(2);
    expect(quotient.name).toBe("S3/A3");
    const signOf = (a: Permutation): number => {
      // The count of cycles of even length gives the sign. This count does not read the pairs of `isEven`.
      const seen = new Set<number>();
      let even = 0;
      a.forEach((start) => {
        let [length, point] = [0, start];
        while (!seen.has(point)) {
          seen.add(point);
          point = a[point] ?? point;
          length += 1;
        }
        if (length > 0 && length % 2 === 0) even += 1;
      });
      return even % 2 === 0 ? 1 : -1;
    };
    for (const [a, b] of pairs(s3.carrier.elements ?? [])) {
      const [x, y] = [a, b].map((value) => alternatingSubgroup(s3).reduce.apply(value)) as [Permutation, Permutation];
      expect(signOf(quotient.op.apply(x, y))).toBe(signOf(a) * signOf(b));
      expect(signOf(a) === 1).toBe(isEven(a));
    }
    passes(quotient);
  });

  it("gives the rationals modulo the integers, an exact group with an infinite carrier", () => {
    passes(RATIONALS_MOD_INTEGERS);
    expect(RATIONALS_MOD_INTEGERS.carrier.elements).toBeUndefined();
    const [a, b] = [fromDecimal("0.75"), fromDecimal("0.5")];
    expect(RATIONALS_MOD_INTEGERS.op.apply(a, b)).toEqual(rational(1n, 4n));
    expect(RATIONALS_MOD_INTEGERS.inverse.apply(a)).toEqual(rational(1n, 4n));
    expect(RATIONALS_MOD_INTEGERS.carrier.contains(rational(3n, 2n))).toBe(false);
    expect(RATIONALS_MOD_INTEGERS.carrier.contains(rational(-1n, 2n))).toBe(false);
  });

  it("takes an ideal as a normal subgroup of the additive group", () => {
    const quotient = quotientGroup(integerIdeal(5n));
    expect(quotient.carrier.elements).toHaveLength(5);
    expect(quotient.op.apply(3n, 4n)).toBe(2n);
    passes(quotient);
  });
});

describe("a thing that is not an ideal or not normal", () => {
  it("fails with arguments: the integers are a normal subgroup of the rationals and not an ideal", () => {
    expect(failuresOf(quotientGroup(normalSubgroupOf(RATIONAL_ADD, INTEGER_COSETS)))).toEqual([]);
    const forged = idealOf(RATIONAL_FIELD, INTEGER_COSETS);
    const failures = failuresOf(quotientRing(forged));
    const absorbing = failures.filter((report) => report.path.endsWith("/ideal"));
    expect(absorbing.map((report) => report.law).sort()).toEqual(["absorbsLeft", "absorbsRight"]);
    for (const report of absorbing) expect(report.failure).toHaveLength(2);
    const half = rational(1n, 2n);
    expect(holdsAt(forged, "absorbsRight", [rational(3n, 2n), half])).toBe(false);
    expect(holdsAt(forged, "absorbsLeft", [half, rational(3n, 2n)])).toBe(false);
    expect(holdsAt(forged, "congruentLeft", [rational(3n, 2n), half])).toBe(true);
  });

  it("fails on the set {0, 2, 3} of the integers modulo 6, with an argument", () => {
    const forged = listedIdeal(integersMod(6n), [0n, 2n, 3n]);
    const failures = failuresOf(forged);
    const member = failures.find((report) => report.law === "memberAgrees");
    expect(member?.failure).toEqual(["2"]);
    expect(forged.reduce.apply(2n)).toBe(2n);
    expect(holdsAt(forged, "memberAgrees", [4n])).toBe(false);
    expect(forged.reduce.apply(4n)).toBe(0n);
    expect(failuresOf(quotientRing(forged)).map((report) => report.law)).toContain("memberAgrees");
  });

  it("fails on a set that holds no identity: its map does not settle", () => {
    const forged = listedIdeal(integersMod(6n), [1n]);
    expect(failuresOf(forged).find((report) => report.law === "reduceSettles")?.failure).toEqual(["0"]);
  });

  it("fails on a subgroup of S3 that is not normal, with arguments", () => {
    const s3 = symmetricGroup(3);
    const swap: Permutation = [1, 0, 2];
    const forged = listedNormalSubgroup(s3, [[0, 1, 2], swap]);
    const failures = failuresOf(quotientGroup(forged));
    const congruent = failures.find((report) => report.law === "congruentLeft");
    expect(congruent?.path).toContain("/subset");
    expect(congruent?.failure).toHaveLength(2);
    // left cosets always agree on the right: the failure is exactly the normal law
    expect(failures.map((report) => report.law)).not.toContain("congruentRight");
    expect(passesNormal(s3)).toBe(true);
  });

  it("fails through the input when the quotient alone passes its own laws", () => {
    const four = extendFinite(primeField(2n), [1n, 1n, 1n]).field;
    if (four === null) throw new Error("x^2 + x + 1 is irreducible over Z/2");
    const x = [0n, 1n];
    // The set {0, x} is a subgroup. It is not an ideal: x × x is x + 1, and that value is not in the set.
    const forged = listedIdeal(four, [[], x]);
    const quotient = quotientRing(forged);
    expect(quotient.carrier.elements).toHaveLength(2);
    expect(failuresOf(alone(quotient))).toEqual([]);
    const failures = failuresOf(quotient);
    expect(failures.map((report) => report.law).sort()).toEqual(["absorbsLeft", "absorbsRight"]);
    expect(failures[0]?.path).toContain("/ideal");
    expect(failures[0]?.failure).toHaveLength(2);
  });

  it("stops at a subset with no members or a carrier with no list", () => {
    expect(() => listedIdeal(integersMod(6n), [])).toThrow(RangeError);
    expect(() => listedIdeal(RATIONAL_FIELD, [])).toThrow(TypeError);
  });
});

describe("an inexact carrier", () => {
  it("gives no quotient", () => {
    const ring = integersMod(6n);
    const carrier: Carrier<bigint> = { ...ring.carrier, exact: false };
    const inexact: Ring<bigint> = { ...ring, carrier };
    const group: Group<bigint> = { ...ring.additive, carrier };
    expect(() => quotientRing(listedIdeal(inexact, [0n]))).toThrow(TypeError);
    expect(() => quotientGroup(listedNormalSubgroup(group, [0n]))).toThrow(TypeError);
  });
});

/** This function tells that A3 is normal in S3, with the same listed method as the failure above. */
const passesNormal = (group: Group<Permutation>): boolean => failuresOf(listedNormalSubgroup(group, (group.carrier.elements ?? []).filter(isEven))).length === 0;
