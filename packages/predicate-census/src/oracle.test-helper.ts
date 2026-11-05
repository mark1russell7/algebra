/**
 * An exact oracle for the tests: rationals over `bigint` in lowest terms, and the predicates on them. It does not use
 * the dyadic numbers or the sign rules of the package, so it checks them from outside.
 */

/** A rational `n / d` with `d > 0`, in lowest terms. */
export interface Rat {
  readonly n: bigint;
  readonly d: bigint;
}

const abs = (x: bigint): bigint => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function rat(n: bigint, d = 1n): Rat {
  if (d === 0n) throw new RangeError("zero denominator");
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return g > 1n ? { n: n / g, d: d / g } : { n, d };
}

const view = new DataView(new ArrayBuffer(8));

/** The exact rational value of a finite float. */
export function fromFloat(x: number): Rat {
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const e = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const mant = e === 0 ? frac : frac | (1n << 52n);
  const exp = (e === 0 ? 1 : e) - 1075;
  return exp >= 0 ? rat(sign * mant * (1n << BigInt(exp))) : rat(sign * mant, 1n << BigInt(-exp));
}

export const add = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);
export const cmp = (a: Rat, b: Rat): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};
export const sign = (a: Rat): number => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);
const ZERO = rat(0n);
const ONE = rat(1n);

type V = readonly [number, number];
const pt = (p: V): [Rat, Rat] => [fromFloat(p[0]), fromFloat(p[1])];

/** The exact orientation of three float points. */
export function orient(p: V, q: V, r: V): number {
  const [px, py] = pt(p);
  const [qx, qy] = pt(q);
  const [rx, ry] = pt(r);
  return sign(sub(mul(sub(qx, px), sub(ry, py)), mul(sub(qy, py), sub(rx, px))));
}

/** The exact proper crossing of two segments. */
export function crosses(a: V, b: V, c: V, d: V): boolean {
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

const max = (a: Rat, b: Rat): Rat => (cmp(a, b) >= 0 ? a : b);
const min = (a: Rat, b: Rat): Rat => (cmp(a, b) <= 0 ? a : b);

/** This function gives the square of the exact length of the part of the segment in the rectangle, or `null` for no part. */
function clippedLength2(a: V, b: V, x0: Rat, y0: Rat, x1: Rat, y1: Rat): Rat | null {
  const [ax, ay] = pt(a);
  const [bx, by] = pt(b);
  const dx = sub(bx, ax);
  const dy = sub(by, ay);
  let t0 = ZERO;
  let t1 = ONE;
  for (const [d, p, lo, hi] of [
    [dx, ax, x0, x1],
    [dy, ay, y0, y1],
  ] as const) {
    if (sign(d) === 0) {
      if (cmp(p, lo) <= 0 || cmp(p, hi) >= 0) return null;
      continue;
    }
    const ta = div(sub(lo, p), d);
    const tb = div(sub(hi, p), d);
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
    if (cmp(t0, t1) > 0) return null;
  }
  const part = sub(t1, t0);
  return mul(mul(part, part), add(mul(dx, dx), mul(dy, dy)));
}

/**
 * The exact copy of `geom.segmentHitsRect` of highways, in rationals: the Liang-Barsky clip of the segment to the
 * rectangle, and a clipped part longer than `eps`. The length test compares squares, so it needs no square root.
 */
export function hitsRectExact(a: V, b: V, x0: Rat, y0: Rat, x1: Rat, y1: Rat, eps: number): boolean {
  const length2 = clippedLength2(a, b, x0, y0, x1, y1);
  if (length2 === null) return false;
  const e = fromFloat(eps);
  if (sign(e) < 0) return true;
  return cmp(length2, mul(e, e)) > 0;
}

/** This function tells if the exact part of the segment in the box has a length of exactly `eps`. */
export function clippedLengthIsEps(a: V, b: V, box: { x: number; y: number; w: number; h: number }, eps: number): boolean {
  const x0 = fromFloat(box.x);
  const y0 = fromFloat(box.y);
  const length2 = clippedLength2(a, b, x0, y0, add(x0, fromFloat(box.w)), add(y0, fromFloat(box.h)));
  const e = fromFloat(eps);
  return length2 !== null && cmp(length2, mul(e, e)) === 0;
}

/** The exact copy of `geom.segmentHitsRect` for a rectangle `[x0, y0, x1, y1]` of floats. */
export function hitsRect(a: V, b: V, rect: readonly [number, number, number, number], eps = 0): boolean {
  return hitsRectExact(a, b, fromFloat(rect[0]), fromFloat(rect[1]), fromFloat(rect[2]), fromFloat(rect[3]), eps);
}

/** The exact copy of `geom.segmentHitsBox`, with the exact sums `x + w` and `y + h` as the far corner. */
export function hitsBox(a: V, b: V, box: { x: number; y: number; w: number; h: number }, eps = 0): boolean {
  const x0 = fromFloat(box.x);
  const y0 = fromFloat(box.y);
  return hitsRectExact(a, b, x0, y0, add(x0, fromFloat(box.w)), add(y0, fromFloat(box.h)), eps);
}

/** The exact overlap of two boxes: the margin minus `eps` is positive on each axis. */
export function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, eps = 0): boolean {
  const margin = (p: number, pw: number, q: number, qw: number): Rat => {
    const pe = add(fromFloat(p), fromFloat(pw));
    const qe = add(fromFloat(q), fromFloat(qw));
    const end = cmp(pe, qe) <= 0 ? pe : qe;
    const start = cmp(fromFloat(p), fromFloat(q)) >= 0 ? fromFloat(p) : fromFloat(q);
    return sub(sub(end, start), fromFloat(eps));
  };
  return sign(margin(a.x, a.w, b.x, b.w)) > 0 && sign(margin(a.y, a.h, b.y, b.h)) > 0;
}

/** A box of packing: its left, top, right and bottom edges. */
export interface Edges {
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
}

/** The exact overlap of two boxes of packing: the exact margin of each axis is larger than the float tolerance. */
export function edgesOverlap(a: Edges, b: Edges, tolerance: number): boolean {
  const margin = (lo1: number, hi1: number, lo2: number, hi2: number): Rat => {
    const end = cmp(fromFloat(hi1), fromFloat(hi2)) <= 0 ? fromFloat(hi1) : fromFloat(hi2);
    const start = cmp(fromFloat(lo1), fromFloat(lo2)) >= 0 ? fromFloat(lo1) : fromFloat(lo2);
    return sub(end, start);
  };
  const tol = fromFloat(tolerance);
  return cmp(margin(a.l, a.r, b.l, b.r), tol) > 0 && cmp(margin(a.t, a.b, b.t, b.b), tol) > 0;
}

/** The exact container test of packing: the box goes out of a fixed side by more than the tolerance. */
export function outOfContainer(o: {
  box: Edges;
  x: number;
  y: number;
  w: number;
  h: number;
  inset: number;
  tolerance: number;
  fixedW: boolean;
  fixedH: boolean;
}): boolean {
  const f = fromFloat;
  const [x, y, w, h, inset, tol] = [f(o.x), f(o.y), f(o.w), f(o.h), f(o.inset), f(o.tolerance)];
  const below = (edge: number, side: Rat): boolean => cmp(f(edge), side) < 0;
  const above = (edge: number, side: Rat): boolean => cmp(f(edge), side) > 0;
  const outX = o.fixedW && (below(o.box.l, sub(add(x, inset), tol)) || above(o.box.r, add(sub(add(x, w), inset), tol)));
  const outY = o.fixedH && (below(o.box.t, sub(add(y, inset), tol)) || above(o.box.b, add(sub(add(y, h), inset), tol)));
  return outX || outY;
}
