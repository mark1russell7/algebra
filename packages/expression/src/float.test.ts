import { check, checkWorld } from "@mark1russell7/coeval";
import * as Q from "@mark1russell7/rational";
import { median } from "@mark1russell7/rigor-statistics";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compileFloat,
  type Document,
  type Expression,
  expressionMachine,
  FLOAT,
  type FloatFunction,
  type FloatResult,
  random,
  SUMMARY,
} from "./index.ts";
import { docs, isPoint, LONG, oracle, POINTS, randomPoint, RUNS, VARS } from "./oracle.test-helper.ts";

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
