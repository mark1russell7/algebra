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

/**
 * The exact test of a segment against the open inside of a box, by a Liang-Barsky clip in rationals. Each side of
 * the box gives a strict bound on the parameter `t` of the segment, and `t` stays in `[0, 1]`.
 */
export function hitsOpenBox(a: V, b: V, box: { x: number; y: number; w: number; h: number }): boolean {
  const [ax, ay] = pt(a);
  const [bx, by] = pt(b);
  const x0 = fromFloat(box.x);
  const y0 = fromFloat(box.y);
  const x1 = add(x0, fromFloat(box.w));
  const y1 = add(y0, fromFloat(box.h));
  const dx = sub(bx, ax);
  const dy = sub(by, ay);
  // Each constraint is alpha * t + beta > 0.
  const constraints: [Rat, Rat][] = [
    [dx, sub(ax, x0)],
    [rat(-dx.n, dx.d), sub(x1, ax)],
    [dy, sub(ay, y0)],
    [rat(-dy.n, dy.d), sub(y1, ay)],
  ];
  let lo = ZERO;
  let hi = ONE;
  for (const [alpha, beta] of constraints) {
    const s = sign(alpha);
    if (s === 0) {
      if (sign(beta) <= 0) return false;
      continue;
    }
    const t = div(rat(-beta.n, beta.d), alpha);
    if (s > 0 && cmp(t, lo) > 0) lo = t;
    if (s < 0 && cmp(t, hi) < 0) hi = t;
  }
  return cmp(lo, hi) < 0;
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
