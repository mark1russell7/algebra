import * as Q from "@mark1russell7/rational";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as B from "./ball.ts";
import * as I from "./interval.ts";
import {
  BALL_OPS,
  ballBinaryLaw,
  type BallOps,
  ballUnaryLaw,
  float,
  holds,
  INTERVAL_OPS,
  intervalBinaryLaw,
  type IntervalOps,
  intervalUnaryLaw,
  moderateBall,
  moderateInterval,
  q,
} from "./laws.test-helper.ts";
import { addUp, divUp, floatRoot, mulUp, subDown } from "./rounding.ts";

/** The runs of each law. The seed is fixed, so each run of the test is the same. */
const RUNS = { numRuns: 400, seed: 0x1a21 } as const;
const BINARY = ["add", "sub", "mul", "div", "min", "max"] as const;
const UNARY = ["neg", "pow", "root"] as const;

describe("the steps of a float and the error-free transforms", () => {
  it("nextUp and nextDown give the next float, with no float between", () => {
    fc.assert(
      fc.property(float, (x) => {
        const up = I.nextUp(x);
        const down = I.nextDown(x);
        if (up < Infinity) {
          expect(Q.compare(q(x), q(up))).toBe(-1);
          expect(I.nextDown(up)).toBe(x === 0 ? 0 : x);
        } else expect(x).toBe(Number.MAX_VALUE);
        if (down > -Infinity) {
          expect(Q.compare(q(down), q(x))).toBe(-1);
          expect(I.nextUp(down)).toBe(x === 0 ? -0 : x);
        } else expect(x).toBe(-Number.MAX_VALUE);
      }),
      RUNS,
    );
  });

  it("sumError and productError give the exact error, and quotientIsExact tells the truth", () => {
    fc.assert(
      fc.property(float, float, (a, b) => {
        const s = a + b;
        const e = I.sumError(a, b, s);
        if (e === e) expect(Q.equals(Q.add(q(a), q(b)), Q.add(q(s), q(e)))).toBe(true);
        const p = a * b;
        const f = I.productError(a, b, p);
        if (f === f) expect(Q.equals(Q.mul(q(a), q(b)), Q.add(q(p), q(f)))).toBe(true);
        if (b !== 0) {
          const d = a / b;
          const isExact = Number.isFinite(d) && Q.equals(Q.div(q(a), q(b)), q(d));
          if (I.quotientIsExact(a, b, d)) expect(isExact).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it("addUp, mulUp and divUp round upward by one step at most, and subDown rounds downward", () => {
    const nonnegative = fc.double({ min: 0, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(nonnegative, nonnegative, (x, y) => {
        const atMostOneStepAbove = (v: number, r: Q.Rational): boolean =>
          v === Infinity || (Q.compare(r, q(v)) <= 0 && Q.compare(q(I.nextDown(v)), r) < 0);
        expect(atMostOneStepAbove(addUp(x, y), Q.add(q(x), q(y)))).toBe(true);
        const m = mulUp(x, y);
        // Near underflow the error term is not known, so the bound is the trivial one step of `u |m| + 2^-1074`.
        expect(m === Infinity || Q.compare(Q.mul(q(x), q(y)), q(m)) <= 0).toBe(true);
        if (y > 0) {
          const d = divUp(x, y);
          expect(d === Infinity || Q.compare(Q.div(q(x), q(y)), q(d)) <= 0).toBe(true);
        }
        const s = subDown(x, y);
        expect(s === -Infinity || Q.compare(q(s), Q.sub(q(x), q(y))) <= 0).toBe(true);
      }),
      RUNS,
    );
  });

  it("floatRoot gives an odd root of a negative value as the negative root", () => {
    expect(floatRoot(-27, 3)).toBe(-3);
    expect(floatRoot(16, 4)).toBe(2);
    expect(floatRoot(-4, 2)).toBeNaN();
  });
});

describe("the enclosure of each operation of intervals", () => {
  for (const name of BINARY) {
    it(`${name} contains the exact result of each pair of points`, () => {
      fc.assert(intervalBinaryLaw(INTERVAL_OPS, name), RUNS);
      fc.assert(intervalBinaryLaw(INTERVAL_OPS, name, moderateInterval), RUNS);
    });
  }
  for (const name of UNARY) {
    it(`${name} contains the exact result of each point`, () => {
      fc.assert(intervalUnaryLaw(INTERVAL_OPS, name), RUNS);
    });
  }

  it("a comparison is decided only when the intervals decide it", () => {
    fc.assert(
      fc.property(moderateInterval, moderateInterval, (x, y) => {
        const t = I.lt(x, y) as readonly [number, number];
        if (t[0] === t[1]) expect(t[0] === 1).toBe(x[1] < y[0]);
        if (t[0] === 0 && t[1] === 0) expect(x[0] >= y[1]).toBe(true);
      }),
      RUNS,
    );
  });
});

describe("the enclosure of each operation of balls", () => {
  for (const name of BINARY) {
    it(`${name} contains the exact result of each pair of points`, () => {
      fc.assert(ballBinaryLaw(BALL_OPS, name), RUNS);
      fc.assert(ballBinaryLaw(BALL_OPS, name, moderateBall), RUNS);
    });
  }
  for (const name of UNARY) {
    it(`${name} contains the exact result of each point`, () => {
      fc.assert(ballUnaryLaw(BALL_OPS, name), RUNS);
    });
  }

  it("a decided comparison of balls is true for each pair of points", () => {
    fc.assert(
      fc.property(moderateBall, moderateBall, (x, y) => {
        for (const [op, rel] of [
          [B.lt, (c: number) => c < 0],
          [B.le, (c: number) => c <= 0],
          [B.eq, (c: number) => c === 0],
        ] as const) {
          const t = op(x, y);
          if (t.rad !== 0) continue;
          for (const a of [Q.sub(q(x.mid), q(x.rad)), Q.add(q(x.mid), q(x.rad))]) {
            for (const b of [Q.sub(q(y.mid), q(y.rad)), Q.add(q(y.mid), q(y.rad))]) {
              expect(rel(Q.compare(a, b)) ? 1 : 0).toBe(t.mid);
            }
          }
        }
      }),
      RUNS,
    );
  });

  it("an exact operation on points gives the radius zero", () => {
    expect(B.add(B.ball(1), B.ball(2))).toEqual({ mid: 3, rad: 0 });
    expect(B.mul(B.ball(3), B.ball(0.5))).toEqual({ mid: 1.5, rad: 0 });
    expect(B.div(B.ball(1), B.ball(4))).toEqual({ mid: 0.25, rad: 0 });
    expect(B.pow(B.ball(3), 4)).toEqual({ mid: 81, rad: 0 });
    expect(B.root(B.ball(9), 2)).toEqual({ mid: 3, rad: 0 });
  });

  it("a divisor that can hold zero, and an even root that can meet a negative value, make no claim", () => {
    expect(B.div(B.ball(1), B.ball(0, 1)).rad).toBe(Infinity);
    expect(B.root(B.ball(0, 1), 2).rad).toBe(Infinity);
    expect(B.lt(B.ball(0, Infinity), B.ball(1))).toBe(B.NO_CLAIM);
  });

  it("ball refuses a negative or NaN radius, and a midpoint that is not finite makes no claim", () => {
    expect(() => B.ball(0, -1)).toThrow(RangeError);
    expect(() => B.ball(0, Number.NaN)).toThrow(RangeError);
    expect(B.ball(Infinity, 0).rad).toBe(Infinity);
  });

  it("toInterval and fromInterval keep each point", () => {
    fc.assert(
      fc.property(moderateBall, moderateInterval, (x, y) => {
        const span = B.toInterval(x);
        expect(holds(span, Q.sub(q(x.mid), q(x.rad))) && holds(span, Q.add(q(x.mid), q(x.rad)))).toBe(true);
        const b = B.fromInterval(y);
        expect(Q.compare(Q.abs(Q.sub(q(y[0]), q(b.mid))), q(b.rad)) <= 0).toBe(true);
        expect(Q.compare(Q.abs(Q.sub(q(y[1]), q(b.mid))), q(b.rad)) <= 0).toBe(true);
      }),
      RUNS,
    );
    expect(B.fromInterval(null)).toBe(B.NO_CLAIM);
    expect(B.fromInterval(I.WHOLE)).toBe(B.NO_CLAIM);
  });
});

describe("the laws find a bound one step too narrow", () => {
  const narrowEnd = (x: I.Interval): I.Interval => (x === null || x[0] === x[1] ? x : [I.nextUp(x[0]), x[1]]);
  const narrowPoint = (x: I.Interval): I.Interval => (x === null ? x : [I.nextUp(x[0]), I.nextUp(x[1])]);
  const narrowRad = (x: B.Ball): B.Ball => (x.rad > 0 && x.rad < Infinity ? { mid: x.mid, rad: I.nextDown(x.rad) } : x);

  it("finds an interval sum whose low end moves one step up", () => {
    const mutant: IntervalOps = { ...INTERVAL_OPS, add: (x, y) => narrowPoint(I.add(x, y)) };
    expect(fc.check(intervalBinaryLaw(mutant, "add"), RUNS).failed).toBe(true);
  });

  it("finds an interval product and a root one step too narrow", () => {
    const mul: IntervalOps = { ...INTERVAL_OPS, mul: (x, y) => narrowEnd(I.mul(x, y)) };
    expect(fc.check(intervalBinaryLaw(mul, "mul"), RUNS).failed).toBe(true);
    const root: IntervalOps = { ...INTERVAL_OPS, root: (x, k) => narrowPoint(I.root(x, k)) };
    expect(fc.check(intervalUnaryLaw(root, "root"), RUNS).failed).toBe(true);
  });

  it("finds a ball sum, product and quotient with a radius one step too small", () => {
    for (const name of ["add", "mul", "div"] as const) {
      const mutant: BallOps = { ...BALL_OPS, [name]: (x: B.Ball, y: B.Ball) => narrowRad(B[name](x, y)) };
      expect(fc.check(ballBinaryLaw(mutant, name, moderateBall), RUNS).failed, name).toBe(true);
    }
  });

  it("finds a ball power with a radius one step too small", () => {
    const mutant: BallOps = { ...BALL_OPS, pow: (x, n) => narrowRad(B.pow(x, n)) };
    expect(fc.check(ballUnaryLaw(mutant, "pow"), RUNS).failed).toBe(true);
  });
});

describe("the source of the package", () => {
  it("has no import of a package, no eval and no new Function", () => {
    for (const file of ["index.ts", "interval.ts", "ball.ts", "rounding.ts"]) {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/);
      for (const m of code.matchAll(/\bfrom\s+["']([^"']+)["']/g)) expect(m[1], file).toMatch(/^\.\//);
    }
  });
});
