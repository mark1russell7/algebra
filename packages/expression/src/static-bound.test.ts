import { check, checkWorld } from "@mark1russell7/coeval";
import * as Q from "@mark1russell7/rational";
import { median } from "@mark1russell7/rigor-statistics";
import { describe, expect, it } from "vitest";
import {
  compileFloat,
  compileInterval,
  compileStatic,
  type Document,
  type Expression,
  expressionMachine,
  type FloatFunction,
  NO_CLAIM,
  random,
  type Random,
  STATIC,
  staticBound,
  type StaticBound,
  type StaticFunction,
  UNIT_ROUNDOFF,
} from "./index.ts";
import { docs, encloses, LONG, oracle, randomPoint, RUNS, VARS } from "./oracle.test-helper.ts";

type At = Readonly<Record<string, number>>;
type Box = readonly (readonly [number, number])[];

function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

const staticOf = (doc: Document): StaticFunction => made(compileStatic(doc, { variables: VARS }));
const floatOf = (doc: Document): FloatFunction => made(compileFloat(doc, { variables: VARS }));
const bound = (doc: Document, bounds: Record<string, readonly [number, number]> = {}): StaticBound => made(staticBound(doc, { bounds }));

const n = (x: string): Expression => ({ type: "var", value: x });
const c = (v: number): Expression => ({ type: "num", value: v });
const add = (a: Expression, b: Expression): Expression => ({ type: "add", value: [a, b] });
const sub = (a: Expression, b: Expression): Expression => ({ type: "sub", value: [a, b] });
const mul = (a: Expression, b: Expression): Expression => ({ type: "mul", value: [a, b] });
const div = (a: Expression, b: Expression): Expression => ({ type: "div", value: [a, b] });
const pow = (base: Expression, exp: number): Expression => ({ type: "pow", value: { base, exp } });
const root = (radicand: Expression, index: number): Expression => ({ type: "root", value: { radicand, index } });
const isComparison = (doc: Document): boolean => doc.type === "lt" || doc.type === "le" || doc.type === "eq";
const atOf = (point: readonly number[]): At => Object.fromEntries(VARS.map((v, i) => [v, point[i] as number]));

/** This function gives the real error of a float value at an exact rational. */
const realError = (value: number, exact: Q.Rational): number => Q.toNumber(Q.abs(Q.sub(Q.fromFloat(value), exact)));

/** This function tells if `value ± error` contains the exact rational, with no rounding. */
function within(value: number, error: number, exact: Q.Rational): boolean {
  return Q.compare(Q.abs(Q.sub(Q.fromFloat(value), exact)), Q.fromFloat(error)) <= 0;
}

/** This function makes a box: a point, a narrow box or a wide box around a random point. */
function randomBox(rnd: Random): Box {
  return VARS.map((v) => {
    const center = randomPoint(rnd)[v] as number;
    const t = rnd();
    const radius = t < 0.25 ? 0 : t < 0.6 ? Math.abs(center) * 2 ** -(10 + Math.floor(rnd() * 30)) : 2 ** (Math.floor(rnd() * 8) - 4);
    const low = center - radius;
    const high = center + radius;
    return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : [center, center];
  });
}

/** This function gives the two extreme corners, 4 random corners and 6 points inside the box. */
function pointsOf(box: Box, rnd: Random): number[][] {
  const corner = (): number[] => box.map(([low, high]) => (rnd() < 0.5 ? low : high));
  const inner = (): number[] => box.map(([low, high]) => Math.min(high, Math.max(low, low + rnd() * (high - low))));
  return [box.map((b) => b[0]), box.map((b) => b[1]), ...Array.from({ length: 4 }, corner), ...Array.from({ length: 6 }, inner)];
}

describe("the verb static", () => {
  it("has an evaluator for each kind, and checks each generated document with no issue", () => {
    expect(checkWorld(expressionMachine, [STATIC])).toEqual([]);
    for (const doc of docs(31, 200)) expect(check(expressionMachine, doc, { verb: STATIC })).toEqual([]);
  });

  it("orders the variables, and refuses a bad call", () => {
    const doc = sub(n("y"), n("x"));
    const f = made(compileStatic(doc));
    expect(f.variables).toEqual(["x", "y"]);
    expect(f.evaluate([1, 5]).enclosure).toEqual([4, 4]);
    expect(made(compileStatic(doc, { variables: ["y", "x"] })).evaluate([1, 5]).enclosure).toEqual([-4, -4]);
    expect(compileStatic(doc, { variables: ["x"] }).ok).toBe(false);
    expect(() => f.evaluate([1])).toThrow(RangeError);
    expect(() => f.evaluate([[2, 1], 0])).toThrow(RangeError);
    expect(() => bound(n("x"), { x: [2, 1] })).toThrow(RangeError);
  });

  it("takes named bounds in the shape of summarize, and a variable without bounds has the whole line", () => {
    expect(bound(add(n("x"), c(1)), { x: [0, 1] }).enclosure).toEqual([1, 2]);
    const whole = bound(add(n("x"), c(1)));
    expect(whole.enclosure).toEqual([-Infinity, Infinity]);
    expect(whole.error).toBe(Infinity);
  });

  it("gives the enclosure of the verb interval for the same box", () => {
    const rnd = random(32);
    for (const doc of docs(33, Math.min(RUNS, 500))) {
      const box = randomBox(rnd);
      expect(staticOf(doc).evaluate(box).enclosure, JSON.stringify({ doc, box })).toEqual(made(compileInterval(doc, { variables: VARS })).evaluate(box));
    }
  });
});

describe("the soundness of the static bound", () => {
  it("contains the exact value, and bounds the real float error, at each point of each random box", () => {
    const rnd = random(34);
    const tally = { points: 0, unknown: 0, enclosures: 0, finite: 0, truths: 0, noClaim: 0 };
    for (const doc of docs(35)) {
      const box = randomBox(rnd);
      const s = staticOf(doc).evaluate(box);
      const f = floatOf(doc);
      if (s.enclosure === NO_CLAIM) tally.noClaim++;
      if (s.enclosure === null || s.enclosure === NO_CLAIM) expect(s.error, JSON.stringify({ doc, box })).toBe(Infinity);
      for (const point of pointsOf(box, rnd)) {
        const at = atOf(point);
        const want = oracle(doc, at);
        const label = JSON.stringify({ doc, box, at, s });
        tally.points++;
        if (s.enclosure === NO_CLAIM) continue;
        if (want === "unknown" || want === "large") {
          tally.unknown++;
          continue;
        }
        if (s.enclosure === null) {
          expect(want, label).toBe("none");
          continue;
        }
        expect(want, label).not.toBe("none");
        if (want === "none") continue;
        tally.enclosures++;
        expect(encloses(s.enclosure[0], s.enclosure[1], want), label).toBe(true);
        if (!(s.error < Infinity)) continue;
        const got = f.evaluate(point);
        if (isComparison(doc)) {
          if (s.error === 0) {
            expect(Q.equals(Q.fromFloat(got.value), want.lo), label).toBe(true);
            tally.truths++;
          }
          continue;
        }
        tally.finite++;
        expect(Number.isFinite(got.value), label).toBe(true);
        expect(within(got.value, s.error, want.lo) && within(got.value, s.error, want.hi), label).toBe(true);
      }
    }
    console.log(`static bound, generator: ${JSON.stringify(tally)}`);
    expect(tally.enclosures).toBeGreaterThan(tally.points / 5);
    expect(tally.finite + tally.truths).toBeGreaterThanOrEqual(Math.min(5000, RUNS * 5));
  }, LONG);

  // A planted unit roundoff of 2^-54 fails here: at these points the real error is the whole 2^-53. TIE is a literal,
  // so that the planted value changes the bound and not the point.
  it("holds at a tie, where the real error of one operation is exactly the unit roundoff", () => {
    const TIE = 2 ** -53;
    const rnd = random(36);
    for (let i = 0; i < 500; i++) {
      const a = 1 + (2 * Math.floor(rnd() * 2 ** 40) + 1) * 2 ** -52;
      const b = TIE;
      const doc = add(n("x"), n("y"));
      const s = staticOf(doc).evaluate([a, b, 0]);
      const { value } = floatOf(doc).evaluate([a, b, 0]);
      const exact = Q.add(Q.fromFloat(a), Q.fromFloat(b));
      expect(realError(value, exact)).toBe(TIE);
      expect(within(value, s.error, exact), JSON.stringify({ a, s })).toBe(true);
      expect(s.error).toBeLessThan(TIE * 2.1);
    }
    const a = 1 + 2 ** -26;
    const b = 1 + 2 ** -27;
    const doc = mul(n("x"), n("y"));
    const s = staticOf(doc).evaluate([a, b, 0]);
    const exact = Q.mul(Q.fromFloat(a), Q.fromFloat(b));
    const { value } = floatOf(doc).evaluate([a, b, 0]);
    expect(realError(value, exact)).toBe(TIE);
    expect(within(value, s.error, exact)).toBe(true);
  });

  it("follows the fold of a list and the squares of a power", () => {
    const list: Expression = { type: "add", value: [c(1), c(UNIT_ROUNDOFF), c(UNIT_ROUNDOFF)] };
    const s = bound(list);
    const { value } = made(compileFloat(list)).evaluate([]);
    expect(value).toBe(1);
    expect(within(value, s.error, Q.add(Q.ONE, Q.fromFloat(2 * UNIT_ROUNDOFF)))).toBe(true);
    const power = pow(n("x"), 7);
    const x = 1 + 2 ** -30;
    const exact = Q.pow(Q.fromFloat(x), 7);
    const got = made(compileFloat(power)).evaluate([x]);
    const p = made(compileStatic(power)).evaluate([[1, 1.5]]);
    expect(within(got.value, p.error, exact)).toBe(true);
    expect(p.error).toBeLessThan(1e-13);
  });
});

describe("no claim", () => {
  it.each<[string, Document, Record<string, readonly [number, number]>, StaticBound["enclosure"]]>([
    ["a quotient by an interval across zero", div(c(1), n("x")), { x: [-1, 1] }, NO_CLAIM],
    ["a quotient by an interval that ends at zero", div(c(1), n("x")), { x: [0, 1] }, NO_CLAIM],
    ["a negative power of an interval across zero", pow(n("x"), -2), { x: [-1, 1] }, NO_CLAIM],
    ["an even root of an interval across zero", root(n("x"), 2), { x: [-1, 1] }, NO_CLAIM],
    ["a root of index 4 of an interval across zero", root(n("x"), 4), { x: [-1, 2] }, NO_CLAIM],
    ["a pole inside a larger document", add(n("y"), div(c(1), sub(n("x"), c(1)))), { x: [0, 2], y: [0, 1] }, NO_CLAIM],
    ["a quotient by x - x, which the box cannot see", div(c(1), sub(n("x"), n("x"))), { x: [1, 2] }, NO_CLAIM],
    ["a quotient by the point zero has no real value", div(c(1), n("x")), { x: [0, 0] }, null],
    ["an even root of a negative interval has no real value", root(n("x"), 2), { x: [-2, -1] }, null],
    ["a part with no real value beats a part with no claim", add(root(n("x"), 2), div(c(1), n("y"))), { x: [-2, -1], y: [-1, 1] }, null],
  ])("%s", (_, doc, bounds, enclosure) => {
    const s = bound(doc, bounds);
    expect(s.enclosure).toEqual(enclosure);
    expect(s.error).toBe(Infinity);
  });

  it("keeps the enclosure and gives no error bound for a root of index 3 or more", () => {
    const s = bound(root(n("x"), 3), { x: [1, 8] });
    expect(s.enclosure).not.toBe(NO_CLAIM);
    expect(s.error).toBe(Infinity);
    const [low, high] = s.enclosure as readonly [number, number];
    expect(low).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThanOrEqual(2);
  });

  it("gives no error bound when the float divisor or radicand can leave its domain", () => {
    const tiny = 2 ** -60;
    const divisor = add(add(n("x"), c(1)), c(-1));
    expect(bound(div(c(1), divisor), { x: [tiny, tiny] }).error).toBe(Infinity);
    expect(bound(root(divisor, 2), { x: [tiny, tiny] }).error).toBe(Infinity);
    expect(bound(root(n("x"), 2), { x: [0, 4] }).error).toBeLessThan(1e-15);
  });

  it("gives no error bound when the float program can overflow", () => {
    expect(bound(mul(n("x"), n("x")), { x: [1e154, 1.3e154] }).error).toBeLessThan(1e293);
    expect(bound(mul(n("x"), n("x")), { x: [1e154, 1.35e154] }).error).toBe(Infinity);
  });
});

describe("the comparisons", () => {
  it.each<[string, Document, Record<string, readonly [number, number]>, readonly [number, number], number]>([
    ["exact sides compare exactly", { type: "lt", value: [n("x"), n("y")] }, { x: [0, 2], y: [1, 3] }, [0, 1], 0],
    ["a decided side is the truth at each point", { type: "lt", value: [add(n("x"), c(0.1)), c(2)] }, { x: [0, 1] }, [1, 1], 0],
    ["a false comparison is decided too", { type: "le", value: [c(3), add(n("x"), c(0.1))] }, { x: [0, 1] }, [0, 0], 0],
    ["an overlap of rounded sides stays open", { type: "eq", value: [add(n("x"), c(1)), c(1.5)] }, { x: [0, 1] }, [0, 1], 1],
  ])("%s", (_, doc, bounds, enclosure, error) => {
    const s = bound(doc, bounds);
    expect(s.enclosure).toEqual(enclosure);
    expect(s.error).toBe(error);
  });
});

describe("the width of the static bound", () => {
  it("is close to the running bound on a box of one point", () => {
    const rnd = random(37);
    const ratios: number[] = [];
    for (const doc of docs(38)) {
      if (isComparison(doc)) continue;
      const point = VARS.map((v) => randomPoint(rnd)[v] as number);
      const s = staticOf(doc).evaluate(point);
      const running = floatOf(doc).evaluate(point).error;
      if (running > 0 && running < Infinity && s.error < Infinity) ratios.push(s.error / running);
    }
    const report = { measured: ratios.length, median: median(ratios), largest: Math.max(...ratios) };
    console.log(`static bound over running bound, one point: ${JSON.stringify(report)}`);
    expect(report.measured).toBeGreaterThan(Math.min(RUNS, 1000) / 10);
    expect(report.median).toBeLessThanOrEqual(2);
  }, LONG);

  it("is wide when the box loses a dependency: x - x and x / x", () => {
    const box = { x: [1, 2] as const };
    const minus = sub(n("x"), n("x"));
    const s = bound(minus, box);
    expect(s.enclosure).toEqual([-1, 1]);
    expect(s.error).toBeGreaterThan(UNIT_ROUNDOFF);
    const f = made(compileFloat(minus));
    const running = f.evaluate([1.5]);
    expect(running.value).toBe(0);
    expect(running.error).toBeLessThan(1e-300);
    const over = bound(div(n("x"), n("x")), box);
    expect(over.enclosure).toEqual([0.5, 2]);
    console.log(`dependency: x - x on [1, 2]: static ${s.error}, running ${running.error}, real 0, ratio ${s.error / running.error}`);
  });
});
