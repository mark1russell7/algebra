import { NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import { random } from "@mark1russell7/rigor-generators";
import { describe, expect, it } from "vitest";
import { coefficientsIn, constantOf, degree, differentiate, divide, evaluate, fromCoefficients, gcd, key, LIMITS, monic, multiply, ONE, power, primitive, radical, scale, squareFree, subtract, sum, ZERO } from "./index.ts";
import type { Limited, Limits, Polynomial } from "./index.ts";
import { add, denseAt, euclid, LONG, mul, n, polynomialOf, pow, randomPolynomial, RUNS, sub, x, y, z } from "./testing.test-helper.ts";

function known(p: Limited | undefined): Polynomial {
  if (p === undefined || p === NO_CLAIM) throw new Error(`no polynomial: ${String(p)}`);
  return p;
}

const times = (a: Polynomial, b: Polynomial): Polynomial => known(multiply(a, b, LIMITS));
const gcdKey = (a: Polynomial, b: Polynomial): string => key(known(gcd(a, b)));
const of = polynomialOf;

describe("coefficientsIn and fromCoefficients", () => {
  it("are inverse functions, and each coefficient list is canonical", () => {
    const rnd = random(1);
    for (let i = 0; i < 200; i++) {
      const p = randomPolynomial(rnd, ["x", "y", "z"], 5, 6);
      for (const name of ["x", "y", "z", "w"]) {
        const coefficients = coefficientsIn(p, name);
        expect(fromCoefficients(coefficients, name)).toEqual(p);
        for (const c of coefficients) expect(sum([c])).toEqual(c);
      }
    }
    expect(coefficientsIn(ZERO, "x")).toEqual([]);
  });
});

describe("gcd", () => {
  it("gives the fixed results", () => {
    expect(gcdKey(of(sub(pow(x, 2), n(1))), of(sub(x, n(1))))).toBe("x - 1");
    expect(gcdKey(of(pow(add(x, y), 2)), of(sub(pow(x, 2), pow(y, 2))))).toBe("x + y");
    expect(gcdKey(of(mul(n(6), add(x, y))), of(mul(n(4), add(x, y))))).toBe("x + y");
    expect(gcdKey(of(mul(x, y)), of(mul(x, z)))).toBe("x");
    expect(gcdKey(of(mul(y, add(x, n(1)))), of(mul(y, add(x, n(2)))))).toBe("y");
    expect(gcdKey(of(mul(x, y)), of(mul(n(3), y)))).toBe("y");
    expect(gcdKey(of(mul(n(2), x)), of(n(3)))).toBe("1");
    expect(gcdKey(of(n(4)), of(n(6)))).toBe("1");
    expect(gcdKey(of(sub(pow(x, 3), n(1))), of(sub(pow(x, 2), n(1))))).toBe("x - 1");
  });

  it("states the answer for zero", () => {
    expect(gcdKey(ZERO, of(mul(n(6), x)))).toBe("x");
    expect(gcdKey(of(mul(n(-6), x)), ZERO)).toBe("x");
    expect(gcd(ZERO, ZERO)).toEqual(ZERO);
  });

  it("gives integer coefficients, a gcd of 1 of these and a positive lead", () => {
    const half = scale(of(add(x, n(1))), Q.rational(-1n, 2n));
    expect(primitive(half)).toEqual(of(add(x, n(1))));
    expect(gcdKey(half, scale(half, Q.rational(4n, 3n)))).toBe("x + 1");
    expect(key(primitive(of(add(mul(n(6), x), n(10)))))).toBe("3*x + 5");
    expect(key(monic(of(add(mul(n(6), x), n(9)))))).toBe("x + 3/2");
  });

  it("does not depend on the order, or on a constant factor", { timeout: LONG }, () => {
    const rnd = random(2);
    for (let i = 0; i < RUNS / 10; i++) {
      const a = randomPolynomial(rnd, ["x", "y"], 4, 5);
      const b = randomPolynomial(rnd, ["x", "y"], 4, 5);
      const g = known(gcd(a, b));
      expect(gcd(b, a)).toEqual(g);
      expect(gcd(scale(a, Q.rational(3n, 7n)), scale(b, Q.rational(-5n)))).toEqual(g);
    }
  });

  it.each([
    ["one variable", ["x"]],
    ["two variables", ["x", "y"]],
    ["three variables", ["x", "y", "z"]],
  ] as const)("holds a planted factor, and leaves cofactors with gcd 1, in %s", { timeout: LONG }, (_, names) => {
    const rnd = random(3 + names.length);
    for (let i = 0; i < RUNS / 10; i++) {
      const a = randomPolynomial(rnd, names, 3, 4);
      const b = randomPolynomial(rnd, names, 3, 4);
      const planted = randomPolynomial(rnd, names, 2, 3);
      const left = times(a, planted);
      const right = times(b, planted);
      const g = known(gcd(left, right));
      const cofactors = [known(divide(left, g)), known(divide(right, g))] as const;
      expect(divide(g, planted)).not.toBe(undefined);
      expect(key(known(gcd(...cofactors)))).toBe("1");
      expect(subtract(times(cofactors[0], g), left)).toEqual(ZERO);
    }
  });

  it("equals the algorithm of Euclid in one variable", { timeout: LONG }, () => {
    const rnd = random(7);
    for (let i = 0; i < RUNS / 2; i++) {
      const planted = randomPolynomial(rnd, ["x"], 3, 3);
      const a = times(randomPolynomial(rnd, ["x"], 5, 4), planted);
      const b = times(randomPolynomial(rnd, ["x"], 5, 4), planted);
      const want = euclid(denseAt(a, "x", {}), denseAt(b, "x", {}));
      expect(denseAt(monic(known(gcd(a, b))), "x", {}).map(Q.toString)).toEqual(want.map(Q.toString));
    }
  });

  it("has the degree of the gcd of Euclid at each good value of the other variable", { timeout: LONG }, () => {
    const rnd = random(8);
    for (let i = 0; i < RUNS / 10; i++) {
      const planted = randomPolynomial(rnd, ["x", "y"], 3, 3);
      const a = times(randomPolynomial(rnd, ["x", "y"], 3, 4), planted);
      const b = times(randomPolynomial(rnd, ["x", "y"], 3, 4), planted);
      const g = known(gcd(a, b));
      const wanted = Math.max(coefficientsIn(g, "x").length - 1, 0);
      // a value of y that keeps each lead in x does not make the gcd smaller, and few such values make it larger
      const leadsStay = (at: Record<string, Q.Rational>): boolean => [a, b].every((p) => Q.sign(evaluate(coefficientsIn(p, "x").at(-1) as Polynomial, at)) !== 0);
      const degrees = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n]
        .map((value) => ({ y: Q.rational(value) }))
        .filter(leadsStay)
        .map((at) => euclid(denseAt(a, "x", at), denseAt(b, "x", at)).length - 1);
      expect(degrees.length).toBeGreaterThan(2);
      expect(Math.min(...degrees)).toBe(wanted);
    }
  });

  it("stops at the limits", () => {
    const a = power(of(add(x, y, n(1))), 12, LIMITS) as Polynomial;
    const b = power(of(add(x, sub(y, n(1)))), 12, LIMITS) as Polynomial;
    expect(gcd(a, b, { ...LIMITS, maxProducts: 10 })).toBe(NO_CLAIM);
    expect(gcd(a, b, { ...LIMITS, maxTerms: 4 } satisfies Limits)).toBe(NO_CLAIM);
    expect(gcd(a, b, { ...LIMITS, maxBits: 2 })).toBe(NO_CLAIM);
  });
});

describe("divide", () => {
  it("gives the quotient, and undefined when the divisor does not divide", () => {
    expect(key(known(divide(of(sub(pow(x, 2), pow(y, 2))), of(add(x, y)))))).toBe("x - y");
    expect(key(known(divide(of(mul(n(3), x)), of(n(6)))))).toBe("1/2*x");
    expect(divide(ZERO, of(x))).toEqual(ZERO);
    expect(divide(of(add(x, n(1))), of(x))).toBeUndefined();
    expect(divide(of(n(3)), of(x))).toBeUndefined();
    expect(divide(of(y), of(x))).toBeUndefined();
    expect(divide(of(mul(x, y)), of(mul(x, x)))).toBeUndefined();
  });

  it("refuses a divisor of zero", () => {
    expect(() => divide(of(x), ZERO)).toThrow(RangeError);
  });

  it("gives a back from a × b / b", { timeout: LONG }, () => {
    const rnd = random(9);
    for (let i = 0; i < RUNS / 10; i++) {
      const a = randomPolynomial(rnd, ["x", "y", "z"], 3, 5);
      const b = randomPolynomial(rnd, ["x", "y", "z"], 3, 3);
      expect(divide(times(a, b), b)).toEqual(a);
    }
  });
});

describe("radical", () => {
  it("gives each factor one time, a factor without the first variable too", () => {
    expect(key(known(radical(of(mul(pow(x, 2), pow(add(x, n(1)), 3))))))).toBe("x^2 + x");
    expect(key(known(radical(of(mul(pow(y, 2), pow(add(x, n(1)), 3))))))).toBe("x*y + y");
    expect(key(known(radical(of(mul(n(6), pow(x, 2))))))).toBe("x");
    expect(key(known(radical(of(n(6)))))).toBe("1");
    expect(known(radical(ZERO))).toEqual(ZERO);
  });

  it("divides the polynomial, has no repeated factor, and holds each planted factor", { timeout: LONG }, () => {
    const rnd = random(10);
    for (let i = 0; i < RUNS / 10; i++) {
      const a = randomPolynomial(rnd, ["x", "y"], 2, 3);
      const b = randomPolynomial(rnd, ["x", "y"], 2, 3);
      const p = times(times(a, a), b);
      const r = known(radical(p));
      expect(divide(p, r)).not.toBe(undefined);
      expect(radical(r)).toEqual(r);
      const onceA = known(radical(a));
      if (degree(onceA) > 0) expect(divide(r, onceA)).not.toBe(undefined);
    }
  });
});

describe("squareFree", () => {
  it("gives each factor with its multiplicity", () => {
    const parts = squareFree(of(mul(pow(x, 3), pow(sub(x, n(1)), 2), add(x, n(2)), add(pow(x, 2), n(1)))), "x");
    if (parts === NO_CLAIM) throw new Error("no claim");
    expect(parts.map((p) => [key(monic(p.factor)), p.multiplicity])).toEqual([
      ["x^3 + 2*x^2 + x + 2", 1],
      ["x - 1", 2],
      ["x", 3],
    ]);
    expect(squareFree(of(n(3)), "x")).toEqual([]);
  });

  it("gives factors with no common zero, whose product is the polynomial", { timeout: LONG }, () => {
    const rnd = random(11);
    for (let i = 0; i < RUNS / 5; i++) {
      const a = randomPolynomial(rnd, ["x"], 3, 3);
      const b = randomPolynomial(rnd, ["x"], 2, 3);
      const p = times(times(a, times(a, a)), times(b, b));
      if (constantOf(p) !== undefined) continue;
      const parts = squareFree(p, "x");
      if (parts === NO_CLAIM) throw new Error("no claim");
      const whole = parts.reduce((all, part) => times(all, known(power(part.factor, part.multiplicity, LIMITS))), ONE);
      expect(primitive(whole)).toEqual(primitive(p));
      for (const part of parts) expect(key(known(gcd(part.factor, differentiate(part.factor, "x"))))).toBe("1");
      parts.forEach((s, at) => {
        for (const t of parts.slice(at + 1)) expect(key(known(gcd(s.factor, t.factor)))).toBe("1");
      });
    }
  });
});
