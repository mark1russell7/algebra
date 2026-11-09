/**
 * The enclosure laws of the package as fast-check properties. Each law takes the operations as a parameter, so a test
 * gives it a planted mutant too. Each law compares a result with the exact rationals of `@mark1russell7/rational`.
 *
 * @packageDocumentation
 */
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import fc from "fast-check";
import * as B from "./ball.ts";
import type { Ball } from "./ball.ts";
import * as I from "./interval.ts";
import type { Interval } from "./interval.ts";

export const q = (x: number): Rational => Q.fromFloat(x);

/** A finite float of each size, with zeros and subnormal numbers. */
export const float: fc.Arbitrary<number> = fc.double({ noNaN: true, noDefaultInfinity: true });

/** A finite float of a moderate size, so that a power of it stays finite more often. */
export const moderate: fc.Arbitrary<number> = fc.oneof(fc.double({ noNaN: true, min: -1e6, max: 1e6 }), fc.integer({ min: -64, max: 64 }));

/** A closed interval with finite ends. */
export const interval: fc.Arbitrary<readonly [number, number]> = fc.tuple(float, float).map(([a, b]): readonly [number, number] => (a <= b ? [a, b] : [b, a]));

/** A closed interval with moderate ends. */
export const moderateInterval: fc.Arbitrary<readonly [number, number]> = fc.tuple(moderate, moderate).map(([a, b]): readonly [number, number] => (a <= b ? [a, b] : [b, a]));

/** A radius: zero, a small value or any finite value. */
const radius = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 1e-6, noNaN: true }), fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }));

/** A ball with a finite midpoint and a finite radius. */
export const ball: fc.Arbitrary<Ball> = fc.record({ mid: float, rad: radius });

/** A ball with a moderate midpoint and a moderate radius. */
export const moderateBall: fc.Arbitrary<Ball> = fc.record({ mid: moderate, rad: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 1e3, noNaN: true })) });

/** This function tells if `[lo, hi]` contains the exact value `r`. An infinite end is no bound on its side. */
export function holds(x: Interval, r: Rational): boolean {
  if (x === null) return false;
  const [lo, hi] = x;
  const low = lo === -Infinity || (lo < Infinity && Q.compare(q(lo), r) <= 0);
  const high = hi === Infinity || (hi > -Infinity && Q.compare(r, q(hi)) <= 0);
  return low && high;
}

/** This function tells if a ball contains the exact value `r`. A radius of `Infinity` makes no claim. */
export function ballHolds(x: Ball, r: Rational): boolean {
  if (!(x.rad < Infinity)) return true;
  if (!(x.mid - x.mid === 0)) return false;
  return Q.compare(Q.abs(Q.sub(r, q(x.mid))), q(x.rad)) <= 0;
}

/** The ends of an interval and its float midpoint, as exact values. */
const pointsOf = ([a, b]: readonly [number, number]): Rational[] => {
  const m = a / 2 + b / 2;
  return [q(a), q(b), q(m >= a && m <= b ? m : a)];
};

/** The two ends of a ball and its midpoint, as exact values. */
const ballPoints = (x: Ball): Rational[] => [Q.sub(q(x.mid), q(x.rad)), q(x.mid), Q.add(q(x.mid), q(x.rad))];

/** The operations of intervals that the laws test. */
export interface IntervalOps {
  readonly add: (x: Interval, y: Interval) => Interval;
  readonly sub: (x: Interval, y: Interval) => Interval;
  readonly mul: (x: Interval, y: Interval) => Interval;
  readonly div: (x: Interval, y: Interval) => Interval;
  readonly neg: (x: Interval) => Interval;
  readonly min: (x: Interval, y: Interval) => Interval;
  readonly max: (x: Interval, y: Interval) => Interval;
  readonly pow: (x: Interval, n: number) => Interval;
  readonly root: (x: Interval, k: number) => Interval;
}

/** The operations of balls that the laws test. */
export interface BallOps {
  readonly add: (x: Ball, y: Ball) => Ball;
  readonly sub: (x: Ball, y: Ball) => Ball;
  readonly mul: (x: Ball, y: Ball) => Ball;
  readonly div: (x: Ball, y: Ball) => Ball;
  readonly neg: (x: Ball) => Ball;
  readonly min: (x: Ball, y: Ball) => Ball;
  readonly max: (x: Ball, y: Ball) => Ball;
  readonly pow: (x: Ball, n: number) => Ball;
  readonly root: (x: Ball, k: number) => Ball;
}

type Binary = "add" | "sub" | "mul" | "div" | "min" | "max";

const exact: Readonly<Record<Binary, (a: Rational, b: Rational) => Rational>> = {
  add: Q.add,
  sub: Q.sub,
  mul: Q.mul,
  div: Q.div,
  min: (a, b) => (Q.compare(a, b) <= 0 ? a : b),
  max: (a, b) => (Q.compare(a, b) >= 0 ? a : b),
};

/** The exact value of `r` to the whole power `n`, or `undefined` for a negative power of zero. */
function exactPow(r: Rational, n: number): Rational | undefined {
  if (n >= 0) return Q.pow(r, n);
  return Q.sign(r) === 0 ? undefined : Q.inverse(Q.pow(r, -n));
}

/**
 * This function tells if `[lo, hi]` contains the real root of index `k` of the exact value `p`. An end of `undefined`
 * is no bound. The root is monotone, so the check compares the powers of the ends with `p`, with no root.
 */
function rootWithin(lo: Rational | undefined, hi: Rational | undefined, p: Rational, k: number): boolean {
  if (k % 2 === 0 && Q.sign(p) < 0) return true;
  const low = lo === undefined || (k % 2 === 0 && Q.sign(lo) <= 0) || Q.compare(Q.pow(lo, k), p) <= 0;
  const high = hi === undefined || (k % 2 === 0 && Q.sign(hi) < 0 ? false : Q.compare(p, Q.pow(hi, k)) <= 0);
  return low && high;
}

/** This function tells if `x` contains the real root of index `k` of the exact value `p`. */
export function holdsRoot(x: Interval, p: Rational, k: number): boolean {
  if (k % 2 === 0 && Q.sign(p) < 0) return true;
  if (x === null) return false;
  const [lo, hi] = x;
  if (lo === Infinity || hi === -Infinity) return false;
  return rootWithin(lo === -Infinity ? undefined : q(lo), hi === Infinity ? undefined : q(hi), p, k);
}

/** This function tells if a ball contains the real root of index `k` of the exact value `p`, with exact ends. */
export function ballHoldsRoot(x: Ball, p: Rational, k: number): boolean {
  if (!(x.rad < Infinity)) return true;
  if (!(x.mid - x.mid === 0)) return k % 2 === 0 && Q.sign(p) < 0;
  return rootWithin(Q.sub(q(x.mid), q(x.rad)), Q.add(q(x.mid), q(x.rad)), p, k);
}

/** The law of a binary operation of intervals: the result contains the exact result of each pair of points. */
export function intervalBinaryLaw(ops: IntervalOps, name: Binary, inputs: fc.Arbitrary<readonly [number, number]> = interval): fc.IPropertyWithHooks<[readonly [number, number], readonly [number, number]]> {
  return fc.property(inputs, inputs, (x, y) => {
    const r = ops[name](x, y);
    for (const a of pointsOf(x)) {
      for (const b of pointsOf(y)) {
        if (name === "div" && Q.sign(b) === 0) continue;
        if (!holds(r, exact[name](a, b))) return false;
      }
    }
    return true;
  });
}

/** The law of `neg`, `pow` and `root` of intervals. */
export function intervalUnaryLaw(ops: IntervalOps, name: "neg" | "pow" | "root"): fc.IPropertyWithHooks<[readonly [number, number], number]> {
  const arg = name === "pow" ? fc.integer({ min: -6, max: 9 }) : fc.integer({ min: 2, max: 5 });
  return fc.property(name === "neg" ? interval : moderateInterval, arg, (x, n) => {
    const points = pointsOf(x);
    if (x[0] < 0 && x[1] > 0) points.push(Q.ZERO);
    if (name === "neg") return points.every((p) => holds(ops.neg(x), Q.neg(p)));
    if (name === "root") return points.every((p) => holdsRoot(ops.root(x, n), p, n));
    const r = ops.pow(x, n);
    return points.every((p) => {
      const v = exactPow(p, n);
      return v === undefined || holds(r, v);
    });
  });
}

/** The law of a binary operation of balls: the result contains the exact result of each pair of points. */
export function ballBinaryLaw(ops: BallOps, name: Binary, inputs: fc.Arbitrary<Ball> = ball): fc.IPropertyWithHooks<[Ball, Ball]> {
  return fc.property(inputs, inputs, (x, y) => {
    const r = ops[name](x, y);
    for (const a of ballPoints(x)) {
      for (const b of ballPoints(y)) {
        if (name === "div" && Q.sign(b) === 0) continue;
        if (!ballHolds(r, exact[name](a, b))) return false;
      }
    }
    return true;
  });
}

/** The law of `neg`, `pow` and `root` of balls. */
export function ballUnaryLaw(ops: BallOps, name: "neg" | "pow" | "root"): fc.IPropertyWithHooks<[Ball, number]> {
  const arg = name === "pow" ? fc.integer({ min: -6, max: 9 }) : fc.integer({ min: 2, max: 5 });
  return fc.property(name === "neg" ? ball : moderateBall, arg, (x, n) => {
    const points = ballPoints(x);
    if (Q.sign(points[0] as Rational) < 0 && Q.sign(points[2] as Rational) > 0) points.push(Q.ZERO);
    if (name === "neg") return points.every((p) => ballHolds(ops.neg(x), Q.neg(p)));
    if (name === "root") {
      const r = ops.root(x, n);
      return points.every((p) => ballHoldsRoot(r, p, n));
    }
    const r = ops.pow(x, n);
    return points.every((p) => {
      const v = exactPow(p, n);
      return v === undefined || ballHolds(r, v);
    });
  });
}

/** The operations of the package. */
export const INTERVAL_OPS: IntervalOps = I;
export const BALL_OPS: BallOps = B;
