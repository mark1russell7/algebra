import { NO_CLAIM } from "@mark1russell7/expression";
import type { Document, Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { random } from "@mark1russell7/rigor-generators";
import { describe, expect, it } from "vitest";
import { evaluate, functions, LIMITS, multiply, ONE, scale, SOLVE_LIMITS, solveEquation, solveFunction, solveLinear, sum, TOLERANCE, ZERO } from "./index.ts";
import type { Assignment, LinearSolution, Polynomial, Root, Solution, SolveOptions } from "./index.ts";
import { add, div, documentOf, eq, le, LONG, lt, made, mul, n, polynomialOf, pow, q, randomPolynomial, root, RUNS, sub, v, x, y } from "./testing.test-helper.ts";

const solved = (doc: Document, options?: SolveOptions): Solution => made(solveEquation(doc, options));

function rootsOf(doc: Document, options?: SolveOptions): readonly Root[] {
  const s = solved(doc, options);
  if (s.kind !== "roots") throw new Error(`no roots: ${s.kind}`);
  return s.roots;
}

function solvePolynomial(p: Polynomial, options?: SolveOptions): readonly Root[] {
  const s = solveFunction(functions.fromPolynomial(p), options);
  if (s.kind !== "roots") throw new Error(`no roots: ${s.kind}${s.kind === NO_CLAIM ? ` ${s.reason}` : ""}`);
  return s.roots;
}

const r = (a: bigint | number, b: bigint | number = 1): Rational => Q.rational(BigInt(a), BigInt(b));
const text = (roots: readonly Root[]): string[] =>
  roots.map((t) => (t.kind === "exact" ? `${Q.toString(t.value)}^${t.multiplicity}` : `(${Q.toNumber(t.lower).toFixed(6)}, ${Q.toNumber(t.upper).toFixed(6)})^${t.multiplicity}`));

const product = (factors: readonly Polynomial[]): Polynomial =>
  factors.reduce((all, f) => {
    const next = multiply(all, f, LIMITS);
    if (next === NO_CLAIM) throw new Error("past a limit");
    return next;
  }, ONE);

/** This function checks the proofs that a list of roots gives for a polynomial: the order, the widths and the signs. */
function checkRoots(p: Polynomial, roots: readonly Root[], tolerance: Rational = TOLERANCE): void {
  let last: Rational | undefined;
  for (const t of roots) {
    if (t.kind === "exact") {
      expect(Q.sign(evaluate(p, { x: t.value }))).toBe(0);
      expect(t.error).toEqual(Q.ZERO);
      if (last !== undefined) expect(Q.compare(last, t.value)).toBeLessThan(0);
      last = t.value;
      continue;
    }
    expect(Q.compare(t.lower, t.upper)).toBeLessThan(0);
    expect(t.error).toEqual(Q.sub(t.upper, t.lower));
    expect(Q.compare(t.error, tolerance)).toBeLessThanOrEqual(0);
    const low = Q.sign(evaluate(p, { x: t.lower }));
    const high = Q.sign(evaluate(p, { x: t.upper }));
    // a root of even multiplicity has one sign at each end of its interval
    if (t.multiplicity % 2 === 1) expect(low * high).toBe(-1);
    else expect(low * high).toBe(1);
    if (last !== undefined) expect(Q.compare(last, t.lower)).toBeLessThanOrEqual(0);
    last = t.upper;
  }
}

describe("one equation in one variable", () => {
  it.each<[string, Document, string[]]>([
    ["a linear equation", sub(mul(n(2), x), n(1)), ["1/2^1"]],
    ["a = b", eq(mul(n(3), x), add(x, n(1))), ["1/2^1"]],
    ["x^2 - 2, with irrational roots", sub(pow(x, 2), n(2)), ["(-1.414214, -1.414214)^1", "(1.414214, 1.414214)^1"]],
    ["(x - 1)^2 * (x + 2)", mul(pow(sub(x, n(1)), 2), add(x, n(2))), ["-2^1", "1^2"]],
    ["x^2 + 1, with no real root", add(pow(x, 2), n(1)), []],
    ["2 * x^2 - 3 * x + 1", add(mul(n(2), pow(x, 2)), mul(n(-3), x), n(1)), ["1/2^1", "1^1"]],
    ["x^3, with a root at a bisection point", pow(x, 3), ["0^3"]],
    ["(x^2 - 2)^2, an irrational root of multiplicity 2", pow(sub(pow(x, 2), n(2)), 2), ["(-1.414214, -1.414214)^2", "(1.414214, 1.414214)^2"]],
    ["x^5 - x - 1, with no solution by radicals", sub(sub(pow(x, 5), x), n(1)), ["(1.167304, 1.167304)^1"]],
    ["1 = 0", eq(n(1), n(0)), []],
    ["7", n(7), []],
    ["a document with no value", div(n(1), n(0)), []],
  ])("solves %s", (_, doc, want) => {
    expect(text(rootsOf(doc))).toEqual(want);
  });

  it("states a hole and a pole: a zero of the domain is not a solution", () => {
    expect(text(rootsOf(div(sub(pow(x, 2), n(1)), sub(x, n(1)))))).toEqual(["-1^1"]);
    expect(text(rootsOf(div(mul(x, x), x)))).toEqual([]);
    expect(text(rootsOf(div(n(1), x)))).toEqual([]);
    expect(text(rootsOf(eq(div(n(1), x), n(2))))).toEqual(["1/2^1"]);
    expect(text(rootsOf(mul(sub(pow(x, 2), n(2)), div(sub(x, n(1)), sub(x, n(1))))))).toHaveLength(2);
  });

  it("states an equation that each number solves", () => {
    // x - x is the zero polynomial, and the normal form keeps no variable of it
    expect(solved(eq(x, x))).toEqual({ kind: "all", variable: null, excluded: [], error: Q.ZERO });
    expect(solved(eq(n(0), n(0)))).toEqual({ kind: "all", variable: null, excluded: [], error: Q.ZERO });
    const holes = solved(sub(div(x, x), n(1)));
    expect(holes.kind === "all" ? text(holes.excluded) : holes).toEqual(["0^1"]);
    const irrational = solved(sub(div(sub(pow(x, 2), n(2)), sub(pow(x, 2), n(2))), n(1)));
    expect(irrational.kind === "all" ? irrational.excluded.map((t) => t.kind) : irrational).toEqual(["interval", "interval"]);
  });

  it("gives no claim with a reason, and an error of coeval for an inequality", () => {
    expect(solved(sub(x, y))).toMatchObject({ kind: NO_CLAIM, error: Infinity, reason: "The equation has more than one variable." });
    expect(solved(root(x, 2))).toMatchObject({ kind: NO_CLAIM, reason: "The verb rational gives no claim." });
    expect(solveEquation(lt(x, n(1))).ok).toBe(false);
    expect(solveEquation(le(x, n(1))).ok).toBe(false);
  });

  it("takes each literal as its exact value, so 0.1 * x = 0.3 has the root of the two floats", () => {
    const [only] = rootsOf(eq(mul(n(0.1), x), n(0.3)));
    if (only?.kind !== "exact") throw new Error("no exact root");
    expect(only.value).toEqual(Q.div(Q.fromFloat(0.3), Q.fromFloat(0.1)));
  });

  it("narrows to the tolerance, and refuses a tolerance of 0", () => {
    const tolerance = r(1, 1024);
    const [low, high] = rootsOf(sub(pow(x, 2), n(3)), { tolerance });
    if (low?.kind !== "interval" || high?.kind !== "interval") throw new Error("no intervals");
    expect(Q.compare(low.error, tolerance)).toBeLessThanOrEqual(0);
    expect(() => solved(sub(pow(x, 2), n(3)), { tolerance: Q.ZERO })).toThrow(RangeError);
  });

  it("separates two near roots, and solves a very large leading coefficient", () => {
    const near = sum([{ terms: [{ coefficient: r(1, 3), powers: [] }] }]);
    const gap = r(1, 2n ** 80n);
    const first = sub(x, q(r(1, 3)));
    const a = polynomialOf(first);
    const b = sum([a, scale(ONE, Q.neg(gap))]);
    expect(near.terms).toHaveLength(1);
    const roots = solvePolynomial(product([a, b]));
    expect(roots.map((t) => (t.kind === "exact" ? t.value : null))).toEqual([r(1, 3), Q.add(r(1, 3), gap)]);
    const large = sum([scale(polynomialOf(x), r(2n ** 200n)), scale(ONE, r(-1))]);
    expect(solvePolynomial(large).map((t) => (t.kind === "exact" ? t.value : null))).toEqual([r(1, 2n ** 200n)]);
  });

  it("solves the polynomial of Wilkinson", () => {
    const factors = Array.from({ length: 20 }, (_, i) => polynomialOf(sub(x, n(i + 1))));
    expect(text(solvePolynomial(product(factors)))).toEqual(factors.map((_, i) => `${i + 1}^1`));
  });
});

describe("planted roots", () => {
  /** This function gives one planted case: rational roots, square roots of numbers that are not squares, and pairs with no real root. */
  function planted(seed: number): { readonly p: Polynomial; readonly rational: readonly (readonly [Rational, number])[]; readonly squares: readonly bigint[] } {
    const rnd = random(seed);
    const values = new Map<string, readonly [Rational, number]>();
    for (let i = rnd.int(0, 4); i > 0; i--) {
      const value = r(rnd.int(-40, 40), rnd.pick([1, 2, 3, 5, 7, 8]));
      values.set(Q.toString(value), [value, rnd.int(1, 3)]);
    }
    const rational = [...values.values()];
    const squares = [...new Set(Array.from({ length: rnd.int(0, 3) }, () => BigInt(rnd.pick([2, 3, 5, 6, 7, 10, 11, 13, 15, 17]))))];
    const linear = rational.flatMap(([value, multiplicity]) => {
      const factor = sum([scale(polynomialOf(x), r(value.d)), scale(ONE, r(-value.n))]);
      return Array.from({ length: multiplicity }, () => factor);
    });
    const quadratic = squares.map((k) => sum([polynomialOf(pow(x, 2)), scale(ONE, r(-k))]));
    const complex = Array.from({ length: rnd.int(0, 2) }, () => sum([polynomialOf(pow(sub(x, n(rnd.int(-3, 3))), 2)), scale(ONE, r(rnd.int(1, 9)))]));
    return { p: scale(product([...linear, ...quadratic, ...complex, ONE]), r(rnd.int(1, 12), rnd.int(1, 12))), rational, squares };
  }

  it("gives each planted root one time, by exact substitution", { timeout: LONG }, () => {
    let intervals = 0;
    let exact = 0;
    for (let seed = 0; seed < RUNS / 5; seed++) {
      const { p, rational, squares } = planted(seed);
      if (p.terms.length <= 1 && (p.terms[0]?.powers.length ?? 0) === 0) continue;
      const roots = solvePolynomial(p);
      checkRoots(p, roots);
      expect(roots).toHaveLength(rational.length + 2 * squares.length);
      for (const [value, multiplicity] of rational) {
        const found = roots.filter((t) => t.kind === "exact" && Q.equals(t.value, value));
        expect(found).toHaveLength(1);
        expect(found[0]?.multiplicity).toBe(multiplicity);
        exact += 1;
      }
      for (const k of squares) {
        // each of +sqrt(k) and -sqrt(k) is in one interval: the squares of its ends are on two sides of k
        for (const side of [1, -1]) {
          const found = roots.filter((t) => {
            if (t.kind !== "interval" || Q.sign(t.lower) !== side || Q.sign(t.upper) !== side) return false;
            const [a, b] = [Q.mul(t.lower, t.lower), Q.mul(t.upper, t.upper)];
            return Q.compare(a, r(k)) * Q.compare(b, r(k)) < 0;
          });
          expect(found).toHaveLength(1);
          intervals += 1;
        }
      }
    }
    expect(exact).toBeGreaterThan(RUNS / 20);
    expect(intervals).toBeGreaterThan(RUNS / 20);
  });

  it("gives the parity of the degree and stays under the rule of signs of Descartes", { timeout: LONG }, () => {
    const rnd = random(5);
    const changes = (signs: readonly number[]): number => signs.filter((s, i) => i > 0 && s !== signs[i - 1]).length;
    for (let i = 0; i < RUNS / 5; i++) {
      const p = randomPolynomial(rnd, ["x"], 9, 6);
      const degree = Math.max(0, ...p.terms.flatMap((t) => t.powers.map((a) => a.exponent)));
      if (degree === 0) continue;
      const roots = solvePolynomial(p);
      checkRoots(p, roots);
      const count = roots.reduce((all, t) => all + t.multiplicity, 0);
      expect((degree - count) % 2).toBe(0);
      const order = p.terms.map((t) => ({ exponent: t.powers[0]?.exponent ?? 0, sign: Q.sign(t.coefficient) })).sort((a, b) => a.exponent - b.exponent);
      const lowest = order[0]?.exponent ?? 0;
      const positive = changes(order.map((t) => t.sign));
      const negative = changes(order.map((t) => (t.exponent % 2 === 0 ? t.sign : -t.sign)));
      expect(count - lowest).toBeLessThanOrEqual(positive + negative);
    }
  });

  it("finds each sign change of a fine grid in a root interval", { timeout: LONG }, () => {
    const rnd = random(6);
    for (let i = 0; i < RUNS / 10; i++) {
      const p = randomPolynomial(rnd, ["x"], 7, 5);
      if (p.terms.every((t) => t.powers.length === 0)) continue;
      const roots = solvePolynomial(p);
      let last = 0;
      let lastAt = r(0);
      for (let k = -200; k <= 200; k++) {
        const at = r(k, 16);
        const s = Q.sign(evaluate(p, { x: at }));
        if (s === 0) {
          expect(roots.some((t) => t.kind === "exact" && Q.equals(t.value, at))).toBe(true);
          continue;
        }
        if (last !== 0 && s !== last) {
          const from = lastAt;
          const inside = roots.some((t) => (t.kind === "exact" ? Q.compare(from, t.value) < 0 && Q.compare(t.value, at) < 0 : Q.compare(from, t.upper) < 0 && Q.compare(t.lower, at) < 0));
          expect(inside).toBe(true);
        }
        last = s;
        lastAt = at;
      }
    }
  });
});

describe("the limits of a solution", () => {
  const p = polynomialOf(sub(pow(x, 12), n(2)));

  it("gives no claim and no partial list", () => {
    expect(solveFunction(functions.fromPolynomial(p), { limits: { ...SOLVE_LIMITS, maxProducts: 50 } })).toMatchObject({ kind: NO_CLAIM, error: Infinity });
    expect(solveFunction(functions.fromPolynomial(p), { limits: { ...SOLVE_LIMITS, maxDegree: 11 } })).toMatchObject({ kind: NO_CLAIM, reason: "The degree is past the limit." });
    // the chain of p stays under the bound of the bits, and the chain of a dense polynomial does not
    const dense = polynomialOf(add(pow(x, 12), mul(n(3), pow(x, 5)), mul(n(-7), x), n(5)));
    expect(solveFunction(functions.fromPolynomial(dense)).kind).toBe("roots");
    expect(solveFunction(functions.fromPolynomial(dense), { limits: { ...SOLVE_LIMITS, maxBits: 1 } })).toMatchObject({ kind: NO_CLAIM });
    expect(solvePolynomial(p)).toHaveLength(2);
  });

  it("solves a degree of 64 with dense integer coefficients in the default budget", () => {
    const rnd = random(1);
    const dense = sum(Array.from({ length: 65 }, (_, i) => scale(polynomialOf(pow(x, i)), r(rnd.int(-1000, 1000) || 1))));
    const s = solveFunction(functions.fromPolynomial(dense));
    expect(s.kind).toBe("roots");
    if (s.kind === "roots") checkRoots(dense, s.roots);
  });
});

describe("a linear system", () => {
  const system = (equations: readonly Document[], variables: readonly string[]): LinearSolution => made(solveLinear(equations, variables));

  /** This function checks an assignment by exact substitution in a list of rows `a1, ..., an, b`. */
  function satisfies(rows: readonly (readonly Rational[])[], names: readonly string[], values: Assignment, homogeneous = false): boolean {
    return rows.every((row) => {
      const left = names.reduce((all, name, i) => Q.add(all, Q.mul(row[i] as Rational, values[name] as Rational)), Q.ZERO);
      return Q.equals(left, homogeneous ? Q.ZERO : (row[names.length] as Rational));
    });
  }

  const equationOf = (row: readonly Rational[], names: readonly string[]): Document => {
    const terms: Expression[] = names.map((name, i) => mul(q(row[i] as Rational), v(name)));
    return eq(terms.length === 1 ? (terms[0] as Expression) : add(...terms), q(row[names.length] as Rational));
  };

  const names = ["a", "b", "c", "d"];
  const coefficient = (rnd: ReturnType<typeof random>): Rational => r(rnd.int(-9, 9), rnd.int(1, 6));

  it("gives the fixed results", () => {
    expect(system([eq(add(x, y), n(3)), eq(sub(x, y), n(1))], ["x", "y"])).toEqual({ kind: "unique", values: { x: r(2), y: r(1) }, error: 0 });
    expect(system([eq(add(x, y), n(3)), eq(add(x, y), n(4))], ["x", "y"])).toEqual({ kind: "none", error: 0 });
    expect(system([div(n(1), n(0))], ["x"])).toEqual({ kind: "none", error: 0 });
    expect(system([eq(add(x, y), n(3)), eq(mul(n(2), add(x, y)), n(6))], ["x", "y"])).toEqual({ kind: "family", particular: { x: r(3), y: r(0) }, directions: [{ x: r(-1), y: r(1) }], error: 0 });
    expect(system([], ["x"])).toEqual({ kind: "family", particular: { x: r(0) }, directions: [{ x: r(1) }], error: 0 });
    expect(system([eq(mul(n(1 / 3), x), n(1))], ["x"]).kind).toBe("unique");
  });

  it("gives no claim for each equation that is not linear in the variables", () => {
    expect(system([sub(pow(x, 2), n(1))], ["x"])).toMatchObject({ kind: NO_CLAIM, error: Infinity });
    expect(system([sub(mul(x, y), n(1))], ["x", "y"]).kind).toBe(NO_CLAIM);
    expect(system([sub(x, y)], ["x"]).kind).toBe(NO_CLAIM);
    expect(system([div(x, x)], ["x"]).kind).toBe(NO_CLAIM);
    expect(system([root(x, 2)], ["x"]).kind).toBe(NO_CLAIM);
    expect(solveLinear([lt(x, n(1))], ["x"]).ok).toBe(false);
    expect(() => solveLinear([], ["x", "x"])).toThrow(RangeError);
    expect(system([eq(x, n(1))], ["x"]).kind).toBe("unique");
    expect(made(solveLinear([x, y], ["x", "y"], { ...LIMITS, maxProducts: 1 })).kind).toBe(NO_CLAIM);
  });

  it("gives a planted solution, and each solution satisfies each equation", { timeout: LONG }, () => {
    const rnd = random(21);
    let unique = 0;
    for (let i = 0; i < RUNS / 5; i++) {
      const count = rnd.int(1, 4);
      const used = names.slice(0, count);
      const planted = used.map(() => coefficient(rnd));
      const rows = Array.from({ length: count + rnd.int(0, 2) }, () => {
        const row = used.map(() => coefficient(rnd));
        row.push(row.reduce((all, c, at) => Q.add(all, Q.mul(c, planted[at] as Rational)), Q.ZERO));
        return row;
      });
      const s = system(rows.map((row) => equationOf(row, used)), used);
      if (s.kind === "unique") {
        unique += 1;
        expect(used.map((name) => s.values[name])).toEqual(planted);
        expect(satisfies(rows, used, s.values)).toBe(true);
      } else if (s.kind === "family") {
        expect(satisfies(rows, used, s.particular)).toBe(true);
        for (const direction of s.directions) expect(satisfies(rows, used, direction, true)).toBe(true);
      } else expect.fail(`a system with a planted solution gives ${s.kind}`);
    }
    expect(unique).toBeGreaterThan(RUNS / 10);
  });

  it("gives a family for a planted singular system, and none for a planted conflict", { timeout: LONG }, () => {
    const rnd = random(22);
    for (let i = 0; i < RUNS / 5; i++) {
      const used = names.slice(0, 3);
      const planted = used.map(() => coefficient(rnd));
      const base = [0, 1].map(() => {
        const row = used.map(() => coefficient(rnd));
        row.push(row.reduce((all, c, at) => Q.add(all, Q.mul(c, planted[at] as Rational)), Q.ZERO));
        return row;
      });
      const [first, second] = base as [Rational[], Rational[]];
      const third = first.map((c, at) => Q.add(Q.mul(c, r(2)), Q.mul(second[at] as Rational, r(-3))));
      const rows = [first, second, third];
      const s = system(rows.map((row) => equationOf(row, used)), used);
      if (s.kind !== "family") expect.fail(`a singular system gives ${s.kind}`);
      const t = r(rnd.int(-5, 5), 3);
      const moved = Object.fromEntries(used.map((name) => [name, s.directions.reduce((all, d) => Q.add(all, Q.mul(t, d[name] as Rational)), s.particular[name] as Rational)]));
      expect(satisfies(rows, used, moved)).toBe(true);
      const conflict = [...third.slice(0, 3), Q.add(third[3] as Rational, Q.ONE)];
      expect(system([...rows.slice(0, 2), conflict].map((row) => equationOf(row, used)), used).kind).toBe("none");
    }
  });
});

describe("a document of a polynomial", () => {
  it("has the roots of its polynomial, when the document is a sum of literals", () => {
    const p = product([polynomialOf(sub(x, n(2))), polynomialOf(add(x, n(3)))]);
    expect(text(rootsOf(documentOf(p)))).toEqual(["-3^1", "2^1"]);
    expect(solved(documentOf(ZERO)).kind).toBe("all");
  });
});
