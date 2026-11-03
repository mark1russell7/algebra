/**
 * The seeded corpus of the property tests and the rational oracle. The corpus has random inputs, near-degenerate inputs
 * by ulp steps around a line or a circle, exact ties, and tiny and huge scales.
 */
import { interval, random } from "@mark1russell7/expression";
import type { Random } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/** The environment of the process. This file is also in the source build, which has no types of Node. */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** The count of points of each family. The variable `PROPERTY_RUNS` sets it. The default is 1000. */
export const RUNS: number = Number(env["PROPERTY_RUNS"] ?? 1000);

export type Six = [number, number, number, number, number, number];
export type Eight = [number, number, number, number, number, number, number, number];

/** The families. The family `scale` is out of the agreement corpus, because robust-predicates can underflow there. */
export type Family = "random" | "grid" | "near" | "ties" | "scale";
export const FAMILIES: readonly Family[] = ["random", "grid", "near", "ties", "scale"];

/** This function moves a float by `k` steps of one ulp. */
export function moveUlps(x: number, k: number): number {
  let y = x;
  for (let i = 0; i < Math.abs(k); i++) y = k > 0 ? interval.nextUp(y) : interval.nextDown(y);
  return y;
}

const uniform = (rnd: Random, lo: number, hi: number): number => lo + (hi - lo) * rnd();
const int = (rnd: Random, lo: number, hi: number): number => Math.floor(uniform(rnd, lo, hi + 1));
const ulpStep = (rnd: Random, x: number, max = 3): number => moveUlps(x, int(rnd, -max, max));
const pick = <T>(rnd: Random, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;

/** A random coordinate of `[-1, 1)` times a power of two of `{1, 2^10, 2^20}`. */
const coordinate = (rnd: Random, scale: number): number => uniform(rnd, -1, 1) * scale;
const SCALES = [1, 2 ** 10, 2 ** 20];
/** The tiny and huge factors of the family `scale`: subnormal, small, large and near the overflow of a product. */
const EXTREME = [2 ** -1074, 2 ** -1060, 2 ** -1000, 2 ** -540, 2 ** -250, 2 ** 250, 2 ** 500, 2 ** 1000];

/** A point near the line `ab`: the float of `a + t (b - a)`, then a few ulps on each axis. */
function nearLine(rnd: Random, ax: number, ay: number, bx: number, by: number): [number, number] {
  const t = pick(rnd, [rnd(), uniform(rnd, -2, 3), 0, 1, 0.5]);
  return [ulpStep(rnd, ax + t * (bx - ax)), ulpStep(rnd, ay + t * (by - ay))];
}

/** This function gives one input of the orientation for a family. */
export function orientInput(family: Family, rnd: Random): Six {
  switch (family) {
    case "random": {
      const s = pick(rnd, SCALES);
      return [coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s)];
    }
    case "grid":
      return [int(rnd, -4, 4), int(rnd, -4, 4), int(rnd, -4, 4), int(rnd, -4, 4), int(rnd, -4, 4), int(rnd, -4, 4)];
    case "near": {
      const s = pick(rnd, SCALES);
      const [ax, ay, bx, by] = [coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s)];
      // The classic case of Kettner and others: points near the diagonal of the square at 0.5.
      if (rnd() < 0.25) return [ulpStep(rnd, 0.5, 8), ulpStep(rnd, 0.5, 8), 12, 12, 24, 24];
      const [cx, cy] = nearLine(rnd, ax, ay, bx, by);
      const order = int(rnd, 0, 2);
      return order === 0 ? [ax, ay, bx, by, cx, cy] : order === 1 ? [cx, cy, ax, ay, bx, by] : [bx, by, cx, cy, ax, ay];
    }
    case "ties": {
      // Repeated points, axis lines and exact collinear dyadic points.
      const x = coordinate(rnd, 8);
      const y = coordinate(rnd, 8);
      const k = int(rnd, 0, 3);
      if (k === 0) return [x, y, x, y, coordinate(rnd, 8), coordinate(rnd, 8)];
      if (k === 1) return [x, y, coordinate(rnd, 8), y, coordinate(rnd, 8), y];
      if (k === 2) return [x, y, x, coordinate(rnd, 8), x, coordinate(rnd, 8)];
      const [dx, dy] = [int(rnd, -8, 8) / 4, int(rnd, -8, 8) / 4];
      return [x, y, x + dx, y + dy, x + 2 * dx, y + 2 * dy];
    }
    case "scale": {
      const f = pick(rnd, EXTREME);
      return orientInput(pick(rnd, ["random", "near", "ties"] as const), rnd).map((v) => v * f) as Six;
    }
  }
}

/** A point of the circle with the center `(x, y)` and the radius `r`, as floats. */
function onCircle(rnd: Random, x: number, y: number, r: number): [number, number] {
  const a = rnd() * 2 * Math.PI;
  return [x + r * Math.cos(a), y + r * Math.sin(a)];
}

/** This function gives one input of the in-circle test for a family. */
export function incircleInput(family: Family, rnd: Random): Eight {
  switch (family) {
    case "random": {
      const s = pick(rnd, SCALES);
      return Array.from({ length: 8 }, () => coordinate(rnd, s)) as Eight;
    }
    case "grid":
      return Array.from({ length: 8 }, () => int(rnd, -3, 3)) as Eight;
    case "near": {
      const s = pick(rnd, SCALES);
      const [x, y, r] = [coordinate(rnd, s), coordinate(rnd, s), uniform(rnd, 0.1, 1) * s];
      const [a, b, c] = [onCircle(rnd, x, y, r), onCircle(rnd, x, y, r), onCircle(rnd, x, y, r)];
      const d = onCircle(rnd, x, y, r);
      return [...a, ...b, ...c, ulpStep(rnd, d[0]), ulpStep(rnd, d[1])];
    }
    case "ties": {
      // The corners of an axis box are on one circle. Repeated points and points on one line give 0 too.
      const [x0, y0, x1, y1] = [coordinate(rnd, 8), coordinate(rnd, 8), coordinate(rnd, 8), coordinate(rnd, 8)];
      const k = int(rnd, 0, 2);
      if (k === 0) {
        const box: Eight = [x0, y0, x1, y0, x1, y1, x0, y1];
        const i = int(rnd, 0, 7);
        box[i] = ulpStep(rnd, box[i] as number, 2);
        return box;
      }
      if (k === 1) return [x0, y0, x1, y1, x0, y0, coordinate(rnd, 8), coordinate(rnd, 8)];
      return [x0, y0, x0 + 1, y0 + 2, x0 + 2, y0 + 4, x1, y1];
    }
    case "scale": {
      const f = pick(rnd, EXTREME);
      return incircleInput(pick(rnd, ["random", "near", "ties"] as const), rnd).map((v) => v * f) as Eight;
    }
  }
}

/** This function gives one input of the segment intersection for a family: the points `a`, `b`, `c` and `d`. */
export function segmentInput(family: Family, rnd: Random): Eight {
  switch (family) {
    case "random":
      return incircleInput("random", rnd);
    case "grid":
      return Array.from({ length: 8 }, () => int(rnd, -2, 2)) as Eight;
    case "near": {
      // The end c is near the segment ab, and d is anywhere. Or the two segments share an end, moved by ulps.
      const s = pick(rnd, SCALES);
      const [ax, ay, bx, by] = [coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s), coordinate(rnd, s)];
      if (rnd() < 0.3) return [ax, ay, bx, by, ulpStep(rnd, bx), ulpStep(rnd, by), coordinate(rnd, s), coordinate(rnd, s)];
      const [cx, cy] = nearLine(rnd, ax, ay, bx, by);
      return [ax, ay, bx, by, cx, cy, coordinate(rnd, s), coordinate(rnd, s)];
    }
    case "ties": {
      // Collinear segments on an axis or a diagonal: overlap, touch at an end, or disjoint. Also points as segments.
      const t = Array.from({ length: 4 }, () => int(rnd, -4, 4) / 2);
      const [x, y] = [coordinate(rnd, 4), coordinate(rnd, 4)];
      const k = int(rnd, 0, 3);
      const [t0, t1, t2, t3] = t as [number, number, number, number];
      if (k === 0) return [x + t0, y, x + t1, y, x + t2, y, x + t3, y];
      if (k === 1) return [x, y + t0, x, y + t1, x, y + t2, x, y + t3];
      if (k === 2) return [t0, t0, t1, t1, t2, t2, t3, t3];
      return [x, y, x, y, x + t0, y + t0, x - t1, y - t1];
    }
    case "scale": {
      const f = pick(rnd, EXTREME);
      return segmentInput(pick(rnd, ["random", "near", "ties"] as const), rnd).map((v) => v * f) as Eight;
    }
  }
}

/** This function gives the points of a family, with a seed of the family name. */
export function points<T>(family: Family, seed: number, make: (family: Family, rnd: Random) => T, count: number = RUNS): T[] {
  const rnd = random(seed * 31 + FAMILIES.indexOf(family));
  return Array.from({ length: count }, () => make(family, rnd));
}

// The oracle: the rationals of @mark1russell7/rational. They share no code with the dyadic numbers.
const F = Q.fromFloat;

/** The exact orientation sign by the rational oracle. */
export function orientOracle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): -1 | 0 | 1 {
  const acx = Q.sub(F(ax), F(cx));
  const bcx = Q.sub(F(bx), F(cx));
  const acy = Q.sub(F(ay), F(cy));
  const bcy = Q.sub(F(by), F(cy));
  return Q.sign(Q.sub(Q.mul(acx, bcy), Q.mul(acy, bcx)));
}

/** The exact in-circle sign by the rational oracle, from the 3 by 3 determinant of the lifted points. */
export function incircleOracle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): -1 | 0 | 1 {
  const row = (x: number, y: number): [Rational, Rational, Rational] => {
    const u = Q.sub(F(x), F(dx));
    const v = Q.sub(F(y), F(dy));
    return [u, v, Q.add(Q.mul(u, u), Q.mul(v, v))];
  };
  const [[a1, a2, a3], [b1, b2, b3], [c1, c2, c3]] = [row(ax, ay), row(bx, by), row(cx, cy)];
  const m = (p: Rational, q: Rational, r: Rational, s: Rational): Rational => Q.sub(Q.mul(p, q), Q.mul(r, s));
  const det = Q.add(Q.sub(Q.mul(a1, m(b2, c3, b3, c2)), Q.mul(a2, m(b1, c3, b3, c1))), Q.mul(a3, m(b1, c2, b2, c1)));
  return Q.sign(det);
}

/** The relation of two closed segments by the rational oracle, from the parameters of the common points. */
type Pt = [Rational, Rational];

export function segmentOracle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): { relation: string; collinear: boolean } {
  const [A, B, C, D] = [
    [F(ax), F(ay)],
    [F(bx), F(by)],
    [F(cx), F(cy)],
    [F(dx), F(dy)],
  ] as [Pt, Pt, Pt, Pt];
  const sub = (p: [Rational, Rational], q: [Rational, Rational]): [Rational, Rational] => [Q.sub(p[0], q[0]), Q.sub(p[1], q[1])];
  const crossQ = (p: [Rational, Rational], q: [Rational, Rational]): Rational => Q.sub(Q.mul(p[0], q[1]), Q.mul(p[1], q[0]));
  const dot = (p: [Rational, Rational], q: [Rational, Rational]): Rational => Q.add(Q.mul(p[0], q[0]), Q.mul(p[1], q[1]));
  const same = (p: [Rational, Rational], q: [Rational, Rational]): boolean => Q.equals(p[0], q[0]) && Q.equals(p[1], q[1]);
  const r = sub(B, A);
  const s = sub(D, C);
  const collinear = [crossQ(r, sub(C, A)), crossQ(r, sub(D, A)), crossQ(s, sub(A, C)), crossQ(s, sub(B, C))].every((x) => Q.sign(x) === 0);
  const zero = Q.rational(0n);
  const one = Q.rational(1n);
  const inside = (t: Rational): number => (Q.compare(t, zero) < 0 || Q.compare(t, one) > 0 ? 0 : Q.compare(t, zero) === 0 || Q.compare(t, one) === 0 ? 1 : 2);
  // A point as a segment.
  const pointOn = (p: [Rational, Rational], q0: [Rational, Rational], q1: [Rational, Rational]): boolean => {
    if (same(q0, q1)) return same(p, q0);
    const d = sub(q1, q0);
    if (Q.sign(crossQ(d, sub(p, q0))) !== 0) return false;
    return inside(Q.div(dot(sub(p, q0), d), dot(d, d))) > 0;
  };
  if (same(A, B)) return { relation: pointOn(A, C, D) ? "touch" : "disjoint", collinear };
  if (same(C, D)) return { relation: pointOn(C, A, B) ? "touch" : "disjoint", collinear };
  const den = crossQ(r, s);
  if (Q.sign(den) === 0) {
    if (!collinear) return { relation: "disjoint", collinear };
    // The parameters of c and d along ab.
    const rr = dot(r, r);
    const t0 = Q.div(dot(sub(C, A), r), rr);
    const t1 = Q.div(dot(sub(D, A), r), rr);
    const [lo, hi] = Q.compare(t0, t1) <= 0 ? [t0, t1] : [t1, t0];
    const from = Q.compare(lo, zero) >= 0 ? lo : zero;
    const to = Q.compare(hi, one) <= 0 ? hi : one;
    const order = Q.compare(from, to);
    return { relation: order < 0 ? "overlap" : order === 0 ? "touch" : "disjoint", collinear };
  }
  const qp = sub(C, A);
  const t = Q.div(crossQ(qp, s), den);
  const u = Q.div(crossQ(qp, r), den);
  const [it, iu] = [inside(t), inside(u)];
  if (it === 0 || iu === 0) return { relation: "disjoint", collinear };
  return { relation: it === 2 && iu === 2 ? "cross" : "touch", collinear };
}

/** One of the 42 real records of the A13 census: the float-wrong inputs of highways. */
export interface NearMiss {
  readonly fn: string;
  readonly predicate: "segmentPair" | "segmentBox" | "pointSide";
  readonly input: Readonly<Record<string, unknown>>;
  readonly exactAnswer: boolean | number;
}
