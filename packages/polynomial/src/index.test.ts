import { corpus, orientDocument, POLYNOMIAL_FAMILIES, SEEDS } from "@algebra/expression-corpus";
import { check, checkWorld } from "@mark1russell7/coeval";
import { compileExact, DEGENERATE_CONSTANTS, EXACT, NO_CLAIM, random, randomComparison, randomExpression } from "@mark1russell7/expression";
import type { Document, Expression, InnerKind, Random } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { describe, expect, it } from "vitest";
import {
  degree,
  differentiate,
  evaluate,
  key,
  LIMITS,
  multiply,
  normalForm,
  POLYNOMIAL,
  polynomialMachine,
  simplify,
  subtract,
  sum,
  TERM_LIMIT,
  variable,
  ZERO,
} from "./index.ts";
import type { Limits, NormalForm, Polynomial, Term } from "./index.ts";

/** The count of random documents of each property. The variable `PROPERTY_RUNS` sets it. */
const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 1000);
const VARS = ["x", "y", "z"];
const LONG = 30_000 + RUNS * 20;

const n = (value: number): Expression => ({ type: "num", value });
const v = (value: string): Expression => ({ type: "var", value });
const x = v("x");
const y = v("y");
const z = v("z");
type Parts = [Expression, Expression, ...Expression[]];
const add = (...parts: Expression[]): Expression => ({ type: "add", value: parts as Parts });
const mul = (...parts: Expression[]): Expression => ({ type: "mul", value: parts as Parts });
const min = (...parts: Expression[]): Expression => ({ type: "min", value: parts as Parts });
const max = (...parts: Expression[]): Expression => ({ type: "max", value: parts as Parts });
const sub = (a: Expression, b: Expression): Expression => ({ type: "sub", value: [a, b] });
const div = (a: Expression, b: Expression): Expression => ({ type: "div", value: [a, b] });
const neg = (a: Expression): Expression => ({ type: "neg", value: a });
const pow = (base: Expression, exp: number): Expression => ({ type: "pow", value: { base, exp } });
const root = (radicand: Expression, index: number): Expression => ({ type: "root", value: { radicand, index } });
const lt = (a: Expression, b: Expression): Document => ({ type: "lt", value: [a, b] });
const le = (a: Expression, b: Expression): Document => ({ type: "le", value: [a, b] });
const eq = (a: Expression, b: Expression): Document => ({ type: "eq", value: [a, b] });

function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

const form = (doc: Document, limits?: Limits): NormalForm => made(normalForm(doc, limits));

/** This function gives the key of a document, and it fails on a document without a polynomial. */
function keyOf(doc: Document): string {
  const f = form(doc);
  if (f.kind !== "polynomial") throw new Error(`no polynomial: ${f.kind}`);
  return f.key;
}

function polynomialOf(doc: Document): Polynomial {
  const f = form(doc);
  if (f.kind !== "polynomial") throw new Error(`no polynomial: ${f.kind}`);
  return f.polynomial;
}

const POLYNOMIAL_KINDS: readonly InnerKind[] = ["add", "sub", "mul", "neg", "pow"];

/** This function gives seeded documents of the polynomial kinds. */
function polynomialDocs(seed: number, count: number = RUNS): Expression[] {
  const rnd = random(seed);
  return Array.from({ length: count }, () => randomExpression(rnd, { maxDepth: 4, degenerate: 0, kinds: POLYNOMIAL_KINDS, exponents: [0, 3] }));
}

/** This function gives seeded documents of each kind, comparisons too. */
function allDocs(seed: number, count: number = RUNS): Document[] {
  const rnd = random(seed);
  return Array.from({ length: count }, () => (rnd() < 0.2 ? randomComparison(rnd) : randomExpression(rnd)));
}

function shuffle<T>(items: readonly T[], rnd: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** This function gives another form of a polynomial document: other orders, other groups, expansions and `sub` forms. */
function rewrite(doc: Expression, rnd: Random): Expression {
  const go = (e: Expression): Expression => rewrite(e, rnd);
  switch (doc.type) {
    case "num":
    case "var":
      return doc;
    case "neg":
      return rnd() < 0.5 ? mul(n(-1), go(doc.value)) : neg(go(doc.value));
    case "sub": {
      const [a, b] = doc.value;
      return rnd() < 0.5 ? add(go(a), neg(go(b))) : sub(go(a), go(b));
    }
    case "pow": {
      const { base, exp } = doc.value;
      return exp >= 2 && rnd() < 0.5 ? mul(go(base), pow(go(base), exp - 1)) : pow(go(base), exp);
    }
    case "add":
    case "mul": {
      const make = doc.type === "add" ? add : mul;
      const parts = shuffle(doc.value.map(go), rnd);
      const [first, second] = parts as [Expression, Expression];
      if (doc.type === "mul" && parts.length === 2 && second.type === "add") return add(...second.value.map((p) => mul(first, p)));
      while (parts.length > 2 && rnd() < 0.5) {
        const [a, b, ...rest] = parts as [Expression, Expression, ...Expression[]];
        parts.splice(0, parts.length, make(a, b), ...rest);
      }
      return make(...parts);
    }
    default:
      throw new RangeError(`The kind ${doc.type} is not a polynomial kind.`);
  }
}

/** This function replaces each named variable of a document. */
function substitute(doc: Expression, at: Readonly<Record<string, Expression>>): Expression {
  const go = (e: Expression): Expression => substitute(e, at);
  switch (doc.type) {
    case "num":
      return doc;
    case "var":
      return at[doc.value] ?? doc;
    case "neg":
      return neg(go(doc.value));
    case "pow":
      return pow(go(doc.value.base), doc.value.exp);
    case "root":
      return root(go(doc.value.radicand), doc.value.index);
    default:
      return { type: doc.type, value: doc.value.map(go) } as unknown as Expression;
  }
}

/** This function gives a seeded float point. */
function floatPoint(rnd: Random): number[] {
  return VARS.map(() => {
    const t = rnd();
    if (t < 0.1) return DEGENERATE_CONSTANTS[Math.floor(rnd() * DEGENERATE_CONSTANTS.length)] as number;
    if (t < 0.5) return Math.floor(rnd() * 19) - 9;
    return (rnd() - 0.5) * 2 ** (Math.floor(rnd() * 17) - 8);
  });
}

/** This function gives a rational point whose denominators have an odd factor, so no float holds it. */
function rationalPoint(rnd: Random): Rational[] {
  return VARS.map(() => Q.rational(BigInt(Math.floor(rnd() * 121) - 60), BigInt(3 + 2 * Math.floor(rnd() * 20))));
}

const named = (values: readonly Rational[], names: readonly string[] = VARS): Record<string, Rational> =>
  Object.fromEntries(names.map((name, i) => [name, values[i] as Rational]));

const fromFloats = (values: readonly number[]): Rational[] => values.map((value) => Q.fromFloat(value));

/** This function gives a closed document of a document at a rational point: each variable is a quotient of literals. */
function closed(doc: Expression, at: readonly Rational[]): Expression {
  const quotient = (r: Rational): Expression => div(n(Number(r.n)), n(Number(r.d)));
  return substitute(doc, Object.fromEntries(VARS.map((name, i) => [name, quotient(at[i] as Rational)])));
}

describe("the verb polynomial", () => {
  it("has an evaluator for each kind, and checks each generated document", () => {
    const machine = polynomialMachine();
    expect(checkWorld(machine, [POLYNOMIAL, EXACT])).toEqual([]);
    for (const doc of allDocs(1, 100)) expect(check(machine, doc, { verb: POLYNOMIAL })).toEqual([]);
  });

  it("states the claim and its error", () => {
    const doubled = form(add(x, x));
    expect(doubled).toMatchObject({ kind: "polynomial", key: "2*x", error: 0 });
    expect(form(div(x, sub(y, y)))).toEqual({ kind: "no value", error: 0 });
    expect(form(div(x, x))).toEqual({ kind: NO_CLAIM, error: Infinity });
  });
});

describe("the canonical form", () => {
  it("gives the fixed text of a polynomial", () => {
    expect(keyOf(pow(add(x, y), 2))).toBe("x^2 + 2*x*y + y^2");
    expect(keyOf(sub(x, x))).toBe("0");
    expect(keyOf(n(7))).toBe("7");
    expect(keyOf(mul(div(n(1), n(3)), x))).toBe("1/3*x");
    expect(keyOf(sub(mul(y, x), add(pow(y, 3), n(1))))).toBe("-y^3 + x*y - 1");
    expect(keyOf(neg(x))).toBe("-x");
    // a literal is the exact value of its float, so 0.1 is not 1/10
    expect(keyOf(n(0.1))).toBe(Q.toString(Q.fromFloat(0.1)));
    // the order of the terms: the degree, then the larger exponent of the first variable
    expect(keyOf(add(z, y, x, n(1), mul(y, z), pow(z, 2), mul(x, z), pow(y, 2), mul(x, y), pow(x, 2)))).toBe(
      "x^2 + x*y + x*z + y^2 + y*z + z^2 + x + y + z + 1",
    );
  });

  it("gives one key to the commutative and associative forms", () => {
    expect(keyOf(add(x, y, z))).toBe(keyOf(add(z, add(y, x))));
    expect(keyOf(mul(x, y, z))).toBe(keyOf(mul(mul(z, y), x)));
    expect(keyOf(mul(add(x, y), sub(x, y)))).toBe(keyOf(sub(pow(x, 2), pow(y, 2))));
    expect(keyOf(pow(x, 0))).toBe("1");
    expect(keyOf(pow(sub(x, x), 0))).toBe("1");
  });

  it("gives one key to each seeded rewrite of a document", { timeout: LONG }, () => {
    const rnd = random(11);
    let compared = 0;
    for (const doc of polynomialDocs(12)) {
      const a = form(doc);
      const b = form(rewrite(doc, rnd));
      if (a.kind !== "polynomial" || b.kind !== "polynomial") continue;
      compared += 1;
      if (a.key !== b.key) expect.fail(`${a.key} and ${b.key} differ for ${JSON.stringify(doc)}`);
    }
    expect(compared).toBeGreaterThanOrEqual(Math.min(500, RUNS * 0.8));
  });

  it("gives the key 0 to p - p, and two keys are equal only when the difference is 0", { timeout: LONG }, () => {
    const docs = polynomialDocs(13);
    for (const doc of docs) expect(keyOf(sub(doc, doc))).toBe("0");
    const rnd = random(14);
    let different = 0;
    for (let i = 0; i + 1 < docs.length; i += 2) {
      const a = docs[i] as Expression;
      const b = docs[i + 1] as Expression;
      const equal = keyOf(a) === keyOf(b);
      expect(keyOf(sub(a, b)) === "0").toBe(equal);
      if (equal) continue;
      // two different polynomials differ at nearly each rational point
      different += 1;
      const [p, q] = [polynomialOf(a), polynomialOf(b)];
      const differs = [0, 1, 2, 3].some(() => {
        const at = named(rationalPoint(rnd));
        return !Q.equals(evaluate(p, at), evaluate(q, at));
      });
      expect(differs).toBe(true);
    }
    expect(different).toBeGreaterThan(0);
  });

  it("is idempotent: the simplified document has the same form and simplifies to itself", { timeout: LONG }, () => {
    for (const doc of polynomialDocs(15)) {
      const simple = made(simplify(doc)) as Expression;
      expect(keyOf(simple)).toBe(keyOf(doc));
      expect(made(simplify(simple))).toEqual(simple);
    }
  });

  it("writes a coefficient that has no float as a document with its exact value", () => {
    const third = made(simplify(mul(div(n(1), n(3)), x))) as Expression;
    expect(third).toEqual(mul(div(n(1), n(3)), x));
    const large = made(simplify(add(n(2 ** 53), n(1), div(mul(n(2 ** 60), n(2 ** 60)), n(3))))) as Expression;
    const value = made(compileExact(large)).evaluate([]);
    expect(value).toEqual(Q.add(Q.rational(2n ** 53n + 1n), Q.rational(2n ** 120n, 3n)));
    expect(made(simplify(sub(x, x)))).toEqual(n(0));
    expect(made(simplify(neg(mul(n(2 ** 200 + 2 ** 180), add(n(1 / 3), n(1))))))).not.toBe(NO_CLAIM);
  });
});

describe("the exact oracle", () => {
  /** This function compares the normal form and its document with the verb `exact` at seeded float points. */
  function comparedAtFloats(doc: Document, rnd: Random): number {
    const f = form(doc);
    if (f.kind !== "polynomial") return 0;
    const exact = made(compileExact(doc, { variables: VARS }));
    const simple = made(compileExact(made(simplify(doc)) as Expression, { variables: VARS }));
    let compared = 0;
    for (let i = 0; i < 4; i++) {
      const point = floatPoint(rnd);
      const want = exact.evaluate(point);
      expect(want).not.toBeNull();
      if (want === NO_CLAIM || want === null) continue;
      expect(Q.equals(evaluate(f.polynomial, named(fromFloats(point))), want)).toBe(true);
      const again = simple.evaluate(point);
      if (again !== NO_CLAIM) expect(again).toEqual(want);
      compared += 1;
    }
    return compared;
  }

  it("agrees at seeded floats on the polynomial documents", { timeout: LONG }, () => {
    const rnd = random(21);
    const compared = polynomialDocs(22).reduce((sum, doc) => sum + comparedAtFloats(doc, rnd), 0);
    expect(compared).toBeGreaterThanOrEqual(Math.min(1000, RUNS * 1.5));
  });

  it("agrees at rational points that no float holds", { timeout: LONG }, () => {
    const rnd = random(23);
    let compared = 0;
    for (const doc of polynomialDocs(24)) {
      const f = form(doc);
      if (f.kind !== "polynomial") continue;
      const at = rationalPoint(rnd);
      const want = made(compileExact(closed(doc, at))).evaluate([]);
      if (want === NO_CLAIM || want === null) continue;
      if (!Q.equals(evaluate(f.polynomial, named(at)), want)) expect.fail(`${f.key} at ${at.map(Q.toString).join(", ")}`);
      compared += 1;
    }
    expect(compared).toBeGreaterThanOrEqual(Math.min(500, RUNS * 0.8));
  });

  it("agrees on each case of the polynomial families of the corpus", { timeout: LONG }, () => {
    let compared = 0;
    for (const c of corpus(SEEDS, { points: 8 })) {
      if (!POLYNOMIAL_FAMILIES.includes(c.family)) continue;
      const p = polynomialOf(c.document);
      const exact = made(compileExact(c.document, { variables: [...c.variables] }));
      for (const point of c.points) {
        const want = exact.evaluate(point);
        if (want === NO_CLAIM || want === null) continue;
        expect(Q.equals(evaluate(p, named(fromFloats(point), c.variables)), want)).toBe(true);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(300);
  });

  it("gives the 6 terms of the orientation determinant", () => {
    const p = polynomialOf(orientDocument());
    expect(p.terms).toHaveLength(6);
    expect(key(p)).toBe("ax*by - ax*cy - ay*bx + ay*cx + bx*cy - by*cx");
    expect(degree(p)).toBe(2);
  });
});

describe("no fake answer", () => {
  it.each<[string, Document]>([
    ["x / x, which has no value at 0", div(x, x)],
    ["(x^2 - 1) / (x - 1), which has no value at 1", div(sub(pow(x, 2), n(1)), sub(x, n(1)))],
    ["0 / x", div(n(0), x)],
    ["0 * (1 / x), which has no value at 0", mul(n(0), div(n(1), x))],
    ["1 / x - 1 / x", sub(div(n(1), x), div(n(1), x))],
    ["x^-1", pow(x, -1)],
    ["x^-2 * x^2", mul(pow(x, -2), pow(x, 2))],
    ["the square root of x^2, which is |x|", root(pow(x, 2), 2)],
    ["the cube root of x", root(x, 3)],
    ["the root of 2", root(n(2), 2)],
    ["min(x, y)", min(x, y)],
    ["max(x, 0)", max(x, n(0))],
    ["min(x, x + 1, 5), with parts in two classes", min(x, add(x, n(1)), n(5))],
    ["min(x, 5, x + 1), the same parts in another order", min(x, n(5), add(x, n(1)))],
    ["x < 0", lt(x, n(0))],
    ["x <= y", le(x, y)],
    ["x = 1", eq(x, n(1))],
  ])("gives no claim for %s", (_, doc) => {
    expect(form(doc)).toEqual({ kind: NO_CLAIM, error: Infinity });
    expect(made(simplify(doc))).toBe(NO_CLAIM);
  });

  it.each<[string, Document]>([
    ["1 / 0", div(n(1), n(0))],
    ["x / (x - x)", div(x, sub(x, x))],
    ["(x - x)^-2", pow(sub(x, x), -2)],
    ["the square root of -4", root(n(-4), 2)],
    ["the square root of x - x - 1", root(sub(sub(x, x), n(1)), 2)],
    ["0 * (1 / 0), because a part has no value", mul(n(0), div(n(1), n(0)))],
    ["(1 / x) + (1 / 0), because a part has no value and the other makes no claim", add(div(n(1), x), div(n(1), n(0)))],
    ["(1 / 0)^0, because a part has no value", pow(div(n(1), n(0)), 0)],
  ])("gives no real value for %s", (_, doc) => {
    expect(form(doc)).toEqual({ kind: "no value", error: 0 });
    expect(made(simplify(doc))).toBeNull();
  });

  it("gives a claim where the parts fix the value", () => {
    expect(keyOf(div(mul(n(4), x), n(8)))).toBe("1/2*x");
    expect(keyOf(pow(n(2), -3))).toBe("1/8");
    expect(keyOf(pow(n(0), 0))).toBe("1");
    expect(keyOf(root(n(27 / 8), 3))).toBe("3/2");
    expect(keyOf(root(n(-8), 3))).toBe("-2");
    expect(keyOf(root(sub(add(x, n(9)), x), 2))).toBe("3");
    expect(keyOf(min(n(2), n(1), n(3)))).toBe("1");
    expect(keyOf(max(n(2), n(1), n(3)))).toBe("3");
    expect(keyOf(min(x, add(x, n(1))))).toBe("x");
    expect(keyOf(max(add(x, n(1)), x, sub(x, n(1))))).toBe("x + 1");
    expect(keyOf(min(mul(n(2), x), add(x, x)))).toBe("2*x");
    expect(keyOf(lt(x, add(x, n(1))))).toBe("1");
    expect(keyOf(le(add(x, n(1)), x))).toBe("0");
    expect(keyOf(eq(mul(n(2), x), add(x, x)))).toBe("1");
    expect(keyOf(eq(x, add(x, n(1))))).toBe("0");
  });

  it("agrees with each exact claim on documents of each kind, with the rule of a claim of no value", { timeout: LONG }, () => {
    const rnd = random(31);
    const counts: Record<NormalForm["kind"], number> = { polynomial: 0, "no value": 0, [NO_CLAIM]: 0 };
    for (const doc of allDocs(32)) {
      const f = form(doc);
      counts[f.kind] += 1;
      if (f.kind === NO_CLAIM) continue;
      const exact = made(compileExact(doc, { variables: VARS }));
      for (let i = 0; i < 4; i++) {
        const point = floatPoint(rnd);
        const want = exact.evaluate(point);
        if (want === NO_CLAIM) continue;
        if (f.kind === "no value") expect(want).toBeNull();
        else if (want === null) expect.fail(`${JSON.stringify(doc)} has no value at ${point.join(", ")}, but a polynomial was claimed`);
        else expect(Q.equals(evaluate(f.polynomial, named(fromFloats(point))), want)).toBe(true);
      }
    }
    expect(counts.polynomial).toBeGreaterThan(0);
    expect(counts["no value"]).toBeGreaterThan(0);
    expect(counts[NO_CLAIM]).toBeGreaterThan(0);
  });
});

describe("the limits", () => {
  const eight = add(...["a", "b", "c", "d", "e", "f", "g", "h"].map(v));

  it("gives no claim for an expansion past the term limit", () => {
    // the 7th power has 3432 terms, and the 8th has 6435
    expect(TERM_LIMIT).toBeGreaterThan(3432);
    expect(polynomialOf(pow(eight, 7)).terms).toHaveLength(3432);
    expect(form(pow(eight, 8))).toEqual({ kind: NO_CLAIM, error: Infinity });
    expect(form(mul(pow(eight, 7), eight)).kind).toBe(NO_CLAIM);
  });

  it("gives a polynomial at the limit, and no claim past it", () => {
    const limits: Limits = { ...LIMITS, maxTerms: 3 };
    expect(form(pow(add(x, y), 2), limits).kind).toBe("polynomial");
    expect(form(pow(add(x, y), 3), limits).kind).toBe(NO_CLAIM);
    expect(form(add(x, y, z), limits).kind).toBe("polynomial");
    expect(form(add(x, y, z, n(1)), limits).kind).toBe(NO_CLAIM);
    // the limit of a sum counts the terms after cancellation
    expect(form(add(x, y, z, n(1), neg(n(1))), limits).kind).toBe("polynomial");
    // the limit of a product counts the monomials before cancellation
    expect(form(mul(add(x, y), sub(x, y)), { ...LIMITS, maxTerms: 2 }).kind).toBe(NO_CLAIM);
    expect(form(mul(add(x, y), sub(x, y)), limits).kind).toBe("polynomial");
  });

  it("stops at the limit of the products, in each order of the factors", () => {
    const limits: Limits = { ...LIMITS, maxProducts: 8 };
    const [a, b] = [polynomialOf(add(x, y, z)), polynomialOf(add(v("a"), v("b"), v("c")))];
    expect(multiply(a, b, limits)).toBe(NO_CLAIM);
    expect(multiply(b, a, limits)).toBe(NO_CLAIM);
    expect(multiply(a, b, { ...limits, maxProducts: 9 })).toEqual(multiply(b, a, { ...limits, maxProducts: 9 }));
    expect(form(pow(add(x, y), 4), limits).kind).toBe(NO_CLAIM);
    expect(form(pow(add(x, y), 4), { ...limits, maxProducts: 18 }).kind).toBe("polynomial");
  });

  it("stops at the limits of the degree and of the bits", () => {
    expect(keyOf(pow(x, LIMITS.maxDegree))).toBe(`x^${LIMITS.maxDegree}`);
    expect(form(pow(x, LIMITS.maxDegree + 1)).kind).toBe(NO_CLAIM);
    expect(form(pow(pow(x, 100), 100)).kind).toBe(NO_CLAIM);
    expect(form(pow(n(3), 2 ** 40)).kind).toBe(NO_CLAIM);
    expect(form(pow(n(3), -(2 ** 40))).kind).toBe(NO_CLAIM);
    expect(form(root(n(2), 2 ** 40)).kind).toBe(NO_CLAIM);
    expect(form(root(n(-2), 2 ** 40)).kind).toBe("no value");
    expect(form(pow(n(1e-300), 5)).kind).toBe(NO_CLAIM);
    expect(form(pow(n(1e-300), 3)).kind).toBe("polynomial");
    expect(form(pow(mul(n(1e-300), x), 5)).kind).toBe(NO_CLAIM);
  });
});

describe("differentiation", () => {
  it("gives the derivative of each term", () => {
    const p = polynomialOf(add(mul(pow(x, 3), y), mul(n(2), x), n(7)));
    expect(key(differentiate(p, "x"))).toBe("3*x^2*y + 2");
    expect(key(differentiate(p, "y"))).toBe("x^3");
    expect(differentiate(p, "z")).toEqual(ZERO);
    expect(differentiate(ZERO, "x")).toEqual(ZERO);
    expect(differentiate(variable("x"), "x").terms).toHaveLength(1);
  });

  it("equals the coefficient of h in p(x + h), the definition of the derivative", { timeout: LONG }, () => {
    for (const doc of polynomialDocs(41)) {
      const shifted = polynomialOf(substitute(doc, { x: add(x, v("h")) }));
      const linear: Term[] = shifted.terms.flatMap((t) => {
        const h = t.powers.find((q) => q.variable === "h");
        return h?.exponent === 1 ? [{ coefficient: t.coefficient, powers: t.powers.filter((q) => q !== h) }] : [];
      });
      expect(key(sum(linear.map((t) => ({ terms: [t] }))))).toBe(key(differentiate(polynomialOf(doc), "x")));
    }
  });

  it("follows the product rule", { timeout: LONG }, () => {
    const docs = polynomialDocs(42);
    for (let i = 0; i + 1 < docs.length; i += 2) {
      const f = polynomialOf(docs[i] as Expression);
      const g = polynomialOf(docs[i + 1] as Expression);
      const product = multiply(f, g, LIMITS);
      const left = multiply(differentiate(f, "x"), g, LIMITS);
      const right = multiply(f, differentiate(g, "x"), LIMITS);
      if (product === NO_CLAIM || left === NO_CLAIM || right === NO_CLAIM) continue;
      expect(subtract(differentiate(product, "x"), sum([left, right]))).toEqual(ZERO);
    }
  });
});
