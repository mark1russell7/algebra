/**
 * The float evaluator of the expression kinds (roadmap item A3). The verb `float` compiles a document one time into a
 * tree of closures. Each call of the tree gives a float value and a bound of its rounding error. The tree has no `eval`
 * and no `new Function`.
 *
 * The bound is a running forward bound (Higham, chapter 3). Let `u = 2^-53`, the unit roundoff. Each rounded
 * operation adds `u * |v|` for its result `v`, and a small term for underflow. The error of each input goes through the
 * operation by its own rule. The bound is itself a float sum, so each node increases it by the factor `1 + 2^-40` and
 * the term `2^-1022`. This step makes the float bound larger than the real bound.
 *
 * A finite bound is a claim. The expression has a real value at the point, and the float value is at most the bound
 * from it. An infinite bound makes no claim.
 *
 * @packageDocumentation
 */
import * as I from "./interval.ts";
import type { KindName, NodeData } from "./summary.ts";

/** The unit roundoff of a float: `2^-53`. */
export const UNIT_ROUNDOFF: number = 2 ** -53;

const U = UNIT_ROUNDOFF;
const MIN = Number.MIN_VALUE;
const NORMAL = 2 ** -1022;
/** The factor that makes a float sum of the terms of a bound larger than the real sum. It is more than `(1 + u)^64`. */
const GROW = 1 + 2 ** -40;

/** The code of one node: a function of the values of the variables, in the order of the compilation. */
export type FloatRun = (values: ArrayLike<number>) => number;

/**
 * The compiled code of one node. After each call of `run`, the field `error` holds the bound of the error of the value
 * that `run` gave.
 */
export interface FloatCell {
  readonly run: FloatRun;
  readonly error: number;
}

/** The writable form of a cell, inside this module. */
interface Cell {
  run: FloatRun;
  error: number;
}

const cell = (): Cell => ({ run: () => Number.NaN, error: Infinity });

/** The result of a call of a compiled document: the float value and the bound of its error. */
export interface FloatResult {
  /** The float value. A comparison gives `1` for true and `0` for false. */
  readonly value: number;
  /**
   * The bound of `|value - exact|`. `Infinity` makes no claim. For a comparison, `0` tells that the bound decides the
   * truth value, and `1` tells that it does not.
   */
  readonly error: number;
}

/**
 * The product of two nonnegative floats, rounded and then made larger by the smallest float. The result is at least
 * `x * y / (1 + u)^2`, also when the product underflows.
 */
export const mulUp = (x: number, y: number): number => x * y + MIN;

/** The quotient of two nonnegative floats, with the same rule as `mulUp`. */
export const divUp = (x: number, y: number): number => x / y + MIN;

/**
 * This function closes the bound of one rounded operation. The propagated term `p` is a float sum of nonnegative terms.
 * The function adds the rounding of the operation, `u * |v|`, and the underflow terms. Then it multiplies by `GROW`.
 * A value that is not finite and a bound that is not a number give `Infinity`.
 *
 * Proof sketch: each float operation on nonnegative floats is at least its real result divided by `1 + u`. The terms
 * `MIN` of `mulUp` and `divUp` cover the underflow of a product or a quotient. A node has fewer than 64 such operations
 * in a chain. The term `NORMAL` keeps the sum out of the subnormal range, so the multiplication by `GROW` is relative.
 *
 * @param v - The rounded result of the operation.
 * @param p - The bound of the error that comes from the inputs.
 * @returns The bound of `|v - exact|`.
 */
export function close(v: number, p: number): number {
  const b = (p + mulUp(U, Math.abs(v)) + NORMAL) * GROW;
  return b <= Infinity ? b : Infinity;
}

/**
 * This function gives the bound of a rounded product `v = fl(a * b)`. The real product of the exact inputs `A` and `B`
 * differs from `a * b` by at most `|a| eb + |b| ea + ea eb`.
 */
function mulError(v: number, a: number, ea: number, b: number, eb: number): number {
  return close(v, mulUp(Math.abs(a), eb) + mulUp(Math.abs(b), ea) + mulUp(ea, eb));
}

/**
 * This function gives the bound of a rounded quotient `v = fl(a / b)`. When `eb < |b|`, the exact divisor `B` is not
 * zero, and `|a / b - A / B| <= (|a / b| eb + ea) / (|b| - eb)`. Else the divisor can be zero, and the bound is
 * `Infinity`. The term `|v| + MIN` is an upper bound of `|a / b| / (1 + u)`.
 */
function divError(v: number, ea: number, b: number, eb: number): number {
  const m = Math.abs(b);
  if (!(eb < m)) return Infinity;
  return close(v, divUp(mulUp(Math.abs(v) + MIN, eb) + ea, m - eb));
}

/**
 * This function compiles a number literal. A literal is the exact binary value of its float, so its error is zero.
 *
 * @param value - The finite float of the literal.
 * @returns The cell of the literal.
 */
export function floatNum(value: number): FloatCell {
  return { run: () => value, error: 0 };
}

/**
 * This function compiles a variable. A finite value of a variable is exact. A value that is not finite has no real
 * value, so its bound is `Infinity`.
 *
 * @param index - The position of the variable in the values of a call.
 * @returns The cell of the variable.
 */
export function floatVar(index: number): FloatCell {
  const out = cell();
  out.run = (values) => {
    const v = values[index] as number;
    out.error = v - v === 0 ? 0 : Infinity;
    return v;
  };
  return out;
}

function sumCell(parts: readonly FloatCell[]): FloatCell {
  const out = cell();
  out.run = (values) => {
    let v = (parts[0] as FloatCell).run(values);
    let e = (parts[0] as FloatCell).error;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as FloatCell;
      const s = v + p.run(values);
      e = close(s, e + p.error);
      v = s;
    }
    out.error = e;
    return v;
  };
  return out;
}

function subCell(a: FloatCell, b: FloatCell): FloatCell {
  const out = cell();
  out.run = (values) => {
    const va = a.run(values);
    const ea = a.error;
    const v = va - b.run(values);
    out.error = close(v, ea + b.error);
    return v;
  };
  return out;
}

function productCell(parts: readonly FloatCell[]): FloatCell {
  const out = cell();
  out.run = (values) => {
    let v = (parts[0] as FloatCell).run(values);
    let e = (parts[0] as FloatCell).error;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as FloatCell;
      const w = p.run(values);
      const m = v * w;
      e = mulError(m, v, e, w, p.error);
      v = m;
    }
    out.error = e;
    return v;
  };
  return out;
}

function quotientCell(a: FloatCell, b: FloatCell): FloatCell {
  const out = cell();
  out.run = (values) => {
    const va = a.run(values);
    const ea = a.error;
    const vb = b.run(values);
    const v = va / vb;
    out.error = divError(v, ea, vb, b.error);
    return v;
  };
  return out;
}

function negCell(a: FloatCell): FloatCell {
  const out = cell();
  out.run = (values) => {
    const v = -a.run(values);
    out.error = a.error;
    return v;
  };
  return out;
}

/** The smallest and the largest of the parts are exact, and each of them moves at most by the largest error of a part. */
function extremeCell(parts: readonly FloatCell[], pick: (x: number, y: number) => number): FloatCell {
  const out = cell();
  out.run = (values) => {
    let v = (parts[0] as FloatCell).run(values);
    let e = (parts[0] as FloatCell).error;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as FloatCell;
      v = pick(v, p.run(values));
      e = Math.max(e, p.error);
    }
    out.error = e;
    return v;
  };
  return out;
}

/**
 * This function compiles a whole power. A positive power multiplies by repeated squares, and each product uses the rule
 * of `mul`. A negative power is the quotient of one by the positive power. The power zero gives one, and its bound is
 * zero when the base has a real value.
 */
function powCell(base: FloatCell, exp: number): FloatCell {
  const out = cell();
  const n = Math.abs(exp);
  out.run = (values) => {
    let bv = base.run(values);
    let be = base.error;
    if (n === 0) {
      out.error = be < Infinity ? 0 : Infinity;
      return 1;
    }
    let rv = 1;
    let re = 0;
    let first = true;
    for (let k = n; k > 0; k = Math.floor(k / 2)) {
      if (k % 2 === 1) {
        if (first) {
          rv = bv;
          re = be;
          first = false;
        } else {
          const m = rv * bv;
          re = mulError(m, rv, re, bv, be);
          rv = m;
        }
      }
      if (k > 1) {
        const s = bv * bv;
        be = mulError(s, bv, be, bv, be);
        bv = s;
      }
    }
    if (exp > 0) {
      out.error = re;
      return rv;
    }
    const v = 1 / rv;
    out.error = divError(v, 0, rv, re);
    return v;
  };
  return out;
}

/**
 * This function compiles a square root. `Math.sqrt` is correctly rounded. When `er <= r`, the exact radicand `R` is
 * not negative, and `|sqrt(r) - sqrt(R)|` is at most `er / sqrt(r)` and at most `sqrt(er)`.
 */
function sqrtCell(radicand: FloatCell): FloatCell {
  const out = cell();
  out.run = (values) => {
    const r = radicand.run(values);
    const er = radicand.error;
    const v = Math.sqrt(r);
    out.error = !(er <= r) ? Infinity : close(v, er === 0 ? 0 : Math.min(divUp(er, v), Math.sqrt(er)));
    return v;
  };
  return out;
}

/**
 * This function gives the float root of index `k` of a value. An odd index takes a negative value as `-root(-r)`.
 * This value is not correctly rounded. The bound of `rootCell` does not depend on its accuracy.
 *
 * @param r - The radicand.
 * @param k - The index, a whole number of 2 or more.
 * @returns The float root. An even root of a negative value gives `NaN`.
 */
export function floatRoot(r: number, k: number): number {
  if (k === 2) return Math.sqrt(r);
  const f = (m: number): number => (k === 3 ? Math.cbrt(m) : Math.pow(m, 1 / k));
  return k % 2 === 1 && r < 0 ? -f(-r) : f(r);
}

/**
 * This function gives the bound of a root of index 3 or more. The exact radicand is in `[r - er, r + er]`, and the
 * root is monotone, so the outward root `interval.root` of that interval contains the exact root. The bound is the
 * largest distance from the value to an end of that interval, rounded upward. This bound does not depend on the
 * accuracy of `Math.pow`. The verb `ball` uses this function for each root.
 *
 * @param v - The float root.
 * @param r - The float radicand.
 * @param er - The bound of the error of the radicand.
 * @param k - The index of the root.
 * @returns The bound of `|v - exact root|`, or `Infinity` when the radicand can be negative for an even index.
 */
export function rootError(v: number, r: number, er: number, k: number): number {
  if (!(er < Infinity) || !(v - v === 0)) return Infinity;
  const span = I.add([r, r], [-er, er]) as readonly [number, number];
  if (k % 2 === 0 && span[0] < 0) return Infinity;
  const d = I.sub([v, v], I.root(span, k)) as readonly [number, number];
  const e = Math.max(-d[0], d[1]);
  return e <= Infinity ? e : Infinity;
}

function rootCell(radicand: FloatCell, k: number): FloatCell {
  if (k === 2) return sqrtCell(radicand);
  const out = cell();
  out.run = (values) => {
    const r = radicand.run(values);
    const v = floatRoot(r, k);
    out.error = rootError(v, r, radicand.error, k);
    return v;
  };
  return out;
}

/**
 * This function gives the bound of a comparison. Two exact sides compare exactly. Else the difference `d = a - b` has
 * the bound `ed` of `sub`, so the exact difference is in `[d - ed, d + ed]`. The bound decides the comparison when
 * that interval is on one side of zero.
 */
function comparisonError(kind: "lt" | "le" | "eq", a: number, ea: number, b: number, eb: number): number {
  if (ea === 0 && eb === 0) return 0;
  const d = a - b;
  const ed = close(d, ea + eb);
  if (!(ed < Infinity)) return Infinity;
  switch (kind) {
    case "lt":
      return ed < -d || d >= ed ? 0 : 1;
    case "le":
      return ed <= -d || d > ed ? 0 : 1;
    case "eq":
      return Math.abs(d) > ed ? 0 : 1;
  }
}

function comparisonCell(kind: "lt" | "le" | "eq", a: FloatCell, b: FloatCell): FloatCell {
  const out = cell();
  out.run = (values) => {
    const va = a.run(values);
    const ea = a.error;
    const vb = b.run(values);
    const truth = kind === "lt" ? va < vb : kind === "le" ? va <= vb : va === vb;
    out.error = comparisonError(kind, va, ea, vb, b.error);
    return truth ? 1 : 0;
  };
  return out;
}

/**
 * This function compiles one node from the cells of its parts. It is the rule of each kind for the verb `float`, as
 * `combine` is the rule of each kind for the verb `summary`. A list of parts folds from the left.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The cells of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The cell of the node.
 */
export function floatNode(kind: KindName, parts: readonly FloatCell[], data: NodeData = {}): FloatCell {
  const [a, b] = parts as readonly [FloatCell, FloatCell];
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
      return extremeCell(parts, Math.min);
    case "max":
      return extremeCell(parts, Math.max);
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
      throw new RangeError(`The kind ${kind} has no parts. Use floatNum or floatVar.`);
  }
}
