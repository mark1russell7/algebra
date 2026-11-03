import { check, checkWorld } from "@mark1russell7/coeval";
import * as Q from "@mark1russell7/rational";
import { median } from "@mark1russell7/rigor-statistics";
import type { Rational } from "@mark1russell7/rational";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compileFloat,
  DEGENERATE_CONSTANTS,
  type Document,
  type Expression,
  expressionMachine,
  FLOAT,
  type FloatFunction,
  type FloatResult,
  random,
  randomComparison,
  randomExpression,
  type Random,
  SUMMARY,
} from "./index.ts";

/** The count of random documents of each property. CI sets it. The default is 1000. */
const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 1000);
/** The count of random points of each document. */
const POINTS = 4;
const VARS = ["x", "y", "z"];
/** The time limit of a property test, in milliseconds. The exact oracle is slow on a large corpus. */
const LONG = 30_000 + RUNS * 60;

// ---------------------------------------------------------------------------------------------------------------
// The exact oracle: an enclosure of the exact real value with rational ends. A root-free document gives a point.
// A root gives an interval of width 2^-PREC around the real root. "none": no real value. "unknown": the enclosure
// cannot tell (a divisor interval with zero inside, an even root of an interval with negative points).
// ---------------------------------------------------------------------------------------------------------------

interface Enc {
  readonly lo: Rational;
  readonly hi: Rational;
}
type Oracle = Enc | "none" | "unknown" | "large";

/** The oracle gives up on a rational with more bits than this: a deep power of a tiny constant has 10^5 bits or more. */
const LIMIT = 1n << 6000n;
const small = (r: Rational): boolean => (r.n < 0n ? -r.n : r.n) < LIMIT && r.d < LIMIT;

const PREC = 1200;
const point = (r: Rational): Enc => ({ lo: r, hi: r });
const isPoint = (e: Enc): boolean => Q.equals(e.lo, e.hi);
const minR = (a: Rational, b: Rational): Rational => (Q.compare(a, b) <= 0 ? a : b);
const maxR = (a: Rational, b: Rational): Rational => (Q.compare(a, b) >= 0 ? a : b);
const hull = (xs: readonly Rational[]): Enc => ({ lo: xs.reduce(minR), hi: xs.reduce(maxR) });
const containsZero = (e: Enc): boolean => Q.sign(e.lo) <= 0 && Q.sign(e.hi) >= 0;

/** The integer k-th root of n >= 0, rounded down (Newton on bigint). */
function iroot(n: bigint, k: number): bigint {
  if (n < 2n) return n;
  const K = BigInt(k);
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / k));
  for (;;) {
    const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
    if (y >= x) return x;
    x = y;
  }
}

/** Rational bounds of the k-th root of r >= 0: lo <= root(r) <= hi, with hi - lo <= 2^-PREC. */
function rootEnc(r: Rational, k: number): Enc {
  const scale = 1n << BigInt(PREC * k);
  const m = iroot((r.n * scale) / r.d, k);
  const den = 1n << BigInt(PREC);
  const lo = Q.rational(m, den);
  return Q.equals(Q.pow(lo, k), r) ? point(lo) : { lo, hi: Q.rational(m + 1n, den) };
}

function signedRoot(r: Rational, k: number): Enc {
  if (Q.sign(r) >= 0) return rootEnc(r, k);
  const e = rootEnc(Q.neg(r), k);
  return { lo: Q.neg(e.hi), hi: Q.neg(e.lo) };
}

function powEnc(e: Enc, n: number): Oracle {
  if (n === 0) return point(Q.ONE);
  if (n < 0) {
    if (containsZero(e)) return isPoint(e) ? "none" : "unknown";
    const p = powEnc(e, -n) as Enc;
    return hull([Q.inverse(p.lo), Q.inverse(p.hi)]);
  }
  const ends = [Q.pow(e.lo, n), Q.pow(e.hi, n)];
  if (n % 2 === 0 && containsZero(e)) return { lo: Q.ZERO, hi: ends.reduce(maxR) };
  return hull(ends);
}

function oracle(doc: Document, at: Readonly<Record<string, number>>): Oracle {
  const v = oracleOf(doc, at);
  return typeof v === "string" || (small(v.lo) && small(v.hi)) ? v : "large";
}

function oracleOf(doc: Document, at: Readonly<Record<string, number>>): Oracle {
  const many = (xs: readonly Expression[]): Enc[] | "none" | "unknown" | "large" => {
    const out: Enc[] = [];
    let unknown: "unknown" | "large" | undefined;
    for (const x of xs) {
      const v = oracle(x, at);
      if (v === "none") return "none";
      if (v === "unknown" || v === "large") unknown = unknown === "large" ? "large" : v;
      else out.push(v);
    }
    return unknown ?? out;
  };
  switch (doc.type) {
    case "num":
      return point(Q.fromFloat(doc.value));
    case "var": {
      const v = at[doc.value] as number;
      return Number.isFinite(v) ? point(Q.fromFloat(v)) : "none";
    }
    case "neg": {
      const v = oracle(doc.value, at);
      return typeof v === "string" ? v : { lo: Q.neg(v.hi), hi: Q.neg(v.lo) };
    }
    case "pow": {
      const v = oracle(doc.value.base, at);
      return typeof v === "string" ? v : powEnc(v, doc.value.exp);
    }
    case "root": {
      const v = oracle(doc.value.radicand, at);
      if (typeof v === "string") return v;
      const k = doc.value.index;
      if (k % 2 === 0) {
        if (Q.sign(v.hi) < 0) return "none";
        if (Q.sign(v.lo) < 0) return "unknown";
      }
      return { lo: signedRoot(v.lo, k).lo, hi: signedRoot(v.hi, k).hi };
    }
    default: {
      const vs = many(doc.value);
      if (typeof vs === "string") return vs;
      const [a, b] = vs as [Enc, Enc];
      switch (doc.type) {
        case "add":
          return vs.reduce((x, y) => ({ lo: Q.add(x.lo, y.lo), hi: Q.add(x.hi, y.hi) }));
        case "sub":
          return { lo: Q.sub(a.lo, b.hi), hi: Q.sub(a.hi, b.lo) };
        case "mul":
          return vs.reduce((x, y) => hull([Q.mul(x.lo, y.lo), Q.mul(x.lo, y.hi), Q.mul(x.hi, y.lo), Q.mul(x.hi, y.hi)]));
        case "div":
          if (containsZero(b)) return isPoint(b) ? "none" : "unknown";
          return hull([Q.div(a.lo, b.lo), Q.div(a.lo, b.hi), Q.div(a.hi, b.lo), Q.div(a.hi, b.hi)]);
        case "min":
          return vs.reduce((x, y) => ({ lo: minR(x.lo, y.lo), hi: minR(x.hi, y.hi) }));
        case "max":
          return vs.reduce((x, y) => ({ lo: maxR(x.lo, y.lo), hi: maxR(x.hi, y.hi) }));
        case "lt":
          if (Q.compare(a.hi, b.lo) < 0) return point(Q.ONE);
          if (Q.compare(a.lo, b.hi) >= 0) return point(Q.ZERO);
          return "unknown";
        case "le":
          if (Q.compare(a.hi, b.lo) <= 0) return point(Q.ONE);
          if (Q.compare(a.lo, b.hi) > 0) return point(Q.ZERO);
          return "unknown";
        case "eq":
          if (isPoint(a) && isPoint(b)) return point(Q.equals(a.lo, b.lo) ? Q.ONE : Q.ZERO);
          if (Q.compare(a.hi, b.lo) < 0 || Q.compare(b.hi, a.lo) < 0) return point(Q.ZERO);
          return "unknown";
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// A direct float evaluation: a structural recursion with the same operations in the same order, with no coeval.
// ---------------------------------------------------------------------------------------------------------------

function powDirect(b: number, exp: number): number {
  const n = Math.abs(exp);
  if (n === 0) return 1;
  let r = 1;
  let first = true;
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) {
      r = first ? b : r * b;
      first = false;
    }
    if (k > 1) b = b * b;
  }
  return exp > 0 ? r : 1 / r;
}

function rootDirect(r: number, k: number): number {
  if (k === 2) return Math.sqrt(r);
  const f = (m: number): number => (k === 3 ? Math.cbrt(m) : Math.pow(m, 1 / k));
  return k % 2 === 1 && r < 0 ? -f(-r) : f(r);
}

function direct(doc: Document, at: Readonly<Record<string, number>>): number {
  switch (doc.type) {
    case "num":
      return doc.value;
    case "var":
      return at[doc.value] as number;
    case "neg":
      return -direct(doc.value, at);
    case "pow":
      return powDirect(direct(doc.value.base, at), doc.value.exp);
    case "root":
      return rootDirect(direct(doc.value.radicand, at), doc.value.index);
    default: {
      const vs = doc.value.map((d) => direct(d, at));
      const [a, b] = vs as [number, number];
      switch (doc.type) {
        case "add":
          return vs.reduce((x, y) => x + y);
        case "sub":
          return a - b;
        case "mul":
          return vs.reduce((x, y) => x * y);
        case "div":
          return a / b;
        case "min":
          return vs.reduce((x, y) => Math.min(x, y));
        case "max":
          return vs.reduce((x, y) => Math.max(x, y));
        case "lt":
          return a < b ? 1 : 0;
        case "le":
          return a <= b ? 1 : 0;
        case "eq":
          return a === b ? 1 : 0;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The corpus.
// ---------------------------------------------------------------------------------------------------------------

function docs(seed: number, n = RUNS): Document[] {
  const rnd = random(seed);
  return Array.from({ length: n }, () => (rnd() < 0.2 ? randomComparison(rnd) : randomExpression(rnd)));
}

function randomPoint(rnd: Random): Record<string, number> {
  const value = (): number => {
    const t = rnd();
    if (t < 0.25) return DEGENERATE_CONSTANTS[Math.floor(rnd() * DEGENERATE_CONSTANTS.length)] as number;
    if (t < 0.6) return Math.floor(rnd() * 19) - 9;
    return (rnd() - 0.5) * 2 ** (Math.floor(rnd() * 17) - 8);
  };
  return Object.fromEntries(VARS.map((v) => [v, value()]));
}

function compiled(doc: Document): FloatFunction {
  const r = compileFloat(doc, { variables: VARS });
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

const call = (f: FloatFunction, at: Readonly<Record<string, number>>): FloatResult => f.evaluate(VARS.map((v) => at[v] as number));

const n = (x: string): Expression => ({ type: "var", value: x });
const c = (v: number): Expression => ({ type: "num", value: v });

describe("the verb float", () => {
  it("has an evaluator for the verbs summary and float of each kind", () => {
    expect(checkWorld(expressionMachine, [SUMMARY, FLOAT])).toEqual([]);
  });

  it("checks each generated document with no issue", () => {
    for (const doc of docs(11, Math.min(RUNS, 300))) expect(check(expressionMachine, doc, { verb: FLOAT })).toEqual([]);
  });

  it("orders the variables, and refuses an order without a free variable", () => {
    const doc: Expression = { type: "sub", value: [n("y"), n("x")] };
    const f = compileFloat(doc);
    expect(f.ok && f.value.variables).toEqual(["x", "y"]);
    expect(f.ok && f.value.evaluate([1, 5]).value).toBe(4);
    const g = compileFloat(doc, { variables: ["y", "x"] });
    expect(g.ok && g.value.evaluate([1, 5]).value).toBe(-4);
    const h = compileFloat(doc, { variables: ["x"] });
    expect(!h.ok && h.error.code).toBe("#NAME?");
    expect(() => (f.ok ? f.value.evaluate([1]) : undefined)).toThrow(RangeError);
  });
});

describe("the bound of the float evaluator", () => {
  it("contains |value - exact| at each point of the corpus, with the exact value of @mark1russell7/rational", () => {
    const rnd = random(12);
    const ratios: number[] = [];
    let cases = 0;
    let finite = 0;
    let unknown = 0;
    let large = 0;
    let exactZero = 0;
    for (const doc of docs(13)) {
      const f = compiled(doc);
      for (let i = 0; i < POINTS; i++) {
        const at = randomPoint(rnd);
        const got = call(f, at);
        const want = oracle(doc, at);
        cases++;
        expect(got.error >= 0, JSON.stringify({ doc, at, got })).toBe(true);
        if (want === "unknown" || want === "large") {
          if (want === "large") large++;
          else unknown++;
          continue;
        }
        if (want === "none") {
          expect(got.error, JSON.stringify({ doc, at, got })).toBe(Infinity);
          continue;
        }
        if (!(got.error < Infinity)) continue;
        finite++;
        expect(Number.isFinite(got.value), JSON.stringify({ doc, at, got })).toBe(true);
        const v = Q.fromFloat(got.value);
        const e = Q.fromFloat(got.error);
        const inside = Q.compare(Q.sub(v, e), want.lo) <= 0 && Q.compare(want.hi, Q.add(v, e)) <= 0;
        expect(inside, JSON.stringify({ doc, at, got, lo: Q.toNumber(want.lo), hi: Q.toNumber(want.hi) })).toBe(true);
        const comparison = doc.type === "lt" || doc.type === "le" || doc.type === "eq";
        if (!comparison && isPoint(want)) {
          const actual = Q.toNumber(Q.abs(Q.sub(v, want.lo)));
          if (actual > 0) ratios.push(got.error / actual);
          else exactZero++;
        }
      }
    }
    const report = { cases, finite, unknown, large, exactZero, measured: ratios.length, medianRatio: median(ratios) };
    console.log(`float bound: ${JSON.stringify(report)}`);
    expect(finite).toBeGreaterThan(cases / 4);
    // The bound is not absurd: in the median case it is within a factor of 1000 of the real error.
    expect(report.medianRatio).toBeLessThan(1000);
  }, LONG);

  it("gives the value of a direct float evaluation at each point", () => {
    const rnd = random(14);
    for (const doc of docs(15)) {
      const f = compiled(doc);
      for (let i = 0; i < POINTS; i++) {
        const at = randomPoint(rnd);
        expect(Object.is(call(f, at).value, direct(doc, at)), JSON.stringify({ doc, at })).toBe(true);
      }
    }
  }, LONG);

  it.each<[string, Document, Record<string, number>, (r: FloatResult) => boolean]>([
    ["a literal is exact", c(0.1), {}, (r) => r.value === 0.1 && r.error === 0],
    ["0.1 + 0.2 has a small bound", { type: "add", value: [c(0.1), c(0.2)] }, {}, (r) => r.error > 0 && r.error < 1e-16],
    ["a quotient by x - x has no claim", { type: "div", value: [c(1), { type: "sub", value: [n("x"), n("x")] }] }, { x: 3 }, (r) => r.error === Infinity],
    ["an even root of a negative value has no claim", { type: "root", value: { radicand: n("x"), index: 2 } }, { x: -1 }, (r) => r.error === Infinity],
    ["a cube root of -8 is -2", { type: "root", value: { radicand: n("x"), index: 3 } }, { x: -8 }, (r) => r.value === -2 && r.error < 1e-15],
    ["a negative power of zero has no claim", { type: "pow", value: { base: n("x"), exp: -2 } }, { x: 0 }, (r) => r.error === Infinity],
    ["the power zero of zero is one", { type: "pow", value: { base: n("x"), exp: 0 } }, { x: 0 }, (r) => r.value === 1 && r.error === 0],
    ["a variable that is not finite has no claim", n("x"), { x: Infinity }, (r) => r.error === Infinity],
    ["min and max are exact", { type: "max", value: [n("x"), n("y")] }, { x: 2, y: 3 }, (r) => r.value === 3 && r.error === 0],
    ["x < y with exact sides is decided", { type: "lt", value: [n("x"), n("y")] }, { x: 1, y: 1 }, (r) => r.value === 0 && r.error === 0],
    ["0.1 + 0.2 < 0.3 is decided false", { type: "lt", value: [{ type: "add", value: [c(0.1), c(0.2)] }, c(0.3)] }, {}, (r) => r.value === 0 && r.error === 0],
    ["(x + 1) - 1 = x is not decided", { type: "eq", value: [{ type: "sub", value: [{ type: "add", value: [n("x"), c(1)] }, c(1)] }, n("x")] }, { x: 0.1 }, (r) => r.error === 1],
  ])("%s", (_, doc, at, ok) => {
    const f = compileFloat(doc, { variables: VARS });
    if (!f.ok) throw new Error(f.error.reason);
    const r = call(f.value, { x: 0, y: 0, z: 0, ...at });
    expect(ok(r), JSON.stringify(r)).toBe(true);
  });
});

describe("no eval", () => {
  it("compiles and runs with eval and Function replaced by stubs that throw", () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { eval: g["eval"], Function: g["Function"] };
    const trap = (): never => {
      throw new Error("eval at run time");
    };
    const corpus = docs(16, Math.min(RUNS, 200));
    const want = corpus.map((d) => direct(d, { x: 1.5, y: -2, z: 0.1 }));
    g["eval"] = trap;
    g["Function"] = trap;
    try {
      corpus.forEach((doc, i) => {
        const r = call(compiled(doc), { x: 1.5, y: -2, z: 0.1 });
        expect(Object.is(r.value, want[i])).toBe(true);
      });
    } finally {
      g["eval"] = saved.eval;
      g["Function"] = saved.Function;
    }
  });

  it("has no eval and no new Function in the source of the evaluator", () => {
    for (const file of ["float.ts", "kinds.ts"]) {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(text).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/);
    }
  });
});
