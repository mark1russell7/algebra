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
 * The arithmetic of the balls and its proof sketch are in `@mark1russell7/interval`. This module compiles a
 * document into closures that keep the midpoint and the radius of each node in two numbers.
 *
 * @packageDocumentation
 */
import { ball as B, type Ball } from "@mark1russell7/interval";
import type { KindName, NodeData } from "./summary.ts";

export type { Ball };

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
    out.rad = B.claim(v.mid, v.rad);
    return v.mid;
  };
  return out;
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
      r = B.sumRadius(s, v, r, w, p.rad);
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
    out.rad = B.sumRadius(v, va, ra, -vb, b.rad);
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
      r = B.productRadius(m, v, r, w, p.rad);
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
    out.rad = B.quotientRadius(v, va, ra, vb, b.rad);
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

function extremeCell(parts: readonly BallCell[], sign: 1 | -1): BallCell {
  const out = cell();
  const pick = sign === 1 ? Math.max : Math.min;
  out.run = (values) => {
    let v = (parts[0] as BallCell).run(values);
    let r = (parts[0] as BallCell).rad;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i] as BallCell;
      const w = p.run(values);
      r = B.extremeRadius(sign, v, r, w, p.rad);
      v = pick(v, w);
    }
    out.rad = B.claim(v, r);
    return v;
  };
  return out;
}

/** This function compiles a whole power with the repeated squares of `ball.pow`. */
function powCell(base: BallCell, exp: number): BallCell {
  const out = cell();
  out.run = (values) => {
    const p = B.pow({ mid: base.run(values), rad: base.rad }, exp);
    out.rad = p.rad;
    return p.mid;
  };
  return out;
}

/** This function compiles a root with the rule of `ball.root`. */
function rootCell(radicand: BallCell, k: number): BallCell {
  const out = cell();
  out.run = (values) => {
    const p = B.root({ mid: radicand.run(values), rad: radicand.rad }, k);
    out.rad = p.rad;
    return p.mid;
  };
  return out;
}

function comparisonCell(kind: "lt" | "le" | "eq", a: BallCell, b: BallCell): BallCell {
  const out = cell();
  out.run = (values) => {
    const x = { mid: a.run(values), rad: a.rad };
    const t = B[kind](x, { mid: b.run(values), rad: b.rad });
    out.rad = t.rad;
    return t.mid;
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
