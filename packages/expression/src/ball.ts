/**
 * The ball evaluator of the expression kinds (roadmap item A4). A ball is a float midpoint and a float radius. The
 * verb `ball` compiles a document one time into a tree of closures, as the verb `float` does. Each call gives a ball.
 *
 * The rules are the "midrad" arithmetic of Rump and of Arb. The midpoint of each node is the float value of A3: the
 * same operations in the same order. The radius of each node is the propagated radius of the parts plus the error of
 * the rounding of the midpoint. Each operation of the radius rounds upward.
 *
 * A finite radius is a claim. The expression has a real value at each point of the input balls, and that value is at
 * most the radius from the midpoint. A radius of `Infinity` makes no claim. The radius rounds upward by one float step
 * only when its float operation is not exact, so an exact result has the radius zero.
 *
 * Proof sketch of the bound. Let the exact inputs of an operation be `X = a + dx` and `Y = b + dy`, with `|dx| <= ra`
 * and `|dy| <= rb`. Let `m` be the float result and `e` the error of its rounding.
 *
 * - A sum: `X + Y - m = e + dx + dy`, so `ra + rb + |e|` is a radius. `TwoSum` gives `e` exactly.
 * - A product: `XY - m = e + a dy + b dx + dx dy`, so `|a| rb + |b| ra + ra rb + |e|` is a radius. `TwoProduct`
 *   gives `e` exactly away from overflow and underflow. Else `u |m| + 2^-1074` bounds `|e|`.
 * - A quotient, with `rb < |b|` so that `Y` is not zero: `X / Y - a / b = (b dx - a dy) / (b Y)`, and
 *   `|b Y| >= |b| (|b| - rb)`. So `(ra + |a / b| rb) / (|b| - rb) + |e|` is a radius. Else the radius is `Infinity`.
 * - The smallest and the largest move at most by the largest radius of a part. `min` and `max` are 1-Lipschitz in
 *   the largest distance. When the two balls do not meet, the extreme is one of them, so its radius is enough.
 * - A root goes through `interval.root` of `[m - r, m + r]`, rounded outward. The radius is the largest distance from
 *   the midpoint to an end. An even root of a ball that holds a negative value has the radius `Infinity`.
 * - A comparison is decided when the outward intervals of the two balls decide it. The midpoint is then the truth
 *   value and the radius is zero. Else the radius is one, as the bound of A3.
 *
 * Each float operation of the radius rounds upward. A sum and a product use the sign of their exact error term. A
 * quotient moves one step when it is not exact. The difference of the denominator moves one step downward.
 *
 * @packageDocumentation
 */
import { floatRoot } from "./float.ts";
import * as I from "./interval.ts";
import type { KindName, NodeData } from "./summary.ts";

/** A ball: the reals at most `rad` from `mid`. */
export interface Ball {
  /** The midpoint. */
  readonly mid: number;
  /** The radius. `Infinity` makes no claim. */
  readonly rad: number;
}

/** The value of a variable for the verb `ball`: a number, which is a ball of radius zero, or a ball. */
export type BallInput = number | Ball;

/** The code of one node: a function of the values of the variables. It gives the midpoint. */
export type BallRun = (values: ArrayLike<BallInput>) => number;

/**
 * The compiled code of one node. After each call of `run`, the field `rad` holds the radius of the ball whose midpoint
 * `run` gave.
 */
export interface BallCell {
  readonly run: BallRun;
  readonly rad: number;
}

/** The writable form of a cell, inside this module. */
interface Cell {
  run: BallRun;
  rad: number;
}

const cell = (): Cell => ({ run: () => Number.NaN, rad: Infinity });

const U = 2 ** -53;
const MIN = Number.MIN_VALUE;

/** The sum of two nonnegative floats, rounded upward. */
function addUp(x: number, y: number): number {
  const s = x + y;
  return I.sumError(x, y, s) <= 0 ? s : I.nextUp(s);
}

/** The product of two nonnegative floats, rounded upward. */
function mulUp(x: number, y: number): number {
  const p = x * y;
  return I.productError(x, y, p) <= 0 ? p : I.nextUp(p);
}

/** The quotient of two nonnegative floats, rounded upward. A correctly rounded quotient is at most one step low. */
function divUp(x: number, y: number): number {
  const q = x / y;
  return x === 0 || I.quotientIsExact(x, y, q) ? q : I.nextUp(q);
}

/** The difference `x - y` of two nonnegative floats, rounded downward. */
function subDown(x: number, y: number): number {
  const s = x - y;
  return I.sumError(x, -y, s) >= 0 ? s : I.nextDown(s);
}

/** This function gives a bound of `|e|` from an exact error term `e`, or from `u |m| + 2^-1074` when `e` is `NaN`. */
function rounding(e: number, m: number): number {
  return e === e ? Math.abs(e) : addUp(mulUp(U, Math.abs(m)), MIN);
}

/** This function gives the radius `Infinity`, which makes no claim, when the midpoint is not finite or the radius is `NaN`. */
const claim = (m: number, r: number): number => (m - m === 0 && r <= Infinity ? r : Infinity);

/** The outward interval `[m - r, m + r]` of a ball. */
const spanOf = (m: number, r: number): I.Interval => I.add([m, m], [-r, r]);

/**
 * This function compiles a number literal. A literal is the exact binary value of its float, so its radius is zero.
 *
 * @param value - The finite float of the literal.
 * @returns The cell of the literal.
 */
export function ballNum(value: number): BallCell {
  return { run: () => value, rad: 0 };
}

/**
 * This function compiles a variable. A finite number has the radius zero. A number that is not finite has no real
 * value, so its radius is `Infinity`. A ball with a negative or `NaN` radius is not a ball.
 *
 * @param index - The position of the variable in the values of a call.
 * @returns The cell of the variable.
 */
export function ballVar(index: number): BallCell {
  const out = cell();
  out.run = (values) => {
    const v = values[index] as BallInput;
    if (typeof v === "number") {
      out.rad = v - v === 0 ? 0 : Infinity;
      return v;
    }
    if (!(v.rad >= 0)) throw new RangeError(`The radius of a ball must be 0 or more, not ${v.rad}.`);
    out.rad = claim(v.mid, v.rad);
    return v.mid;
  };
  return out;
}

/** The radius of a sum `m = fl(a + b)`. */
function sumRad(m: number, a: number, ra: number, b: number, rb: number): number {
  return claim(m, addUp(addUp(ra, rb), rounding(I.sumError(a, b, m), m)));
}

/** The radius of a product `m = fl(a * b)`. */
function mulRad(m: number, a: number, ra: number, b: number, rb: number): number {
  const spread = addUp(addUp(mulUp(Math.abs(a), rb), mulUp(Math.abs(b), ra)), mulUp(ra, rb));
  return claim(m, addUp(spread, rounding(I.productError(a, b, m), m)));
}

/** The radius of a quotient `q = fl(a / b)`. It is `Infinity` when the ball of the divisor can hold zero. */
function divRad(q: number, a: number, ra: number, b: number, rb: number): number {
  const m = Math.abs(b);
  if (!(rb < m) || !(q - q === 0)) return Infinity;
  const ratio = q === 0 ? 0 : I.nextUp(Math.abs(q));
  const spread = divUp(addUp(ra, mulUp(ratio, rb)), subDown(m, rb));
  const e = I.quotientIsExact(a, b, q) ? 0 : addUp(mulUp(U, Math.abs(q)), MIN);
  return claim(q, addUp(spread, e));
}

function sumCell(parts: readonly BallCell[]): BallCell {
  const out = cell();
  out.run = (values) => {
    let v = (parts[0] as BallCell).run(values);
    let r = (parts[0] as BallCell).rad;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as BallCell;
      const w = p.run(values);
      const s = v + w;
      r = sumRad(s, v, r, w, p.rad);
      v = s;
    }
    out.rad = r;
    return v;
  };
  return out;
}

function subCell(a: BallCell, b: BallCell): BallCell {
  const out = cell();
  out.run = (values) => {
    const va = a.run(values);
    const ra = a.rad;
    const vb = b.run(values);
    const v = va - vb;
    out.rad = sumRad(v, va, ra, -vb, b.rad);
    return v;
  };
  return out;
}

function productCell(parts: readonly BallCell[]): BallCell {
  const out = cell();
  out.run = (values) => {
    let v = (parts[0] as BallCell).run(values);
    let r = (parts[0] as BallCell).rad;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as BallCell;
      const w = p.run(values);
      const m = v * w;
      r = mulRad(m, v, r, w, p.rad);
      v = m;
    }
    out.rad = r;
    return v;
  };
  return out;
}

function quotientCell(a: BallCell, b: BallCell): BallCell {
  const out = cell();
  out.run = (values) => {
    const va = a.run(values);
    const ra = a.rad;
    const vb = b.run(values);
    const v = va / vb;
    out.rad = divRad(v, va, ra, vb, b.rad);
    return v;
  };
  return out;
}

function negCell(a: BallCell): BallCell {
  const out = cell();
  out.run = (values) => {
    const v = -a.run(values);
    out.rad = a.rad;
    return v;
  };
  return out;
}

/**
 * This function gives the radius of the largest (`sign = 1`) or the smallest (`sign = -1`) of two balls. When the
 * outward intervals of the balls do not meet, the extreme is one ball, and its radius is the radius. Else the radius
 * is the larger radius.
 */
function extremeRad(sign: 1 | -1, a: number, ra: number, b: number, rb: number): number {
  const sa = spanOf(sign * a, ra) as readonly [number, number];
  const sb = spanOf(sign * b, rb) as readonly [number, number];
  if (sa[0] >= sb[1]) return ra;
  if (sb[0] >= sa[1]) return rb;
  return Math.max(ra, rb);
}

function extremeCell(parts: readonly BallCell[], sign: 1 | -1): BallCell {
  const out = cell();
  const pick = sign === 1 ? Math.max : Math.min;
  out.run = (values) => {
    let v = (parts[0] as BallCell).run(values);
    let r = (parts[0] as BallCell).rad;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as BallCell;
      const w = p.run(values);
      r = extremeRad(sign, v, r, w, p.rad);
      v = pick(v, w);
    }
    out.rad = claim(v, r);
    return v;
  };
  return out;
}

/**
 * This function compiles a whole power with the repeated squares of A3. Each product uses the rule of `mul`. A negative
 * power is the quotient of one by the positive power. The power zero gives one, with the radius zero when the base
 * makes a claim.
 */
function powCell(base: BallCell, exp: number): BallCell {
  const out = cell();
  const n = Math.abs(exp);
  out.run = (values) => {
    let bv = base.run(values);
    let br = base.rad;
    if (n === 0) {
      out.rad = br < Infinity ? 0 : Infinity;
      return 1;
    }
    let rv = 1;
    let rr = 0;
    let first = true;
    for (let k = n; k > 0; k = Math.floor(k / 2)) {
      if (k % 2 === 1) {
        if (first) {
          rv = bv;
          rr = br;
          first = false;
        } else {
          const m = rv * bv;
          rr = mulRad(m, rv, rr, bv, br);
          rv = m;
        }
      }
      if (k > 1) {
        const s = bv * bv;
        br = mulRad(s, bv, br, bv, br);
        bv = s;
      }
    }
    if (exp > 0) {
      out.rad = rr;
      return rv;
    }
    const v = 1 / rv;
    out.rad = divRad(v, 1, 0, rv, rr);
    return v;
  };
  return out;
}

/** This function compiles a root. The radius comes from `interval.root` of the input ball, by the rule of A3. */
function rootCell(radicand: BallCell, k: number): BallCell {
  const out = cell();
  out.run = (values) => {
    const r = radicand.run(values);
    const v = floatRoot(r, k);
    const rr = radicand.rad;
    out.rad = !(rr < Infinity) || !(v - v === 0) ? Infinity : radiusOf(v, I.add([r, r], [-rr, rr]), k);
    return v;
  };
  return out;
}

/** This function gives the largest distance from `v` to an end of the outward root of `span`, rounded upward. */
function radiusOf(v: number, span: I.Interval, k: number): number {
  if (span === null || (k % 2 === 0 && span[0] < 0)) return Infinity;
  const d = I.sub([v, v], I.root(span, k));
  return d === null ? Infinity : claim(v, Math.max(-d[0], d[1]));
}

function comparisonCell(kind: "lt" | "le" | "eq", a: BallCell, b: BallCell): BallCell {
  const out = cell();
  out.run = (values) => {
    const va = a.run(values);
    const ra = a.rad;
    const vb = b.run(values);
    const rb = b.rad;
    if (!(ra < Infinity && rb < Infinity)) {
      out.rad = Infinity;
      return Number.NaN;
    }
    const truth = I[kind](spanOf(va, ra), spanOf(vb, rb)) as readonly [number, number];
    const decided = truth[0] === truth[1];
    out.rad = decided ? 0 : 1;
    return decided ? truth[0] : (kind === "lt" ? va < vb : kind === "le" ? va <= vb : va === vb) ? 1 : 0;
  };
  return out;
}

/**
 * This function compiles one node from the cells of its parts. It is the rule of each kind for the verb `ball`, as
 * `floatNode` is the rule of each kind for the verb `float`. A list of parts folds from the left.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The cells of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The cell of the node.
 */
export function ballNode(kind: KindName, parts: readonly BallCell[], data: NodeData = {}): BallCell {
  const [a, b] = parts as readonly [BallCell, BallCell];
  if (parts.length === 0) throw new RangeError(`The kind ${kind} needs one part or more.`);
  switch (kind) {
    case "add":
      return sumCell(parts);
    case "sub":
      return subCell(a, b);
    case "mul":
      return productCell(parts);
    case "div":
      return quotientCell(a, b);
    case "neg":
      return negCell(a);
    case "min":
      return extremeCell(parts, -1);
    case "max":
      return extremeCell(parts, 1);
    case "pow":
      return powCell(a, data.exp as number);
    case "root":
      return rootCell(a, data.index as number);
    case "lt":
    case "le":
    case "eq":
      return comparisonCell(kind, a, b);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use ballNum or ballVar.`);
  }
}

/** A truth value of a comparison: `true`, `false`, or `"undecided"` when the evaluator cannot tell. */
export type Truth = boolean | "undecided";

/**
 * This function gives the truth value of a ball of a comparison. A radius of zero decides it.
 *
 * @param ball - The result of a comparison document.
 * @returns `true` for the midpoint `1`, `false` for `0`, and `"undecided"` for a radius above zero.
 */
export function decideBall(ball: Ball): Truth {
  return ball.rad === 0 ? ball.mid === 1 : "undecided";
}
