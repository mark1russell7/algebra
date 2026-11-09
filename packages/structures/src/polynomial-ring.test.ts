import { describe, expect, it } from "vitest";
import { random } from "@mark1russell7/rigor-generators";
import { ONE, ZERO, fromNumber } from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import {
  BOOLEAN_RING,
  INTEGER_RING,
  RATIONAL_FIELD,
  SAMPLE_DEGREE,
  checkClaims,
  conforms,
  degree,
  divideMonic,
  evaluate,
  holdsAt,
  integersMod,
  polynomial,
  polynomialIdeal,
  polynomialRing,
  primeField,
  quotientRing,
  showPolynomial,
} from "./catalog-entry.ts";
import type { AnyStructure, Carrier, CommutativeRing, Field, Polynomial, Ring } from "./catalog-entry.ts";

const passes = (structure: AnyStructure): void => {
  expect(conforms(structure)).toEqual([]);
  expect(checkClaims(structure).filter((report) => report.failure !== null)).toEqual([]);
};

const toMask = (p: Polynomial<bigint>): number => p.reduce((mask, coefficient, power) => mask | (Number(coefficient) << power), 0);

const fromMask = (mask: number): Polynomial<bigint> => {
  const bits = Array.from({ length: 8 }, (_, power) => BigInt((mask >> power) & 1));
  return polynomial(primeField(2n), bits);
};

const carryless = (a: number, b: number): number => {
  let product = 0;
  for (let power = 0; power < 8; power += 1) {
    if (((b >> power) & 1) === 1) product ^= a << power;
  }
  return product;
};

describe("the polynomials over a ring", () => {
  const cases: readonly (readonly [string, AnyStructure])[] = [
    ["the rationals", polynomialRing(RATIONAL_FIELD)],
    ["the integers", polynomialRing(INTEGER_RING)],
    ["the integers modulo 6", polynomialRing(integersMod(6n))],
    ["the integers modulo 2", polynomialRing(primeField(2n))],
    ["the trivial ring", polynomialRing(integersMod(1n))],
    ["the booleans", polynomialRing(BOOLEAN_RING)],
    ["polynomials", polynomialRing(polynomialRing(primeField(3n)))],
  ];

  it.each(cases)("over %s conform, and their claims hold", (_, structure) => {
    expect(structure.level).toBe("ring");
    passes(structure);
  });

  it("use one canonical form: a zero at the end is not a member", () => {
    const { carrier } = polynomialRing(INTEGER_RING);
    expect(carrier.contains([1n, 2n])).toBe(true);
    expect(carrier.contains([1n, 0n])).toBe(false);
    expect(carrier.contains([])).toBe(true);
    expect(carrier.equals([1n, 2n], [1n, 2n])).toBe(true);
    expect(carrier.equals([1n], [1n, 2n])).toBe(false);
  });

  it("remove the terms that cancel", () => {
    const ring = polynomialRing(INTEGER_RING);
    expect(ring.additive.op.apply([1n, 2n, 3n], [0n, 0n, -3n])).toEqual([1n, 2n]);
    expect(ring.multiplicative.op.apply([1n, 1n], [-1n, 1n])).toEqual([-1n, 0n, 1n]);
    expect(polynomialRing(integersMod(6n)).multiplicative.op.apply([2n], [3n])).toEqual([]);
  });

  it("agree with a carry-less multiplication of bit masks over the integers modulo 2, on each pair up to degree 7", () => {
    const ring = polynomialRing(primeField(2n));
    for (let a = 0; a < 256; a += 1) {
      const p = fromMask(a);
      for (let b = 0; b < 256; b += 1) {
        expect(toMask(ring.multiplicative.op.apply(p, fromMask(b)))).toBe(carryless(a, b));
      }
    }
  });

  it("evaluate as a homomorphism at each seeded point of the rationals", () => {
    const ring = polynomialRing(RATIONAL_FIELD);
    const draw = random("evaluation");
    for (let i = 0; i < 300; i += 1) {
      const [p, q] = [ring.carrier.sample(draw), ring.carrier.sample(draw)];
      const point = RATIONAL_FIELD.carrier.sample(draw);
      const value = (entry: Polynomial<Rational>): Rational => evaluate(RATIONAL_FIELD, entry, point);
      const { additive, multiplicative } = RATIONAL_FIELD;
      expect(value(ring.multiplicative.op.apply(p, q))).toEqual(multiplicative.op.apply(value(p), value(q)));
      expect(value(ring.additive.op.apply(p, q))).toEqual(additive.op.apply(value(p), value(q)));
      expect(value(ring.additive.inverse.apply(p))).toEqual(additive.inverse.apply(value(p)));
    }
  });

  it("sample up to the stated degree, with the edge values", () => {
    const { carrier } = polynomialRing(RATIONAL_FIELD);
    const draw = random("degrees");
    const degrees = new Set(Array.from({ length: 2000 }, () => degree(carrier.sample(draw))));
    expect(Math.max(...degrees)).toBe(SAMPLE_DEGREE);
    expect(degrees).toContain(-1);
  });

  it("show the highest term first", () => {
    expect(showPolynomial(INTEGER_RING, [-2n, 0n, 1n])).toBe("x^2 + -2");
    expect(showPolynomial(INTEGER_RING, [1n, 3n])).toBe("3·x + 1");
    expect(showPolynomial(INTEGER_RING, [])).toBe("0");
    const nested = polynomialRing(INTEGER_RING);
    expect(showPolynomial(nested, [[1n, 1n], [], [1n]])).toBe("x^2 + x + 1");
    expect(showPolynomial(nested, [[], [1n, 1n]])).toBe("(x + 1)·x");
  });
});

describe("the claims of a polynomial ring", () => {
  it("do not keep idempotence: the square of x + 1 over the booleans is x^2 + 1", () => {
    expect(BOOLEAN_RING.multiplicative.claims).toHaveProperty("idempotent");
    const ring = polynomialRing(BOOLEAN_RING);
    expect(ring.multiplicative.claims).not.toHaveProperty("idempotent");
    expect(holdsAt(ring.multiplicative, "idempotent", [[true, true]])).toBe(false);
    expect(ring.multiplicative.op.apply([true, true], [true, true])).toEqual([true, false, true]);
  });

  it("have commutativity only when the coefficients claim it", () => {
    const ring = integersMod(6n);
    const { commutative: _, ...claims } = ring.multiplicative.claims;
    const weaker: Ring<bigint> = { ...ring, multiplicative: { ...ring.multiplicative, claims } };
    expect(polynomialRing(weaker).multiplicative.claims).not.toHaveProperty("commutative");
    expect(polynomialRing(ring).multiplicative.claims).toHaveProperty("commutative");
  });

  it("have no zero divisors only over a field, or a ring that claims this law", () => {
    expect(polynomialRing(RATIONAL_FIELD).claims).toHaveProperty("noZeroDivisors");
    expect(polynomialRing(INTEGER_RING).claims).toHaveProperty("noZeroDivisors");
    const composite = polynomialRing(integersMod(6n));
    expect(composite.claims).not.toHaveProperty("noZeroDivisors");
    expect(holdsAt(composite, "noZeroDivisors", [[2n], [3n]])).toBe(false);
  });

  it("do not give a field: x has no inverse", () => {
    const ring = polynomialRing(RATIONAL_FIELD);
    expect(ring.level).toBe("ring");
    expect(ring).not.toHaveProperty("units");
    // @ts-expect-error the polynomials over a field are a ring, and not a field
    const notField: Field<Polynomial<Rational>> = ring;
    expect(notField).toBeDefined();
    const x = polynomial(RATIONAL_FIELD, [ZERO, ONE]);
    const draw = random("no inverse");
    for (let i = 0; i < 200; i += 1) {
      const other = ring.carrier.sample(draw);
      const product = ring.multiplicative.op.apply(x, other);
      expect(ring.carrier.equals(product, ring.multiplicative.identity.value)).toBe(false);
    }
  });

  it("state the input as a construction, and the runner tests it", () => {
    const ring = polynomialRing(INTEGER_RING);
    expect(ring.construction?.name).toBe("polynomial-ring");
    expect(ring.construction?.inputs).toHaveProperty("coefficients", INTEGER_RING);
    const reports = checkClaims(ring);
    expect(reports.some((report) => report.path === "Z[x]/coefficients/additive")).toBe(true);
  });

  it("find a forged input through the input", () => {
    const ring = integersMod(5n);
    const forged: CommutativeRing<bigint> = {
      ...ring,
      additive: { ...ring.additive, op: { ...ring.additive.op, apply: (a, b) => a - b } },
    };
    const failures = checkClaims(polynomialRing(forged)).filter((report) => report.failure !== null);
    expect(failures.some((report) => report.path === "Z/5[x]/coefficients/additive")).toBe(true);
  });

  it("refuse an inexact carrier", () => {
    const ring = integersMod(6n);
    const carrier: Carrier<bigint> = { ...ring.carrier, exact: false };
    expect(() => polynomialRing({ ...ring, carrier })).toThrow(TypeError);
    expect(() => polynomialIdeal({ ...ring, carrier }, [1n, 1n])).toThrow(TypeError);
  });
});

describe("division by a monic polynomial", () => {
  it("gives a quotient and a remainder of a lower degree", () => {
    const ring = polynomialRing(INTEGER_RING);
    const draw = random("division");
    for (let i = 0; i < 300; i += 1) {
      const p = ring.carrier.sample(draw);
      const monic = [...Array.from({ length: draw.int(0, 3) }, () => INTEGER_RING.carrier.sample(draw)), 1n];
      const { quotient, remainder } = divideMonic(INTEGER_RING, p, monic);
      expect(degree(remainder)).toBeLessThan(degree(monic));
      expect(ring.additive.op.apply(ring.multiplicative.op.apply(quotient, monic), remainder)).toEqual(p);
    }
  });

  it("refuses a divisor that is not monic", () => {
    expect(() => divideMonic(INTEGER_RING, [1n], [1n, 2n])).toThrow(RangeError);
    expect(() => divideMonic(INTEGER_RING, [1n], [])).toThrow(RangeError);
    expect(() => polynomialIdeal(INTEGER_RING, [1n, 2n])).toThrow(RangeError);
  });
});

describe("a quotient of a polynomial ring", () => {
  it("gives the Gaussian integers from the integers and x^2 + 1", () => {
    const gaussian = quotientRing(polynomialIdeal(INTEGER_RING, [1n, 0n, 1n]));
    expect(gaussian.name).toBe("Z[x]/(x^2 + 1)");
    expect(gaussian.multiplicative.op.apply([1n, 2n], [3n, 4n])).toEqual([-5n, 10n]);
    passes(gaussian);
  });

  it("keeps the zero divisors of a composite modulus, and claims no law about them", () => {
    const ring = quotientRing(polynomialIdeal(RATIONAL_FIELD, polynomial(RATIONAL_FIELD, [fromNumber(-1), ZERO, ONE])));
    expect(ring.claims).not.toHaveProperty("noZeroDivisors");
    const [left, right]: readonly Polynomial<Rational>[] = [[ONE, ONE], [fromNumber(-1), ONE]];
    expect(ring.multiplicative.op.apply(left ?? [], right ?? [])).toEqual([]);
    passes(ring);
  });

  it("works over a ring that is not a field", () => {
    const ring = quotientRing(polynomialIdeal(integersMod(4n), [1n, 1n, 1n]));
    expect(ring.carrier.elements).toHaveLength(16);
    passes(ring);
  });
});
