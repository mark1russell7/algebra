import * as B from "@algebra/bigfloat";
import { check, checkWorld } from "@mark1russell7/coeval";
import * as Q from "@mark1russell7/rational";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BALL,
  BIGFLOAT,
  type BigfloatClaim,
  type BigfloatFunction,
  type BigfloatResult,
  compileBigfloat,
  compileInterval,
  decideBigfloat,
  decideInterval,
  type Document,
  EXACT,
  type Expression,
  expressionMachine,
  FLOAT,
  INTERVAL,
  type IntervalFunction,
  NO_CLAIM,
  random,
  SUMMARY,
} from "./index.ts";
import { docs, isPoint, LONG, oracle, POINTS, randomPoint, VARS } from "./oracle.test-helper.ts";

function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

const bigOf = (doc: Document): BigfloatFunction => made(compileBigfloat(doc, { variables: VARS }));
const intervalOf = (doc: Document): IntervalFunction => made(compileInterval(doc, { variables: VARS }));
const x: Expression = { type: "var", value: "x" };
const c = (value: number): Expression => ({ type: "num", value });
const root = (radicand: Expression, index: number): Expression => ({ type: "root", value: { radicand, index } });
const pow = (base: Expression, exp: number): Expression => ({ type: "pow", value: { base, exp } });

/** This function gives the claim of a result, and it fails on another result. */
function claimOf(r: BigfloatResult): BigfloatClaim {
  if (r === null || r === NO_CLAIM) throw new Error(`no claim: ${String(r)}`);
  return r;
}

describe("the verb bigfloat", () => {
  it("has an evaluator for each kind", () => {
    expect(checkWorld(expressionMachine, [SUMMARY, FLOAT, INTERVAL, BALL, EXACT, BIGFLOAT])).toEqual([]);
    for (const doc of docs(41, 100)) expect(check(expressionMachine, doc, { verb: BIGFLOAT })).toEqual([]);
  });

  it("selects the precision at each call, and states the error", () => {
    const f = made(compileBigfloat(root(x, 2)));
    let last = claimOf(f.evaluate([2], 16));
    for (const p of [32, 64, 128, 256, 512]) {
      const r = claimOf(f.evaluate([2], p));
      expect(B.compare(r.low, last.low)).toBeGreaterThanOrEqual(0);
      expect(B.compare(r.high, last.high)).toBeLessThanOrEqual(0);
      expect(r.low.precision).toBe(p);
      // the two correctly rounded ends are one step apart, and the step of a value in [1, 2) is 2^(1 - p)
      expect(Q.equals(B.toRational(r.error), Q.rational(1n, 1n << BigInt(p - 1)))).toBe(true);
      expect(Q.compare(Q.pow(B.toRational(r.low), 2), Q.rational(2n))).toBe(-1);
      expect(Q.compare(Q.pow(B.toRational(r.high), 2), Q.rational(2n))).toBe(1);
      last = r;
    }
  });

  it("gives a point with the error zero when each operation is exact", () => {
    const doc: Document = { type: "sub", value: [{ type: "add", value: [c(1e30), c(1)] }, c(1e30)] };
    const r = claimOf(made(compileBigfloat(doc)).evaluate([], 200));
    expect(B.toNumber(r.low)).toBe(1);
    expect(r.error.sign).toBe(0);
    expect(made(compileInterval(doc)).evaluate([])).not.toEqual([1, 1]);
  });

  it("decides a comparison that the verb interval cannot decide", () => {
    const doc: Document = { type: "lt", value: [{ type: "add", value: [c(1), c(2 ** -80)] }, c(1 + 2 ** -52)] };
    expect(decideInterval(made(compileInterval(doc)).evaluate([]))).toBe("undecided");
    expect(decideBigfloat(made(compileBigfloat(doc)).evaluate([], 200))).toBe(true);
    const two: Document = { type: "le", value: [{ type: "mul", value: [root(c(2), 2), root(c(2), 2)] }, c(2)] };
    expect(decideBigfloat(made(compileBigfloat(two)).evaluate([], 200))).toBe("undecided");
    expect(decideBigfloat(null)).toBe("undecided");
    expect(decideBigfloat(NO_CLAIM)).toBe("undecided");
  });

  it("gives null and no claim by the rules of the verb interval", () => {
    const at = (doc: Expression, v = 0): unknown => made(compileBigfloat(doc, { variables: ["x"] })).evaluate([v], 64);
    const gap: Expression = { type: "sub", value: [root(c(2), 2), root(c(2), 2)] };
    expect(at({ type: "div", value: [c(1), x] })).toBeNull();
    expect(at({ type: "div", value: [c(1), gap] })).toBe(NO_CLAIM);
    expect(at(pow(x, -2))).toBeNull();
    expect(at(pow(gap, -2))).toBe(NO_CLAIM);
    expect(at(pow(x, 0))).toMatchObject({ low: { sign: 1 } });
    expect(at(root(c(-4), 2))).toBeNull();
    expect(at(root(gap, 2))).toBe(NO_CLAIM);
    expect(at(x, Infinity)).toBe(NO_CLAIM);
    expect(at(x, Number.NaN)).toBe(NO_CLAIM);
    expect(at({ type: "add", value: [{ type: "div", value: [c(1), x] }, x] }, 0)).toBeNull();
    expect(B.toNumber(claimOf(made(compileBigfloat(root(c(-8), 3))).evaluate([], 64)).low)).toBe(-2);
  });

  it("makes no claim past the range of the exponents", () => {
    let doc: Expression = c(2);
    for (let i = 0; i < 6; i++) doc = pow(doc, 1000);
    expect(made(compileBigfloat(doc)).evaluate([], 64)).toBe(NO_CLAIM);
  });

  it("refuses a bad precision and too few values", () => {
    const f = made(compileBigfloat(c(1)));
    expect(() => f.evaluate([], 0)).toThrow(RangeError);
    expect(() => f.evaluate([], 1.5)).toThrow(RangeError);
    expect(() => made(compileBigfloat(x)).evaluate([], 64)).toThrow(RangeError);
  });

  it("gives the bounds of a power in each sign case", () => {
    // the base is a small interval around -1
    const base: Expression = { type: "sub", value: [{ type: "mul", value: [root(c(2), 2), root(c(2), 2)] }, c(3)] };
    for (const n of [1, 2, 3, 4, 7, 8, -1, -2, -3]) {
      const r = claimOf(made(compileBigfloat(pow(base, n))).evaluate([], 128));
      const want = Q.rational(n % 2 === 0 ? 1n : -1n);
      expect(Q.compare(B.toRational(r.low), want)).toBeLessThanOrEqual(0);
      expect(Q.compare(B.toRational(r.high), want)).toBeGreaterThanOrEqual(0);
      expect(B.toNumber(r.error)).toBeLessThan(2 ** -110);
    }
  });

  it("has no eval and no new Function in the source of the evaluator", () => {
    const text = readFileSync(new URL("./bigfloat-evaluator.ts", import.meta.url), "utf8");
    expect(text).not.toMatch(/\beval\(|new Function/);
  });
});

describe("the variables with more bits than a double", () => {
  const third = Q.rational(1n, 3n);
  const tiny = B.add(B.fromNumber(1), B.fromRational(Q.rational(1n, 1n << 200n), { precision: 1 }), { precision: 201 });

  it("keeps a BigFloat exact at each precision, and rounds a rational outward", () => {
    const f = made(compileBigfloat(x));
    expect(claimOf(f.evaluate([tiny], 64))).toMatchObject({ low: tiny, high: tiny, error: { sign: 0 } });
    expect(B.compare(tiny, B.fromNumber(1))).toBe(1);
    for (const p of [8, 64, 256]) {
      const r = claimOf(f.evaluate([third], p));
      expect(Q.compare(B.toRational(r.low), third)).toBe(-1);
      expect(Q.compare(third, B.toRational(r.high))).toBe(-1);
      expect(r.low.precision).toBe(p);
    }
    const exact = claimOf(f.evaluate([Q.rational(5n, 8n)], 64));
    expect(exact.error.sign).toBe(0);
    expect(B.toNumber(exact.low)).toBe(0.625);
  });

  it("decides what a double input loses", () => {
    const gap: Document = { type: "lt", value: [c(1), x] };
    const f = made(compileBigfloat(gap));
    expect(decideBigfloat(f.evaluate([tiny], 64))).toBe(true);
    expect(decideBigfloat(f.evaluate([B.toNumber(tiny)], 64))).toBe(false);
  });

  it("gives a width that falls with the precision", () => {
    const f = made(compileBigfloat({ type: "mul", value: [x, x] }));
    const coarse = claimOf(f.evaluate([third], 64));
    const fine = claimOf(f.evaluate([third], 256));
    expect(B.compare(fine.error, coarse.error)).toBe(-1);
    expect(B.compare(coarse.low, fine.low)).toBeLessThanOrEqual(0);
    expect(B.compare(fine.high, coarse.high)).toBeLessThanOrEqual(0);
  });

  it("holds against the rational oracle at each seeded point with more bits than a double", () => {
    const rnd = random(47);
    const big = (bits: number): bigint => {
      let n = 1n;
      for (let i = 0; i < bits; i += 16) n = (n << 16n) | BigInt(Math.floor(rnd() * 65536));
      return n;
    };
    const counts = { cases: 0, claims: 0, none: 0, skipped: 0 };
    for (const doc of docs(49)) {
      const f = bigOf(doc);
      for (let i = 0; i < POINTS; i++) {
        // x is a rational and y is a BigFloat, each with more bits than a double. z stays a double.
        const rx = Q.rational((rnd() < 0.5 ? -1n : 1n) * big(120), big(100));
        const by = B.fromRational(Q.rational(big(160), big(150)), { precision: 200, rounding: "nearest" });
        const z = randomPoint(rnd)["z"] as number;
        const want = oracle(doc, { x: rx, y: B.toRational(by), z });
        for (const precision of [64, 256]) {
          const r = f.evaluate([rx, by, z], precision);
          const where = (): string => JSON.stringify({ doc, x: Q.toString(rx), y: Q.toString(B.toRational(by)), z, precision });
          counts.cases++;
          if (want === "unknown" || want === "large") {
            counts.skipped++;
          } else if (want === "none") {
            counts.none++;
            expect(r === null || r === NO_CLAIM, where()).toBe(true);
          } else {
            expect(r, where()).not.toBeNull();
            if (r === null || r === NO_CLAIM) continue;
            counts.claims++;
            expect(Q.compare(B.toRational(r.low), want.lo) <= 0 && Q.compare(want.hi, B.toRational(r.high)) <= 0, where()).toBe(true);
          }
        }
      }
    }
    console.log(`the claims with wide inputs: ${JSON.stringify(counts)}`);
    expect(counts.claims).toBeGreaterThan(counts.cases / 4);
  }, LONG);
});

describe("the containment of the verb bigfloat", () => {
  it("holds at each point of the corpus at 64 and 256 bits, and it is never wider than the verb interval at 256 bits", () => {
    const rnd = random(42);
    const counts = { cases: 0, claims: 0, unknown: 0, large: 0, none: 0, noClaim: 0, compared: 0, tighter: 0, intervalNoClaim: 0 };
    for (const doc of docs(43)) {
      const f = bigOf(doc);
      const fi = intervalOf(doc);
      for (let i = 0; i < POINTS; i++) {
        const at = randomPoint(rnd);
        const values = VARS.map((v) => at[v] as number);
        const want = oracle(doc, at);
        for (const precision of [64, 256]) {
          const r = f.evaluate(values, precision);
          const where = (): string => JSON.stringify({ doc, at, precision });
          counts.cases++;
          if (want === "unknown" || want === "large") {
            counts[want]++;
            continue;
          }
          if (want === "none") {
            counts.none++;
            expect(r === null || r === NO_CLAIM, where()).toBe(true);
            continue;
          }
          expect(r, where()).not.toBeNull();
          if (r === null || r === NO_CLAIM) {
            counts.noClaim++;
            continue;
          }
          counts.claims++;
          const low = B.toRational(r.low);
          const high = B.toRational(r.high);
          const width = Q.sub(high, low);
          expect(Q.compare(low, want.lo) <= 0 && Q.compare(want.hi, high) <= 0, where()).toBe(true);
          expect(Q.compare(width, B.toRational(r.error)) <= 0, where()).toBe(true);
          if (isPoint(want) && r.error.sign === 0) expect(Q.equals(low, want.lo), where()).toBe(true);
          if (precision < 256) continue;
          const ri = fi.evaluate(values);
          if (ri === null || ri === NO_CLAIM) {
            counts.intervalNoClaim++;
            continue;
          }
          if (ri[0] === -Infinity || ri[1] === Infinity) continue;
          counts.compared++;
          const base = Q.sub(Q.fromFloat(ri[1]), Q.fromFloat(ri[0]));
          expect(Q.compare(low, Q.fromFloat(ri[0])) >= 0 && Q.compare(high, Q.fromFloat(ri[1])) <= 0, where()).toBe(true);
          expect(Q.compare(width, base) <= 0, where()).toBe(true);
          if (Q.compare(width, base) < 0) counts.tighter++;
        }
      }
    }
    console.log(`the bigfloat claims: ${JSON.stringify(counts)}`);
    expect(counts.claims).toBeGreaterThan(counts.cases / 4);
    expect(counts.compared).toBeGreaterThan(counts.cases / 10);
  }, LONG);
});
