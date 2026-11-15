import { describe, expect, it } from "vitest";
import { random } from "@mark1russell7/expression";
import type { Random } from "@mark1russell7/expression";
import { classifySegments, classifySegmentsShifted, compareShifted, dyadic as D, orient2dShifted, orient2dShiftedSign, orient2dSign } from "./index.ts";
import type { Dyadic, SegmentRelation, Sign } from "./index.ts";
import { RUNS } from "./corpus.test-helper.ts";

const F = D.fromFloat;
const MAX = Number.MAX_VALUE;

/** An exact point. */
type Point = readonly [Dyadic, Dyadic];

/** The oracle of the orientation: the exact sign of `(a - c) x (b - c)` over dyadic numbers. */
function orientOracle(a: Point, b: Point, c: Point): Sign {
  const [acx, acy, bcx, bcy] = [D.sub(a[0], c[0]), D.sub(a[1], c[1]), D.sub(b[0], c[0]), D.sub(b[1], c[1])];
  return D.sign(D.sub(D.mul(acx, bcy), D.mul(acy, bcx)));
}

/** The order of two exact points, in the order of `x`, then of `y`. */
function compareOracle(p: Point, q: Point): number {
  return D.compare(p[0], q[0]) || D.compare(p[1], q[1]);
}

/** The oracle of the relation: the rule of `classifySegments` on the exact points `a`, `b`, `c + t` and `d + t`. */
function relationOracle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, tx: number, ty: number): SegmentRelation {
  const a: Point = [F(ax), F(ay)];
  const b: Point = [F(bx), F(by)];
  const c: Point = [D.add(F(cx), F(tx)), D.add(F(cy), F(ty))];
  const d: Point = [D.add(F(dx), F(tx)), D.add(F(dy), F(ty))];
  const [o1, o2, o3, o4] = [orientOracle(a, b, c), orientOracle(a, b, d), orientOracle(c, d, a), orientOracle(c, d, b)];
  if (o1 * o2 > 0 || o3 * o4 > 0) return "disjoint";
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    const [lo1, hi1] = compareOracle(a, b) <= 0 ? [a, b] : [b, a];
    const [lo2, hi2] = compareOracle(c, d) <= 0 ? [c, d] : [d, c];
    const lo = compareOracle(lo1, lo2) >= 0 ? lo1 : lo2;
    const hi = compareOracle(hi1, hi2) <= 0 ? hi1 : hi2;
    const order = compareOracle(lo, hi);
    return order < 0 ? "overlap" : order === 0 ? "touch" : "disjoint";
  }
  return o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 ? "touch" : "cross";
}

/**
 * A value in `[0, 1)` with 53 random bits. The source gives multiples of `2^-32`, and a sum of such a value and 360 has no
 * rounding. So the cases join two values of the source.
 */
const fine = (rnd: Random): number => (Math.floor(rnd() * 2 ** 21) * 2 ** 32 + Math.floor(rnd() * 2 ** 32)) / 2 ** 53;

/** A float with many bits, from `-scale / 2` to `scale / 2`. A sum with a multiple of 360 rounds for most of them. */
const wide = (rnd: Random, scale: number): number => (fine(rnd) - 0.5) * scale;

/** A shift: a multiple of 360 up to two turns, as across the antimeridian, or a float with many bits. */
const shift = (rnd: Random): number => (rnd() < 0.7 ? 360 * (Math.floor(rnd() * 5) - 2) : wide(rnd, 1000));

/** The float next to `x` in the direction of `step`: -1, 0 or 1. */
function nextTo(x: number, step: number): number {
  if (step === 0 || !Number.isFinite(x)) return x;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigInt64(0);
  if (x === 0) return step * Number.MIN_VALUE;
  view.setBigInt64(0, bits + BigInt((x > 0) === (step > 0) ? 1 : -1));
  return view.getFloat64(0);
}

/**
 * Ten floats of the cases: a, b, c, d and t. The families are general points, points on a horizontal line and on a
 * vertical line, so each orientation is 0 while the sums round, and ends one float step from a moved end.
 */
function draw(rnd: Random): readonly [number, number, number, number, number, number, number, number, number, number] {
  const family = Math.floor(rnd() * 4);
  const tx = shift(rnd);
  const ty = rnd() < 0.7 ? 0 : wide(rnd, 100);
  if (family === 0) {
    return [wide(rnd, 400), wide(rnd, 200), wide(rnd, 400), wide(rnd, 200), wide(rnd, 400), wide(rnd, 200), wide(rnd, 400), wide(rnd, 200), tx, ty];
  }
  if (family === 1) {
    // A horizontal line y = Y with ty = 0. Each end of ab is a moved end, one float step from it, or a free value.
    // A coarse value has no rounding in a sum with a multiple of 360, so ends can be equal.
    const coarse = rnd() < 0.3;
    const value = (): number => (coarse ? Math.round(wide(rnd, 400)) / 4 : wide(rnd, 400));
    const y = wide(rnd, 200);
    const [cx, dx] = [value(), value()];
    const end = (): number => {
      const pick = rnd();
      return pick < 0.3 ? nextTo(cx + tx, Math.floor(rnd() * 3) - 1) : pick < 0.6 ? nextTo(dx + tx, Math.floor(rnd() * 3) - 1) : value() + tx;
    };
    return [end(), y, end(), y, cx, y, dx, y, tx, 0];
  }
  if (family === 2) {
    // A vertical line x = X: c and d have x = X - tx with no rounding, and the sums of y round.
    const x = Math.round(wide(rnd, 400));
    const t = 360 * (Math.floor(rnd() * 5) - 2);
    const sy = wide(rnd, 100);
    const [cy, dy] = [wide(rnd, 200), wide(rnd, 200)];
    const end = (): number => (rnd() < 0.5 ? nextTo(cy + sy, Math.floor(rnd() * 3) - 1) : wide(rnd, 200));
    return [x, end(), x, end(), x - t, cy, x - t, dy, t, sy];
  }
  // A point of ab near the moved segment: the float of a moved end, a step from it, or the float midpoint.
  const [cx, cy, dx, dy] = [wide(rnd, 400), wide(rnd, 200), wide(rnd, 400), wide(rnd, 200)];
  const step = Math.floor(rnd() * 3) - 1;
  const near = rnd() < 0.5 ? ([nextTo(cx + tx, step), cy + ty] as const) : ([(cx + dx) / 2 + tx, (cy + dy) / 2 + ty] as const);
  return [near[0], near[1], wide(rnd, 400), wide(rnd, 200), cx, cy, dx, dy, tx, ty];
}

describe("compareShifted", () => {
  it("gives the exact sign of x + t - y, also when the float sum rounds", () => {
    expect(compareShifted(0.1, 360, 360.1)).toBe(D.compare(D.add(F(0.1), F(360)), F(360.1)));
    // The float sum 2^53 + 1 is 2^53, and the exact sum is more.
    expect(compareShifted(2 ** 53, 1, 2 ** 53)).toBe(1);
    expect(compareShifted(2 ** 53, -1, 2 ** 53)).toBe(-1);
    expect(compareShifted(-200, 360, 160)).toBe(0);
    // A sum that overflows is past each finite value.
    expect(compareShifted(MAX, MAX, MAX)).toBe(1);
    expect(compareShifted(0 - MAX, 0 - MAX, 0 - MAX)).toBe(-1);
    const rnd = random(31);
    for (let i = 0; i < RUNS; i++) {
      const [x, t] = [wide(rnd, 1000), shift(rnd)];
      const y = rnd() < 0.5 ? nextTo(x + t, Math.floor(rnd() * 3) - 1) : wide(rnd, 1000);
      expect(compareShifted(x, t, y)).toBe(D.compare(D.add(F(x), F(t)), F(y)));
    }
  });

  it("refuses an input that is not finite", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => compareShifted(bad, 0, 0)).toThrow(RangeError);
      expect(() => compareShifted(0, bad, 0)).toThrow(RangeError);
      expect(() => compareShifted(0, 0, bad)).toThrow(RangeError);
    }
  });
});

describe("orient2dShifted", () => {
  it("is the orientation of a, b and c + t, and of a - t, b - t and c", () => {
    const rnd = random(32);
    const stages = { filter: 0, exact: 0 };
    // The base: the float form, orient2d of the rounded moved point.
    let floatWrong = 0;
    for (let i = 0; i < RUNS; i++) {
      const [ax, ay, bx, by, cx, cy, , , tx, ty] = draw(rnd);
      const moved: Point = [D.add(F(cx), F(tx)), D.add(F(cy), F(ty))];
      const expected = orientOracle([F(ax), F(ay)], [F(bx), F(by)], moved);
      // The oracle moves a and b by -t in place of c by t.
      const back = orientOracle([D.sub(F(ax), F(tx)), D.sub(F(ay), F(ty))], [D.sub(F(bx), F(tx)), D.sub(F(by), F(ty))], [F(cx), F(cy)]);
      expect(back).toBe(expected);
      const result = orient2dShifted(ax, ay, bx, by, cx, cy, tx, ty);
      expect(result.sign).toBe(expected);
      expect(orient2dShiftedSign(ax, ay, bx, by, cx, cy, tx, ty)).toBe(expected);
      stages[result.stage] += 1;
      if (orient2dSign(ax, ay, bx, by, cx + tx, cy + ty) !== expected) floatWrong += 1;
    }
    console.log(`A27 orient: ${RUNS} cases, filter ${stages.filter}, exact ${stages.exact}, float form wrong ${floatWrong}`);
    expect(floatWrong).toBeGreaterThan(0);
    // The families put many points on one line, so each stage decides a part of the cases.
    expect(stages.exact).toBeGreaterThan(RUNS / 10);
    expect(stages.filter).toBeGreaterThan(RUNS / 10);
  });

  it("is orient2d of the moved point when the sums have no rounding", () => {
    expect(orient2dShifted(0, 0, 1, 0, -359.5, 1, 360, 0)).toEqual({ sign: 1, stage: "filter" });
    expect(orient2dShifted(0, 0, 1, 0, -359.5, -1, 360, 0).sign).toBe(-1);
    expect(orient2dShifted(0, 0, 1, 1, -358, 2, 360, 0).sign).toBe(0);
  });

  it("decides a moved point that is not a float, on the line through two floats", () => {
    // The point (0.1 + 360, 0) is on the line y = 0, and its float sum rounds.
    expect(orient2dShifted(0, 0, 400, 0, 0.1, 0, 360, 0)).toEqual({ sign: 0, stage: "exact" });
    // The float sum of 2^-60 and 1 is 1, so the float orientation of a, b and the moved point is 0. The exact one is not.
    expect(orient2dShifted(0, 0, 1, 1, 2 ** -60, 0, 1, 1)).toEqual({ sign: -1, stage: "exact" });
    expect(orient2dShifted(0, 0, 1, 1, 0 - 2 ** -60, 0, 1, 1)).toEqual({ sign: 1, stage: "exact" });
  });

  it("decides most moved points with a rounded sum in the filter", () => {
    // The sum 0.1 + 360 rounds, and the point is far from the line, so the filter decides.
    expect(orient2dShifted(0, 0, 400, 0, 0.1, 1, 360, 0)).toEqual({ sign: 1, stage: "filter" });
    expect(orient2dShifted(0, 0, 400, 0, 0.1, -1, 360, 0)).toEqual({ sign: -1, stage: "filter" });
    // The tail of the sum moves the point off the line through a and the float sum, so only the exact stage decides.
    const sx = 0.1 + 360;
    expect(orient2dShifted(0, 0, sx, 1, 0.1, 1, 360, 0).stage).toBe("exact");
    expect(orient2dShifted(0, 0, sx, 1, 0.1, 1, 360, 0).sign).toBe(orientOracle([F(0), F(0)], [F(sx), F(1)], [D.add(F(0.1), F(360)), F(1)]));
  });

  it("decides a moved point whose float sum overflows", () => {
    expect(orient2dShifted(0, 0, 1, 0, MAX, 1, MAX, 0)).toEqual({ sign: 1, stage: "exact" });
    expect(orient2dShifted(0, 0, 1, 0, MAX, -1, MAX, 0)).toEqual({ sign: -1, stage: "exact" });
  });

  it("refuses an input that is not finite", () => {
    for (let index = 0; index < 8; index++) {
      const values = [0, 0, 1, 0, 0, 1, 0, 0];
      values[index] = Number.NaN;
      expect(() => orient2dShifted(...(values as [number, number, number, number, number, number, number, number]))).toThrow(RangeError);
      values[index] = Number.POSITIVE_INFINITY;
      expect(() => orient2dShiftedSign(...(values as [number, number, number, number, number, number, number, number]))).toThrow(RangeError);
    }
  });
});

describe("classifySegmentsShifted", () => {
  it("is the rule of classifySegments on the exact moved points", () => {
    const rnd = random(33);
    const seen = new Map<string, number>();
    // The base: the float form, classifySegments of the rounded moved points.
    let floatWrong = 0;
    for (let i = 0; i < RUNS; i++) {
      const [ax, ay, bx, by, cx, cy, dx, dy, tx, ty] = draw(rnd);
      const result = classifySegmentsShifted(ax, ay, bx, by, cx, cy, dx, dy, tx, ty);
      const expected = relationOracle(ax, ay, bx, by, cx, cy, dx, dy, tx, ty);
      expect(result.relation, JSON.stringify([ax, ay, bx, by, cx, cy, dx, dy, tx, ty])).toBe(expected);
      if (classifySegments(ax, ay, bx, by, cx + tx, cy + ty, dx + tx, dy + ty).relation !== expected) floatWrong += 1;
      const key = `${result.relation}${result.collinear ? " collinear" : ""}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    console.log(`A27 classify: ${RUNS} cases, float form wrong ${floatWrong}, relations ${JSON.stringify(Object.fromEntries(seen))}`);
    // Each relation occurs, and the collinear relations too, so the oracle tests each branch.
    for (const key of ["disjoint", "cross", "touch", "disjoint collinear", "touch collinear", "overlap collinear"]) expect(seen.get(key) ?? 0, key).toBeGreaterThan(0);
    expect(floatWrong).toBeGreaterThan(0);
  });

  it("is classifySegments of the moved floats when the sums have no rounding", () => {
    const rnd = random(34);
    for (let i = 0; i < RUNS; i++) {
      // Integers and halves plus a multiple of 360 have no rounding.
      const value = (): number => Math.round(wide(rnd, 40)) / 2;
      const [ax, ay, bx, by, cx, cy, dx, dy] = [value(), value(), value(), value(), value(), value(), value(), value()];
      const tx = 360 * (Math.floor(rnd() * 5) - 2);
      expect(classifySegmentsShifted(ax, ay, bx, by, cx, cy, dx, dy, tx, 0).relation).toBe(classifySegments(ax, ay, bx, by, cx + tx, cy, dx + tx, dy).relation);
      expect(classifySegmentsShifted(ax, ay, bx, by, cx, cy, dx, dy, 0, 0)).toBe(classifySegments(ax, ay, bx, by, cx, cy, dx, dy));
    }
  });

  it("orders the ends of collinear segments by the exact moved values", () => {
    // On the line y = 0: the moved segment goes from 0.1 + 360 to 1 + 360, and the float 360.1 is not 0.1 + 360.
    const exactEnd = D.add(F(0.1), F(360));
    const relations = [-1, 0, 1].map((step) => {
      const end = nextTo(0.1 + 360, step);
      const result = classifySegmentsShifted(300, 0, end, 0, 0.1, 0, 1, 0, 360, 0);
      expect(result.collinear).toBe(true);
      const order = D.compare(F(end), exactEnd);
      expect(result.relation).toBe(order < 0 ? "disjoint" : order === 0 ? "touch" : "overlap");
      return result.relation;
    });
    // The exact end is between two floats, so one float gives "disjoint" and the next one gives "overlap".
    expect(relations[0]).toBe("disjoint");
    expect(relations[2]).toBe("overlap");
  });

  it("refuses an input that is not finite", () => {
    expect(() => classifySegmentsShifted(0, 0, 1, 1, 0, 1, 1, 0, Number.NaN, 0)).toThrow(RangeError);
    expect(() => classifySegmentsShifted(0, 0, 1, 1, 0, 1, Number.POSITIVE_INFINITY, 0, 360, 0)).toThrow(RangeError);
  });
});
