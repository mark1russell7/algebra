import { check, checkWorld } from "@mark1russell7/coeval";
import { EXACT, NO_CLAIM, randomComparison, randomExpression } from "@mark1russell7/expression";
import type { Document, ExactResult, Expression, InnerKind } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { random } from "@mark1russell7/rigor-generators";
import type { Random } from "@mark1russell7/rigor-generators";
import { describe, expect, it } from "vitest";
import { constantOf, evaluate as evaluatePolynomial, functions, gcd, key as polynomialKey, LIMITS, normalForm, POLYNOMIAL, RATIONAL, rationalForm, rationalMachine, simplifyRational } from "./index.ts";
import type { Limits, RationalForm, RationalFunction } from "./index.ts";
import { add, div, documentOf, eq, exactAt, le, LONG, lt, max, min, made, mul, n, neg, polynomialOf, pow, randomPolynomial, root, RUNS, sub, substitute, v, x, y } from "./testing.test-helper.ts";

const { differentiate, evaluate, fromPolynomial, inverse, key, multiply, ONE_FUNCTION, ZERO_FUNCTION, restrict, subtract: subtractFunctions, add: addFunctions, power } = functions;

const form = (doc: Document, limits?: Limits): RationalForm => made(rationalForm(doc, limits));

function functionOf(doc: Document, limits?: Limits): RationalFunction {
  const f = form(doc, limits);
  if (f.kind !== "rational") throw new Error(`no function: ${f.kind}`);
  return f.value;
}

const known = <T>(value: T | typeof NO_CLAIM | null): T => {
  if (value === NO_CLAIM || value === null) throw new Error(`no result: ${String(value)}`);
  return value as T;
};

/** The limits of the random documents: a large document gives no claim soon. */
const SMALL: Limits = { ...LIMITS, maxProducts: 4096, maxBits: 512, maxDegree: 24, maxTerms: 128 };

const KINDS: readonly InnerKind[] = ["add", "sub", "mul", "div", "neg", "pow"];

/** This function gives seeded documents of the kinds of a rational function, with small integer literals. */
function rationalDocs(seed: number, count: number = RUNS): Expression[] {
  const rnd = random(seed);
  const source = (): number => rnd.next();
  return Array.from({ length: count }, () => randomExpression(source, { maxDepth: 4, degenerate: 0, kinds: KINDS, exponents: [-2, 3], variables: ["x", "y"] }));
}

/** This function gives a seeded point of small rationals, so a zero of a small polynomial is a common point. */
function smallPoint(rnd: Random): Record<string, Rational> {
  const value = (): Rational => Q.rational(BigInt(rnd.int(-4, 4)), BigInt(rnd.pick([1, 1, 1, 2, 3])));
  return { x: value(), y: value() };
}

/** This function compares a form with the verb `exact` at a point, and it gives the kind of the agreement. */
function agreement(doc: Expression, f: RationalFunction, at: Record<string, Rational>): "value" | "none" | "open" {
  const want: ExactResult = exactAt(doc, at);
  const got = evaluate(f, at);
  if (want === NO_CLAIM) return "open";
  if (want === null) {
    if (got !== null) throw new Error(`${JSON.stringify(doc)} has no value at ${JSON.stringify(at, (_, b) => (typeof b === "bigint" ? `${b}` : b))}, and the form gives ${Q.toString(got)}`);
    return "none";
  }
  if (got === null || !Q.equals(got, want)) throw new Error(`${JSON.stringify(doc)}: exact ${Q.toString(want)}, form ${got === null ? "null" : Q.toString(got)}`);
  return "value";
}

describe("the verb rational", () => {
  it("has an evaluator for each kind, and checks each generated document", () => {
    const machine = rationalMachine();
    expect(checkWorld(machine, [RATIONAL, POLYNOMIAL, EXACT])).toEqual([]);
    const rnd = random(1);
    const source = (): number => rnd.next();
    for (let i = 0; i < 100; i++) expect(check(machine, i % 4 === 0 ? randomComparison(source) : randomExpression(source), { verb: RATIONAL })).toEqual([]);
  });

  it.each<[string, Document, string, string]>([
    ["x / x, with a hole at 0", div(x, x), "1", "x"],
    ["(x^2 - 1) / (x - 1), with a hole at 1", div(sub(pow(x, 2), n(1)), sub(x, n(1))), "x + 1", "x - 1"],
    ["0 / x", div(n(0), x), "0", "x"],
    ["0 * (1 / x)", mul(n(0), div(n(1), x)), "0", "x"],
    ["1 / x - 1 / x", sub(div(n(1), x), div(n(1), x)), "0", "x"],
    ["x^-1", pow(x, -1), "(1) / (x)", "x"],
    ["x^-2 * x^2", mul(pow(x, -2), pow(x, 2)), "1", "x"],
    ["(x + 1) / (x^2 - 1)", div(add(x, n(1)), sub(pow(x, 2), n(1))), "(1) / (x - 1)", "x^2 - 1"],
    ["(x + y)^2 / (x^2 - y^2)", div(pow(add(x, y), 2), sub(pow(x, 2), pow(y, 2))), "(x + y) / (x - y)", "x^2 - y^2"],
    ["1 / (2*x + 4), with a monic denominator", div(n(1), add(mul(n(2), x), n(4))), "(1/2) / (x + 2)", "x + 2"],
    ["1 / x^2, with a domain of no repeated factor", div(n(1), pow(x, 2)), "(1) / (x^2)", "x"],
    ["1 / x + 1 / y", add(div(n(1), x), div(n(1), y)), "(x + y) / (x*y)", "x*y"],
    ["1 / (1 / x), with the two zeros", div(n(1), div(n(1), x)), "x", "x"],
    ["(1 / x)^0, which keeps the hole", pow(div(n(1), x), 0), "1", "x"],
    ["min(x / x, 2)", min(div(x, x), n(2)), "1", "x"],
    ["max(1 / x, 1 / x + 1)", max(div(n(1), x), add(div(n(1), x), n(1))), "(x + 1) / (x)", "x"],
    ["min(x + 1 / y, x)", min(add(x, div(n(1), y)), x), "", ""],
    ["x / x < 2", lt(div(x, x), n(2)), "1", "x"],
    ["y / y <= 0", le(div(y, y), n(0)), "0", "y"],
    ["1 / x = 1 / x + 0 / y", eq(div(n(1), x), add(div(n(1), x), div(n(0), y))), "1", "x*y"],
    ["the root of 4 * x / x", root(mul(n(4), div(x, x)), 2), "2", "x"],
    ["7, with no hole", n(7), "7", "1"],
  ])("gives the form of %s", (_, doc, value, domain) => {
    const f = form(doc);
    if (value === "") return expect(f).toEqual({ kind: NO_CLAIM, error: Infinity });
    expect(f).toMatchObject({ kind: "rational", key: value, domainKey: domain, error: 0 });
  });

  it.each<[string, Document]>([
    ["1 / 0", div(n(1), n(0))],
    ["x / (x - x)", div(x, sub(x, x))],
    ["(x - x)^-2", pow(sub(x, x), -2)],
    ["the square root of -4 * x / x", root(mul(n(-4), div(x, x)), 2)],
    ["1 / (1 / 0)", div(n(1), div(n(1), n(0)))],
    ["(1 / x) + (1 / 0)", add(div(n(1), x), div(n(1), n(0)))],
    ["the root of x, added to 1 / 0", add(root(x, 2), div(n(1), n(0)))],
  ])("gives no real value for %s", (_, doc) => {
    expect(form(doc)).toEqual({ kind: "no value", error: 0 });
    expect(made(simplifyRational(doc))).toBeNull();
  });

  it.each<[string, Document]>([
    ["the square root of x^2, which is |x|", root(pow(x, 2), 2)],
    ["the cube root of x", root(x, 3)],
    ["the root of 2", root(n(2), 2)],
    ["min(x, y)", min(x, y)],
    ["x < 0", lt(x, n(0))],
    ["x = 1 / x", eq(x, div(n(1), x))],
    ["a sum with a root of x", add(root(x, 2), div(n(1), x))],
  ])("gives no claim for %s", (_, doc) => {
    expect(form(doc)).toEqual({ kind: NO_CLAIM, error: Infinity });
    expect(made(simplifyRational(doc))).toBe(NO_CLAIM);
  });

  it("agrees with the verb polynomial on each polynomial claim", { timeout: LONG }, () => {
    let compared = 0;
    for (const doc of rationalDocs(2)) {
      const p = made(normalForm(doc, SMALL));
      if (p.kind === NO_CLAIM) continue;
      const f = form(doc, SMALL);
      if (f.kind === NO_CLAIM) continue;
      expect(f.kind).toBe(p.kind === "polynomial" ? "rational" : "no value");
      if (p.kind === "polynomial" && f.kind === "rational") {
        expect(f.key).toBe(p.key);
        expect(f.domainKey).toBe("1");
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(RUNS / 10);
  });
});

describe("the canonical form", () => {
  it("is in lowest terms, with a monic denominator and a domain of no repeated factor", { timeout: LONG }, () => {
    let compared = 0;
    for (const doc of rationalDocs(3)) {
      const f = form(doc, SMALL);
      if (f.kind !== "rational") continue;
      const { numerator, denominator, domain } = f.value;
      compared += 1;
      expect(polynomialKey(known(gcd(numerator, denominator)))).toBe(numerator.terms.length === 0 ? polynomialKey(known(gcd(denominator, denominator))) : "1");
      expect(denominator.terms[0]?.coefficient).toEqual(Q.ONE);
      expect(domain.terms[0]?.coefficient).toEqual(Q.ONE);
    }
    expect(compared).toBeGreaterThan(RUNS / 4);
  });

  it("gives one key to a quotient and to its form with a planted common factor", { timeout: LONG }, () => {
    const rnd = random(4);
    for (let i = 0; i < RUNS / 5; i++) {
      const names = ["x", "y"];
      const a = documentOf(randomPolynomial(rnd, names, 3, 3));
      const b = documentOf(randomPolynomial(rnd, names, 3, 3));
      const c = documentOf(randomPolynomial(rnd, names, 2, 3));
      const plain = form(div(a, b));
      const planted = form(div(mul(a, c), mul(c, b)));
      if (plain.kind !== "rational" || planted.kind !== "rational") continue;
      expect(planted.key).toBe(plain.key);
    }
  });

  it("gives one key to each order of a sum and a product of quotients", { timeout: LONG }, () => {
    const rnd = random(5);
    for (let i = 0; i < RUNS / 5; i++) {
      const parts = [0, 1, 2].map(() => div(documentOf(randomPolynomial(rnd, ["x"], 2, 3)), documentOf(randomPolynomial(rnd, ["x"], 2, 3))));
      const [a, b, c] = parts as [Expression, Expression, Expression];
      for (const make of [add, mul]) {
        const left = form(make(a, make(b, c)));
        const right = form(make(make(c, a), b));
        if (left.kind === "rational" && right.kind === "rational") expect([right.key, right.domainKey]).toEqual([left.key, left.domainKey]);
        else expect(right.kind).toBe(left.kind);
      }
    }
  });

  it("keeps the field laws of a function and its inverse", { timeout: LONG }, () => {
    const rnd = random(6);
    for (let i = 0; i < RUNS / 5; i++) {
      const f = functionOf(div(documentOf(randomPolynomial(rnd, ["x", "y"], 2, 3)), documentOf(randomPolynomial(rnd, ["x", "y"], 2, 3))));
      if (f.numerator.terms.length === 0) continue;
      const back = known(multiply(f, known(inverse(f))));
      expect(key(back)).toBe("1");
      expect(key(known(subtractFunctions(f, f)))).toBe("0");
      expect(key(known(addFunctions(f, ZERO_FUNCTION)))).toBe(key(f));
      expect(key(known(multiply(f, ONE_FUNCTION)))).toBe(key(f));
      expect(key(known(power(known(power(f, -2)), 1)))).toBe(key(known(inverse(known(power(f, 2))))));
    }
  });
});

describe("the exact oracle", () => {
  it("agrees at seeded small points, in the value and in the points without a value", { timeout: LONG }, () => {
    const rnd = random(7);
    const counts = { value: 0, none: 0, open: 0 };
    for (const doc of rationalDocs(8)) {
      const f = form(doc, SMALL);
      if (f.kind !== "rational") continue;
      for (let i = 0; i < 4; i++) counts[agreement(doc, f.value, smallPoint(rnd))] += 1;
    }
    expect(counts.value).toBeGreaterThan(RUNS / 2);
    expect(counts.none).toBeGreaterThan(RUNS / 100);
  });

  it("agrees at rational points that no float holds", { timeout: LONG }, () => {
    const rnd = random(9);
    let compared = 0;
    for (const doc of rationalDocs(10)) {
      const f = form(doc, SMALL);
      if (f.kind !== "rational") continue;
      const at = { x: Q.rational(BigInt(rnd.int(-60, 60)), BigInt(3 + 2 * rnd.below(20))), y: Q.rational(BigInt(rnd.int(-60, 60)), BigInt(3 + 2 * rnd.below(20))) };
      if (agreement(doc, f.value, at) === "value") compared += 1;
    }
    expect(compared).toBeGreaterThan(RUNS / 5);
  });

  it("has no value at each planted hole, and the value of the reduced form beside it", { timeout: LONG }, () => {
    const rnd = random(11);
    for (let i = 0; i < RUNS / 5; i++) {
      const hole = Q.rational(BigInt(rnd.int(-5, 5)), BigInt(rnd.pick([1, 2, 4])));
      const factor = sub(x, div(n(Number(hole.n)), n(Number(hole.d))));
      const a = documentOf(randomPolynomial(rnd, ["x"], 2, 3));
      const b = documentOf(randomPolynomial(rnd, ["x"], 2, 3));
      const doc = div(mul(a, factor), mul(b, factor));
      const f = form(doc);
      if (f.kind !== "rational") continue;
      expect(exactAt(doc, { x: hole })).toBeNull();
      expect(evaluate(f.value, { x: hole })).toBeNull();
      expect(Q.sign(evaluatePolynomial(f.value.domain, { x: hole }))).toBe(0);
      const beside = Q.add(hole, Q.rational(1n, 1024n));
      if (Q.sign(evaluatePolynomial(f.value.domain, { x: beside })) !== 0) expect(agreement(doc, f.value, { x: beside })).toBe("value");
    }
  });

  it("agrees on comparisons, min and max where a claim is made", { timeout: LONG }, () => {
    const rnd = random(12);
    const source = (): number => rnd.next();
    let compared = 0;
    for (let i = 0; i < RUNS; i++) {
      const doc: Expression = randomExpression(source, { maxDepth: 3, degenerate: 0, kinds: [...KINDS, "min", "max", "root"], exponents: [-1, 2], variables: ["x", "y"] });
      const f = form(doc, SMALL);
      if (f.kind === NO_CLAIM) continue;
      const at = smallPoint(rnd);
      if (f.kind === "no value") {
        const want = exactAt(doc, at);
        if (want !== NO_CLAIM) expect(want).toBeNull();
        continue;
      }
      agreement(doc, f.value, at);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(RUNS / 10);
  });
});

describe("simplifyRational", () => {
  it("keeps a hole, as a term with the literal 0", () => {
    expect(made(simplifyRational(div(x, x)))).toEqual(add(n(1), div(n(0), x)));
    expect(made(simplifyRational(div(n(1), x)))).toEqual(div(n(1), x));
    expect(made(simplifyRational(div(add(x, x), n(4))))).toEqual(mul(n(0.5), x));
    expect(made(simplifyRational(div(n(0), sub(x, n(1)))))).toEqual(add(n(0), div(n(0), add(x, n(-1)))));
  });

  it("has the value of the document at each point, the same holes, and is idempotent", { timeout: LONG }, () => {
    const rnd = random(13);
    let compared = 0;
    for (const doc of rationalDocs(14)) {
      const simple = made(simplifyRational(doc, SMALL));
      if (simple === null || simple === NO_CLAIM) continue;
      expect(made(simplifyRational(simple))).toEqual(simple);
      const at = smallPoint(rnd);
      const [before, after] = [exactAt(doc, at), exactAt(simple, at)];
      if (before === NO_CLAIM || after === NO_CLAIM) continue;
      expect(after).toEqual(before);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(RUNS / 4);
  });
});

describe("differentiation", () => {
  const f = (doc: Document): RationalFunction => functionOf(doc);

  it("gives the derivative in lowest terms, with the domain of the function", () => {
    expect(key(known(differentiate(f(div(n(1), x)), "x")))).toBe("(-1) / (x^2)");
    expect(key(known(differentiate(f(div(add(x, n(1)), sub(x, n(1)))), "x")))).toBe("(-2) / (x^2 - 2*x + 1)");
    expect(key(known(differentiate(f(div(x, y)), "y")))).toBe("(-x) / (y^2)");
    expect(key(known(differentiate(f(div(x, y)), "z")))).toBe("0");
    expect(key(known(differentiate(f(mul(pow(x, 3), y)), "x")))).toBe("3*x^2*y");
    expect(polynomialKey(known(differentiate(f(div(x, x)), "x")).domain)).toBe("x");
  });

  const pairs = (seed: number): [RationalFunction, RationalFunction][] => {
    const rnd = random(seed);
    const one = (): RationalFunction => f(div(documentOf(randomPolynomial(rnd, ["x", "y"], 2, 3)), documentOf(randomPolynomial(rnd, ["x", "y"], 2, 3))));
    return Array.from({ length: RUNS / 10 }, () => [one(), one()]);
  };

  it("follows the sum rule and the product rule", { timeout: LONG }, () => {
    for (const [a, b] of pairs(15)) {
      const [da, db] = [known(differentiate(a, "x")), known(differentiate(b, "x"))];
      expect(key(known(differentiate(known(addFunctions(a, b)), "x")))).toBe(key(known(addFunctions(da, db))));
      const product = known(addFunctions(known(multiply(da, b)), known(multiply(a, db))));
      expect(key(known(differentiate(known(multiply(a, b)), "x")))).toBe(key(product));
    }
  });

  it("follows the quotient rule, on the inverse", { timeout: LONG }, () => {
    for (const [a] of pairs(16)) {
      if (a.numerator.terms.length === 0) continue;
      const flipped = known(inverse(a));
      const square = known(multiply(a, a));
      const want = known(multiply(known(differentiate(a, "x")), known(inverse(square))));
      expect(key(known(differentiate(flipped, "x")))).toBe(key(functions.negate(want)));
    }
  });

  it("agrees with an exact difference quotient", { timeout: LONG }, () => {
    const rnd = random(17);
    const step = Q.rational(1n, 1n << 40n);
    const limit = Q.rational(1n, 1n << 20n);
    let compared = 0;
    for (let i = 0; i < RUNS / 5; i++) {
      const g = f(div(documentOf(randomPolynomial(rnd, ["x"], 2, 3)), documentOf(randomPolynomial(rnd, ["x"], 2, 3))));
      const slope = known(differentiate(g, "x"));
      const at = Q.rational(BigInt(rnd.int(-30, 30)), 7n);
      // the point stays away from each pole, so the rest of the expansion is small
      const size = (t: Rational): Rational | null => evaluate(g, { x: t });
      const low = size(at);
      const high = size(Q.add(at, step));
      const half = size(Q.add(at, Q.div(step, Q.rational(2n))));
      const wanted = evaluate(slope, { x: at });
      if (low === null || high === null || half === null || wanted === null) continue;
      if (Q.compare(Q.abs(evaluatePolynomial(g.denominator, { x: at })), Q.rational(1n, 8n)) < 0) continue;
      // the Richardson form has an error of the order of the square of the step
      const coarse = Q.div(Q.sub(high, low), step);
      const fine = Q.div(Q.sub(half, low), Q.div(step, Q.rational(2n)));
      const estimate = Q.sub(Q.mul(Q.rational(2n), fine), coarse);
      expect(Q.compare(Q.abs(Q.sub(estimate, wanted)), limit)).toBeLessThan(0);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(RUNS / 20);
  });
});

describe("the limits", () => {
  it("gives no claim past a limit of a node, and a claim in it", () => {
    const doc = div(sub(pow(x, 8), n(1)), sub(x, n(1)));
    expect(form(doc).kind).toBe("rational");
    expect(form(doc, { ...LIMITS, maxProducts: 4 }).kind).toBe(NO_CLAIM);
    expect(form(doc, { ...LIMITS, maxTerms: 1 }).kind).toBe(NO_CLAIM);
    expect(form(pow(div(n(1), x), LIMITS.maxDegree + 1)).kind).toBe(NO_CLAIM);
    expect(form(pow(n(3), -(2 ** 40))).kind).toBe(NO_CLAIM);
    expect(form(root(n(2), 2 ** 40)).kind).toBe(NO_CLAIM);
    expect(form(root(n(-2), 2 ** 40)).kind).toBe("no value");
  });

  it("gives no claim for a coefficient past the bits", () => {
    expect(form(pow(n(1e-300), 5)).kind).toBe(NO_CLAIM);
    expect(form(pow(n(1e-300), 3)).kind).toBe("rational");
    expect(form(div(x, pow(n(1e-300), 5))).kind).toBe(NO_CLAIM);
  });

  it("keeps the record of the domain through restrict", () => {
    const f = known(restrict(fromPolynomial(polynomialOf(x)), polynomialOf(sub(y, n(1)))));
    expect(polynomialKey(f.domain)).toBe("y - 1");
    expect(evaluate(f, { x: Q.ONE, y: Q.ONE })).toBeNull();
    expect(constantOf(f.denominator)).toEqual(Q.ONE);
  });

  it("a variable of a document can be another name", () => {
    expect(form(substitute(div(x, x), { x: v("t") }))).toMatchObject({ key: "1", domainKey: "t" });
    expect(neg(x)).toEqual({ type: "neg", value: x });
  });
});
