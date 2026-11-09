import { describe, expect, it } from "vitest";
import { ONE, ZERO, fromNumber, rational } from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import {
  RATIONAL_FIELD,
  ROOT_TEST_LIMIT,
  SEARCH_LIMIT,
  checkClaims,
  coefficientLists,
  conforms,
  extendFinite,
  extendRationals,
  holdsAt,
  integersMod,
  polynomial,
  polynomialRing,
  primeField,
} from "./catalog-entry.ts";
import type { AnyStructure, Carrier, Field, Polynomial, RootExtension } from "./catalog-entry.ts";

const passes = (structure: AnyStructure): void => {
  expect(conforms(structure)).toEqual([]);
  expect(checkClaims(structure).filter((report) => report.failure !== null)).toEqual([]);
};

const fieldOf = <T>(extension: RootExtension<T>): Field<Polynomial<T>> => {
  if (extension.field === null) throw new Error(`no field: ${extension.evidence.note}`);
  return extension.field;
};

const rationals = (...values: readonly number[]): Polynomial<Rational> => polynomial(RATIONAL_FIELD, values.map(fromNumber));

const mobius = (n: number): number => {
  let [rest, sign] = [n, 1];
  for (let p = 2; p <= rest; p += 1) {
    if (rest % p !== 0) continue;
    rest /= p;
    if (rest % p === 0) return 0;
    sign = -sign;
  }
  return sign;
};

/** This function gives the count of monic irreducible polynomials of degree `n` over a field of `q` elements, by the formula of Gauss. */
const gaussCount = (q: number, n: number): number => {
  const divisors = Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
  return divisors.reduce((total, d) => total + mobius(d) * q ** (n / d), 0) / n;
};

describe("trial division over a finite field", () => {
  const cases = [
    [2n, 1],
    [2n, 2],
    [2n, 3],
    [2n, 4],
    [2n, 5],
    [2n, 6],
    [3n, 1],
    [3n, 2],
    [3n, 3],
    [3n, 4],
  ] as const;

  it.each(cases)("over Z/%s at degree %s calls as many polynomials irreducible as the formula of Gauss", (p, n) => {
    const field = primeField(p);
    const monics = coefficientLists(field.carrier.elements ?? [], n).map((low) => [...low, 1n]);
    const irreducible = monics.filter((modulus) => extendFinite(field, modulus).evidence.verdict === "irreducible");
    expect(irreducible).toHaveLength(gaussCount(Number(p), n));
  });

  it("states the verdict as evidence on the construction", () => {
    const { field, ring, evidence } = extendFinite(primeField(2n), [1n, 1n, 1n]);
    expect(evidence).toMatchObject({ verdict: "irreducible", method: "trial-division" });
    expect(field?.construction?.evidence).toEqual(evidence);
    expect(ring.construction?.name).toBe("root-extension");
    expect(Object.keys(ring.construction?.inputs ?? {})).toEqual(["base", "ideal"]);
  });

  it("gives no verdict past the limit of the search", () => {
    const large = [1n, ...Array.from({ length: 39 }, () => 0n), 1n];
    const { field, evidence } = extendFinite(primeField(2n), large);
    expect(field).toBeNull();
    expect(evidence).toMatchObject({ verdict: "unknown", method: "none" });
    expect(evidence.note).toContain(`${SEARCH_LIMIT}`);
  });

  it("makes the polynomial monic", () => {
    const { field, evidence } = extendFinite(primeField(3n), [2n, 0n, 2n]);
    expect(field?.name).toBe("Z/3[x]/(x^2 + 1)");
    expect(evidence.verdict).toBe("irreducible");
  });

  it("needs a field with a list", () => {
    expect(() => extendFinite(RATIONAL_FIELD, rationals(-2, 0, 1))).toThrow(TypeError);
  });
});

describe("a finite field from a root", () => {
  it("gives the field of 4 elements, with each inverse examined", () => {
    const four = fieldOf(extendFinite(primeField(2n), [1n, 1n, 1n]));
    expect(four.carrier.elements).toHaveLength(4);
    passes(four);
    const reports = checkClaims(four);
    expect(reports.find((report) => report.law === "leftInverse" && report.path.endsWith("/units"))).toMatchObject({ exhaustive: true, cases: 3 });
    expect(reports.find((report) => report.law === "associative" && report.path.endsWith("/additive"))).toMatchObject({ exhaustive: true, cases: 64 });
    expect(four.multiplicative.op.apply([0n, 1n], [0n, 1n])).toEqual([1n, 1n]);
  });

  it("gives the field of 16 elements in two ways", () => {
    const direct = fieldOf(extendFinite(primeField(2n), [1n, 1n, 0n, 0n, 1n]));
    expect(direct.carrier.elements).toHaveLength(16);
    passes(direct);
    const four = fieldOf(extendFinite(primeField(2n), [1n, 1n, 1n]));
    const tower = fieldOf(extendFinite(four, [[0n, 1n], [1n], [1n]]));
    expect(tower.carrier.elements).toHaveLength(16);
    expect(tower.units.carrier.elements).toHaveLength(15);
    passes(tower);
  });

  it("gives the field of 9 elements, and it agrees with the complex multiplication over Z/3", () => {
    const nine = fieldOf(extendFinite(primeField(3n), [1n, 0n, 1n]));
    passes(nine);
    const coefficients = [0n, 1n, 2n];
    const canonical = (a: bigint, b: bigint): Polynomial<bigint> => polynomial(primeField(3n), [((a % 3n) + 3n) % 3n, ((b % 3n) + 3n) % 3n]);
    for (const [a, b, c, d] of coefficientLists(coefficients, 4) as readonly (readonly [bigint, bigint, bigint, bigint])[]) {
      expect(nine.multiplicative.op.apply(canonical(a, b), canonical(c, d))).toEqual(canonical(a * c - b * d, a * d + b * c));
    }
  });

  it("stays a ring over a base with no field: the base must be a field by type", () => {
    // @ts-expect-error the integers modulo 6 are a ring, and not a field
    expect(() => extendFinite(integersMod(6n), [1n, 0n, 1n])).toThrow();
  });
});

describe("the rationals with a root", () => {
  it("gives a field for x^2 - 2 by the rational root test", () => {
    const extension = extendRationals(rationals(-2, 0, 1));
    expect(extension.evidence).toMatchObject({ verdict: "irreducible", method: "rational-root" });
    const field = fieldOf(extension);
    passes(field);
    const x = polynomial(RATIONAL_FIELD, [ZERO, ONE]);
    expect(field.multiplicative.op.apply(x, x)).toEqual([fromNumber(2)]);
    // (x + 1) × (x - 1) = x^2 - 1 = 1
    expect(field.units.inverse.apply([ONE, ONE])).toEqual([fromNumber(-1), ONE]);
  });

  it("gives a field at degree 3, and for a polynomial that is not monic", () => {
    passes(fieldOf(extendRationals(rationals(-2, 0, 0, 1))));
    const half = extendRationals(rationals(-1, 0, 2));
    expect(fieldOf(half).name).toBe("Q[x]/(x^2 + -1/2)");
    expect(fieldOf(extendRationals(polynomial(RATIONAL_FIELD, [rational(-1n, 3n), ZERO, rational(1n, 2n)]))).level).toBe("field");
  });

  it("gives the base at degree 1", () => {
    const extension = extendRationals(rationals(-3, 1));
    expect(extension.evidence).toMatchObject({ verdict: "irreducible", method: "degree-one" });
    expect(fieldOf(extension).carrier.contains([fromNumber(3)])).toBe(true);
    expect(fieldOf(extension).carrier.contains([ZERO, ONE])).toBe(false);
  });

  it("gives a field at degree 4 only with an Eisenstein prime that the function examines", { timeout: 60_000 }, () => {
    const f = rationals(-2, 0, 0, 0, 1);
    expect(extendRationals(f).evidence).toMatchObject({ verdict: "unknown", method: "none" });
    expect(extendRationals(f).field).toBeNull();
    const proved = extendRationals(f, 2n);
    expect(proved.evidence).toMatchObject({ verdict: "irreducible", method: "eisenstein" });
    passes(fieldOf(proved));
    for (const wrong of [3n, 4n, 1n, 2n ** 33n]) expect(extendRationals(f, wrong).field).toBeNull();
    // x^4 - 4 fails the criterion at 2: the last coefficient is a multiple of 4
    expect(extendRationals(rationals(-4, 0, 0, 0, 1), 2n).field).toBeNull();
  });

  it("uses a rational root after a false prime at a low degree", () => {
    expect(extendRationals(rationals(-2, 0, 1), 3n).evidence).toMatchObject({ verdict: "irreducible", method: "rational-root" });
  });
});

describe("a polynomial that is not irreducible", () => {
  const cases: readonly (readonly [string, RootExtension<unknown>])[] = [
    ["x^2 - 1 over Q", extendRationals(rationals(-1, 0, 1)) as RootExtension<unknown>],
    ["x^3 over Q", extendRationals(rationals(0, 0, 0, 1)) as RootExtension<unknown>],
    ["2x^2 - 1/2 over Q, with the root 1/2", extendRationals(polynomial(RATIONAL_FIELD, [rational(-1n, 2n), ZERO, fromNumber(2)])) as RootExtension<unknown>],
    ["x^4 - 1 over Q, at a degree with no proof of irreducibility", extendRationals(rationals(-1, 0, 0, 0, 1)) as RootExtension<unknown>],
    ["x^2 + 1 over Z/2", extendFinite(primeField(2n), [1n, 0n, 1n]) as RootExtension<unknown>],
    ["x^4 + x^2 + 1 over Z/2, with no root", extendFinite(primeField(2n), [1n, 0n, 1n, 0n, 1n]) as RootExtension<unknown>],
  ];

  it.each(cases)("%s gives a ring with a refutation that the runner replays, and no field", (_, extension) => {
    expect(extension.evidence.verdict).toBe("reducible");
    expect(extension.field).toBeNull();
    const { ring } = extension;
    expect(ring.level).toBe("ring");
    expect(ring).not.toHaveProperty("units");
    expect(ring.claims).not.toHaveProperty("nontrivial");
    expect(ring.claims).not.toHaveProperty("noZeroDivisors");
    const [refutation] = ring.refuted ?? [];
    expect(refutation?.law).toBe("noZeroDivisors");
    expect(holdsAt(ring, "noZeroDivisors", refutation?.arguments ?? [])).toBe(false);
    for (const value of refutation?.arguments ?? []) expect(ring.carrier.contains(value)).toBe(true);
    passes(ring);
  });

  it("gives no field for x^4 + 4, which has no rational root and is reducible", () => {
    const f = rationals(4, 0, 0, 0, 1);
    const { evidence, field, ring } = extendRationals(f);
    expect(evidence).toMatchObject({ verdict: "unknown", method: "none" });
    expect(field).toBeNull();
    expect(ring.refuted).toBeUndefined();
    const [left, right] = [rationals(2, 2, 1), rationals(2, -2, 1)];
    expect(polynomialRing(RATIONAL_FIELD).multiplicative.op.apply(left, right)).toEqual(f);
    expect(holdsAt(ring, "noZeroDivisors", [left, right])).toBe(false);
  });

  it("gives no verdict when the outer coefficients pass the limit of the root test", () => {
    const large = polynomial(RATIONAL_FIELD, [rational(-(ROOT_TEST_LIMIT + 1n)), ZERO, ONE]);
    const { field, evidence } = extendRationals(large);
    expect(field).toBeNull();
    expect(evidence.verdict).toBe("unknown");
  });

  it("refuses a modulus with no root", () => {
    expect(() => extendRationals([])).toThrow(RangeError);
    expect(() => extendRationals(rationals(3))).toThrow(RangeError);
    expect(() => extendFinite(primeField(2n), [1n])).toThrow(RangeError);
  });
});

describe("an inexact carrier", () => {
  it("gives no extension", () => {
    const field = primeField(5n);
    const carrier: Carrier<bigint> = { ...field.carrier, exact: false };
    expect(() => extendFinite({ ...field, carrier }, [2n, 0n, 1n])).toThrow(TypeError);
  });
});
