import { check, checkWorld } from "@mark1russell7/coeval";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { median } from "@mark1russell7/rigor-statistics";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BALL,
  type Ball,
  type BallFunction,
  compileBall,
  compileFloat,
  compileInterval,
  decideBall,
  decideInterval,
  type Document,
  type Enclosure,
  type Expression,
  expressionMachine,
  FLOAT,
  type FloatFunction,
  INTERVAL,
  interval as I,
  type IntervalFunction,
  NO_CLAIM,
  random,
  type Random,
  SUMMARY,
} from "./index.ts";
import { docs, encloses, isPoint, LONG, oracle, POINTS, randomPoint, VARS } from "./oracle.test-helper.ts";

type At = Readonly<Record<string, number>>;

function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

const atValues = (at: At): number[] => VARS.map((v) => at[v] as number);
const intervalOf = (doc: Document): IntervalFunction => made(compileInterval(doc, { variables: VARS }));
const ballOf = (doc: Document): BallFunction => made(compileBall(doc, { variables: VARS }));
const floatOf = (doc: Document): FloatFunction => made(compileFloat(doc, { variables: VARS }));

const n = (x: string): Expression => ({ type: "var", value: x });
const c = (v: number): Expression => ({ type: "num", value: v });
const isComparison = (doc: Document): boolean => doc.type === "lt" || doc.type === "le" || doc.type === "eq";

describe("the verbs interval and ball", () => {
  it("have an evaluator for each kind", () => {
    expect(checkWorld(expressionMachine, [SUMMARY, FLOAT, INTERVAL, BALL])).toEqual([]);
  });

  it("check each generated document with no issue", () => {
    for (const doc of docs(21, 200)) {
      expect(check(expressionMachine, doc, { verb: INTERVAL })).toEqual([]);
      expect(check(expressionMachine, doc, { verb: BALL })).toEqual([]);
    }
  });

  it("order the variables, and refuse a call with too few values", () => {
    const doc: Expression = { type: "sub", value: [n("y"), n("x")] };
    const f = made(compileInterval(doc));
    expect(f.variables).toEqual(["x", "y"]);
    expect(f.evaluate([1, 5])).toEqual([4, 4]);
    expect(made(compileBall(doc, { variables: ["y", "x"] })).evaluate([1, 5])).toEqual({ mid: -4, rad: 0 });
    expect(compileBall(doc, { variables: ["x"] }).ok).toBe(false);
    expect(() => f.evaluate([1])).toThrow(RangeError);
    expect(() => made(compileBall(doc)).evaluate([1])).toThrow(RangeError);
  });

  it("refuse an input that is not an interval or a ball", () => {
    expect(() => intervalOf(n("x")).evaluate([[2, 1], 0, 0])).toThrow(RangeError);
    expect(() => intervalOf(n("x")).evaluate([[Number.NaN, 1], 0, 0])).toThrow(RangeError);
    expect(() => ballOf(n("x")).evaluate([{ mid: 1, rad: -1 }, 0, 0])).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The outward rounding of each operation of interval.ts, against the exact rationals.
// ---------------------------------------------------------------------------------------------------------------

/** A float of a random size and sign, with the degenerate values sometimes. */
function randomFloat(rnd: Random): number {
  const t = rnd();
  if (t < 0.1) return Math.floor(rnd() * 19) - 9;
  if (t < 0.15) return (rnd() < 0.5 ? -1 : 1) * Number.MIN_VALUE * Math.floor(1 + rnd() * 8);
  const v = (rnd() - 0.5) * 2 ** Math.floor(rnd() * 200 - 100);
  return v === 0 ? 1 : v;
}

const q = (x: number): Rational => Q.fromFloat(x);

/**
 * This function tells if `[lo, hi]` contains `r` and each bound is at most one float step outside the rounding of `r`.
 * A float `r` must give the point.
 */
function isOneStep(lo: number, hi: number, r: Rational): boolean {
  const inside = Q.compare(q(lo), r) <= 0 && Q.compare(r, q(hi)) <= 0;
  const near = Q.compare(q(I.nextUp(I.nextUp(lo))), r) > 0 && Q.compare(q(I.nextDown(I.nextDown(hi))), r) < 0;
  const point = !Q.equals(q(lo), r) || lo === hi;
  return inside && near && point;
}

/** This function counts the float steps from `lo` up to `hi`, to at most `limit`. */
function steps(lo: number, hi: number, limit: number): number {
  let k = 0;
  for (let z = lo; z < hi && k <= limit; z = I.nextUp(z)) k++;
  return k;
}

describe("the outward rounding of interval.ts", () => {
  it("keeps an exact sum or product as a point, and moves an inexact one at most one step outward", () => {
    const rnd = random(31);
    for (let i = 0; i < 4000; i++) {
      const a = randomFloat(rnd);
      const b = randomFloat(rnd);
      const s = I.add([a, a], [b, b]) as readonly [number, number];
      if (Number.isFinite(s[0]) && Number.isFinite(s[1])) expect(isOneStep(s[0], s[1], Q.add(q(a), q(b))), `${a} + ${b}`).toBe(true);
      const p = I.mul([a, a], [b, b]) as readonly [number, number];
      const exact = Q.mul(q(a), q(b));
      expect(encloses(p[0], p[1], { lo: exact, hi: exact }), `${a} * ${b}`).toBe(true);
      // Away from underflow and overflow the error term of TwoProduct is exact, so an exact product stays a point.
      const m = Math.abs(a * b);
      if (m > 2 ** -900 && m < 2 ** 900) expect(isOneStep(p[0], p[1], exact), `${a} * ${b}`).toBe(true);
    }
  });

  it("gives a quotient and a square root at most one step outward on each side", () => {
    const rnd = random(32);
    for (let i = 0; i < 4000; i++) {
      const a = randomFloat(rnd);
      const b = randomFloat(rnd) || 1;
      const d = I.div([a, a], [b, b]) as readonly [number, number];
      const exact = Q.div(q(a), q(b));
      expect(encloses(d[0], d[1], { lo: exact, hi: exact }), `${a} / ${b}`).toBe(true);
      if (Number.isFinite(d[0]) && Number.isFinite(d[1])) expect(steps(d[0], d[1], 3)).toBeLessThanOrEqual(2);
      const m = Math.abs(a);
      const r = I.root([m, m], 2) as readonly [number, number];
      expect(Q.compare(Q.mul(q(r[0]), q(r[0])), q(m)) <= 0 && Q.compare(q(m), Q.mul(q(r[1]), q(r[1]))) <= 0, `sqrt ${m}`).toBe(true);
      expect(steps(r[0], r[1], 3)).toBeLessThanOrEqual(2);
    }
  });

  it("gives a root of index 3 or more within a few steps, not the bounds min(x, 1) and max(x, 1)", () => {
    expect(I.root([27, 27], 3)).toEqual([3, 3]);
    expect(I.root([-8, -8], 3)).toEqual([-2, -2]);
    expect(I.root([16, 16], 4)).toEqual([2, 2]);
    const rnd = random(33);
    for (let i = 0; i < 1000; i++) {
      const a = Math.abs(randomFloat(rnd));
      if (a < 2 ** -300 || a > 2 ** 300) continue;
      const k = 3 + Math.floor(rnd() * 4);
      const r = I.root([a, a], k) as readonly [number, number];
      const inside = Q.compare(Q.pow(q(r[0]), k), q(a)) <= 0 && Q.compare(q(a), Q.pow(q(r[1]), k)) <= 0;
      expect(inside, `root ${k} of ${a}: ${r}`).toBe(true);
      expect(steps(r[0], r[1], 9), `root ${k} of ${a}: ${r}`).toBeLessThanOrEqual(8);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The property: the interval and the ball contain the exact value of @mark1russell7/rational at each point.
// ---------------------------------------------------------------------------------------------------------------

/** The width of a claimed interval, or `undefined` for no claim and for no real value. */
function intervalWidth(r: Enclosure): number | undefined {
  return r === null || r === NO_CLAIM ? undefined : r[1] - r[0];
}

describe("the containment of the interval and the ball", () => {
  it("holds at each point of the corpus, and the median widths compare the interval, the ball and the A3 bound", () => {
    const rnd = random(22);
    const counts = { cases: 0, unknown: 0, large: 0, none: 0, intervalClaims: 0, ballClaims: 0, intervalNoClaim: 0, ballNoClaim: 0 };
    const widths = { interval: [] as number[], ball: [] as number[], float: [] as number[] };
    for (const doc of docs(23)) {
      const fi = intervalOf(doc);
      const fb = ballOf(doc);
      const ff = floatOf(doc);
      for (let i = 0; i < POINTS; i++) {
        const at = randomPoint(rnd);
        const values = atValues(at);
        const ri = fi.evaluate(values);
        const rb = fb.evaluate(values);
        const rf = ff.evaluate(values);
        const want = oracle(doc, at);
        const where = (): string => JSON.stringify({ doc, at, ri, rb });
        counts.cases++;
        expect(rb.rad >= 0, where()).toBe(true);
        if (rb.rad === Infinity) counts.ballNoClaim++;
        if (ri === NO_CLAIM) counts.intervalNoClaim++;
        if (want === "unknown" || want === "large") {
          counts[want]++;
          continue;
        }
        if (want === "none") {
          counts.none++;
          expect(ri === null || ri === NO_CLAIM, where()).toBe(true);
          expect(rb.rad, where()).toBe(Infinity);
          continue;
        }
        if (ri !== NO_CLAIM) {
          counts.intervalClaims++;
          expect(ri !== null && encloses(ri[0], ri[1], want), where()).toBe(true);
        }
        if (rb.rad < Infinity) {
          counts.ballClaims++;
          expect(Number.isFinite(rb.mid), where()).toBe(true);
          const mid = Q.fromFloat(rb.mid);
          const rad = Q.fromFloat(rb.rad);
          expect(Q.compare(Q.sub(mid, rad), want.lo) <= 0 && Q.compare(want.hi, Q.add(mid, rad)) <= 0, where()).toBe(true);
        }
        const wi = intervalWidth(ri);
        if (!isComparison(doc) && isPoint(want) && wi !== undefined && wi < Infinity && rb.rad < Infinity && rf.error < Infinity) {
          const w = [wi, 2 * rb.rad, 2 * rf.error];
          if (w.some((x) => x > 0) && w.every((x) => x < Infinity)) {
            widths.interval.push(w[0] as number);
            widths.ball.push(w[1] as number);
            widths.float.push(w[2] as number);
          }
        }
      }
    }
    const report = {
      ...counts,
      measured: widths.interval.length,
      medianWidth: { interval: median(widths.interval), ball: median(widths.ball), float2e: median(widths.float) },
      medianRatio: {
        ballOverInterval: median(widths.ball.map((b, i) => b / (widths.interval[i] as number)).filter((x) => x === x)),
        intervalOverFloat: median(widths.interval.map((w, i) => w / (widths.float[i] as number)).filter((x) => x === x)),
      },
    };
    console.log(`interval and ball widths: ${JSON.stringify(report)}`);
    expect(counts.intervalClaims).toBeGreaterThan(counts.cases / 4);
    expect(counts.ballClaims).toBeGreaterThan(counts.cases / 4);
  }, LONG);

  it("holds for input intervals and balls at random points inside them", () => {
    const rnd = random(24);
    let checked = 0;
    for (const doc of docs(25, 300)) {
      const fi = intervalOf(doc);
      const fb = ballOf(doc);
      const centre = randomPoint(rnd);
      const spread = VARS.map((v) => {
        const x = centre[v] as number;
        return Number.isFinite(x) ? Math.abs(x) * 2 ** -20 * rnd() : 0;
      });
      const box = VARS.map((v, i) => I.add([centre[v] as number, centre[v] as number], [-(spread[i] as number), spread[i] as number]) as readonly [number, number]);
      const balls: Ball[] = VARS.map((v, i) => ({ mid: centre[v] as number, rad: spread[i] as number }));
      const ri = box.some((b) => !Number.isFinite(b[0]) || !Number.isFinite(b[1])) ? NO_CLAIM : fi.evaluate(box);
      const rb = fb.evaluate(balls);
      for (let k = 0; k < 3; k++) {
        const at = Object.fromEntries(VARS.map((v, i) => [v, (centre[v] as number) + (2 * rnd() - 1) * (spread[i] as number)]));
        if (VARS.some((v, i) => !(Math.abs((at[v] as number) - (centre[v] as number)) <= (spread[i] as number)))) continue;
        const want = oracle(doc, at);
        if (typeof want === "string") continue;
        checked++;
        const where = JSON.stringify({ doc, at, ri, rb });
        if (ri !== NO_CLAIM) expect(ri !== null && encloses(ri[0], ri[1], want), where).toBe(true);
        if (rb.rad < Infinity) {
          const mid = Q.fromFloat(rb.mid);
          const rad = Q.fromFloat(rb.rad);
          expect(Q.compare(Q.sub(mid, rad), want.lo) <= 0 && Q.compare(want.hi, Q.add(mid, rad)) <= 0, where).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  }, LONG);

  it("gives the float value of A3 as the midpoint of each ball that makes a claim", () => {
    const rnd = random(26);
    for (const doc of docs(27, 400)) {
      const fb = ballOf(doc);
      const ff = floatOf(doc);
      for (let i = 0; i < POINTS; i++) {
        const values = atValues(randomPoint(rnd));
        const b = fb.evaluate(values);
        if (b.rad < Infinity) expect(Object.is(b.mid, ff.evaluate(values).value), JSON.stringify({ doc, values })).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The cases that the evaluators do not decide.
// ---------------------------------------------------------------------------------------------------------------

const zeroDivisor: Expression = { type: "div", value: [c(1), { type: "sub", value: [n("x"), n("x")] }] };
const sqrtX: Expression = { type: "root", value: { radicand: n("x"), index: 2 } };

describe("the undecided cases", () => {
  it.each<[string, Document, ArrayLike<number | readonly [number, number]>, (r: Enclosure) => boolean]>([
    ["a quotient by the point zero has no real value", zeroDivisor, [3, 0, 0], (r) => r === null],
    ["a quotient by an interval that holds zero makes no claim", { type: "div", value: [c(1), n("x")] }, [[-1, 1], 0, 0], (r) => r === NO_CLAIM],
    ["a quotient by [0, 1] makes no claim", { type: "div", value: [c(1), n("x")] }, [[0, 1], 0, 0], (r) => r === NO_CLAIM],
    ["an even root of a negative interval has no real value", sqrtX, [[-2, -1], 0, 0], (r) => r === null],
    ["an even root of an interval that can be negative makes no claim", sqrtX, [[-1, 4], 0, 0], (r) => r === NO_CLAIM],
    ["a negative power of an interval that holds zero makes no claim", { type: "pow", value: { base: n("x"), exp: -2 } }, [[-1, 1], 0, 0], (r) => r === NO_CLAIM],
    ["a variable that is not finite makes no claim", n("x"), [Infinity, 0, 0], (r) => r === NO_CLAIM],
    ["no real value wins over no claim", { type: "add", value: [n("x"), zeroDivisor] }, [3, 0, 0], (r) => r === null],
    ["no claim stays no claim times zero", { type: "mul", value: [{ type: "div", value: [c(1), n("y")] }, c(0)] }, [0, [-1, 1], 0], (r) => r === NO_CLAIM],
    ["an unbounded input interval is a claim", { type: "div", value: [c(1), n("x")] }, [[1, Infinity], 0, 0], (r) => r !== null && r !== NO_CLAIM && r[0] === 0 && r[1] === 1],
    ["0.1 + 0.2 moves one step outward on each side", { type: "add", value: [c(0.1), c(0.2)] }, [0, 0, 0], (r) => r !== null && r !== NO_CLAIM && r[0] === I.nextDown(0.1 + 0.2) && r[1] === I.nextUp(0.1 + 0.2)],
  ])("interval: %s", (_, doc, values, ok) => {
    const r = intervalOf(doc).evaluate(values);
    expect(ok(r), JSON.stringify(r)).toBe(true);
  });

  it.each<[string, Document, ArrayLike<number | Ball>, (r: Ball) => boolean]>([
    ["a quotient by x - x makes no claim", zeroDivisor, [3, 0, 0], (r) => r.rad === Infinity],
    ["a quotient by a ball that holds zero makes no claim", { type: "div", value: [c(1), n("x")] }, [{ mid: 1, rad: 1 }, 0, 0], (r) => r.rad === Infinity],
    ["an even root of a ball that can be negative makes no claim", sqrtX, [{ mid: 1, rad: 2 }, 0, 0], (r) => r.rad === Infinity],
    ["a variable that is not finite makes no claim", n("x"), [Number.NaN, 0, 0], (r) => r.rad === Infinity],
    ["no claim stays no claim times zero", { type: "mul", value: [{ type: "div", value: [c(1), n("y")] }, c(0)] }, [0, 0, 0], (r) => r.rad === Infinity],
    ["an exact sum has the radius zero", { type: "add", value: [n("x"), c(2)] }, [3, 0, 0], (r) => r.mid === 5 && r.rad === 0],
    ["an exact quotient has the radius zero", { type: "div", value: [c(6), n("x")] }, [3, 0, 0], (r) => r.mid === 2 && r.rad === 0],
    ["sqrt(4) is exactly 2", sqrtX, [4, 0, 0], (r) => r.mid === 2 && r.rad === 0],
    ["the cube root of -8 is exactly -2", { type: "root", value: { radicand: n("x"), index: 3 } }, [-8, 0, 0], (r) => r.mid === -2 && r.rad === 0],
    ["0.1 + 0.2 has a radius below one step", { type: "add", value: [c(0.1), c(0.2)] }, [0, 0, 0], (r) => r.rad > 0 && r.rad < I.nextUp(r.mid) - r.mid],
  ])("ball: %s", (_, doc, values, ok) => {
    const r = ballOf(doc).evaluate(values);
    expect(ok(r), JSON.stringify(r)).toBe(true);
  });

  it("decides a comparison only when the enclosures decide it", () => {
    const sum: Expression = { type: "add", value: [c(0.1), c(0.2)] };
    const lt: Document = { type: "lt", value: [sum, c(0.3)] };
    expect(decideInterval(intervalOf(lt).evaluate([0, 0, 0]))).toBe(false);
    expect(decideBall(ballOf(lt).evaluate([0, 0, 0]))).toBe(false);
    const eq: Document = { type: "eq", value: [{ type: "sub", value: [{ type: "add", value: [n("x"), c(1)] }, c(1)] }, n("x")] };
    expect(decideInterval(intervalOf(eq).evaluate([0.1, 0, 0]))).toBe("undecided");
    expect(decideBall(ballOf(eq).evaluate([0.1, 0, 0]))).toBe("undecided");
    const le: Document = { type: "le", value: [n("x"), n("y")] };
    expect(decideInterval(intervalOf(le).evaluate([1, 1, 0]))).toBe(true);
    expect(decideBall(ballOf(le).evaluate([1, 1, 0]))).toBe(true);
    expect(decideInterval(intervalOf(le).evaluate([[0, 2], 1, 0]))).toBe("undecided");
    expect(decideBall(ballOf(le).evaluate([{ mid: 1, rad: 1 }, 1, 0]))).toBe("undecided");
    expect(decideInterval(intervalOf({ type: "lt", value: [zeroDivisor, c(1)] }).evaluate([3, 0, 0]))).toBe("undecided");
    expect(decideBall(ballOf({ type: "lt", value: [zeroDivisor, c(1)] }).evaluate([3, 0, 0]))).toBe("undecided");
  });

  it("has no eval and no new Function in the source of the two evaluators", () => {
    for (const file of ["interval-evaluator.ts", "ball.ts"]) {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(text).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/);
    }
  });
});
