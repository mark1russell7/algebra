/**
 * The three predicates of the census. Each predicate is a list of sign expressions and a rule that gives the answer
 * from their signs. The same rule gives the exact answer, the float answer and the answer of the bounds.
 *
 * @packageDocumentation
 */
import { least, minus, most, orient, plus, signForm, v } from "./expressions.ts";
import type { Point, PointExpr, Sign, SignForm } from "./expressions.ts";
import type { Expression } from "@mark1russell7/expression";
import type { Box, Vec } from "./input.ts";

/** The name of each predicate. */
export type PredicateName = "segmentPair" | "segmentBox" | "boxPair";

/** A predicate: its sign expressions and the rule of its answer. */
export interface Predicate {
  readonly name: PredicateName;
  readonly signs: readonly SignForm[];
  /** This function gives the answer from the sign of each expression, in the order of `signs`. */
  answer(signs: readonly Sign[]): boolean;
}

const A: PointExpr = [v("ax"), v("ay")];
const B: PointExpr = [v("bx"), v("by")];
const C: PointExpr = [v("cx"), v("cy")];
const DD: PointExpr = [v("dx"), v("dy")];

/**
 * The proper crossing of two segments `ab` and `cd`. A shared end, a touch or a collinear overlap is not a crossing.
 * The segments cross when `c` and `d` are on opposite sides of `ab`, and `a` and `b` are on opposite sides of `cd`.
 */
export const segmentPair: Predicate = {
  name: "segmentPair",
  signs: [
    signForm("orient(a,b,c)", orient(A, B, C)),
    signForm("orient(a,b,d)", orient(A, B, DD)),
    signForm("orient(c,d,a)", orient(C, DD, A)),
    signForm("orient(c,d,b)", orient(C, DD, B)),
  ],
  answer: ([abc, abd, cda, cdb]) => (abc as number) * (abd as number) < 0 && (cda as number) * (cdb as number) < 0,
};

const X = v("boxX");
const Y = v("boxY");
const W = v("boxW");
const H = v("boxH");
const right = plus(X, W);
const top = plus(Y, H);

/**
 * The test of a segment `ab` against the open inside of an axis box. The answer is true when a point of the segment
 * is strictly inside the box. The rule separates the two sets on the axis `x`, the axis `y` or the normal of the
 * segment. The corners `x + w` and `y + h` are exact sums, not float sums.
 */
export const segmentBox: Predicate = {
  name: "segmentBox",
  signs: [
    signForm("w", W),
    signForm("h", H),
    signForm("max(ax,bx) - x", minus(most(A[0], B[0]), X)),
    signForm("min(ax,bx) - (x + w)", minus(least(A[0], B[0]), right)),
    signForm("max(ay,by) - y", minus(most(A[1], B[1]), Y)),
    signForm("min(ay,by) - (y + h)", minus(least(A[1], B[1]), top)),
    signForm("orient(a,b,(x,y))", orient(A, B, [X, Y])),
    signForm("orient(a,b,(x+w,y))", orient(A, B, [right, Y])),
    signForm("orient(a,b,(x+w,y+h))", orient(A, B, [right, top])),
    signForm("orient(a,b,(x,y+h))", orient(A, B, [X, top])),
  ],
  answer: ([w, h, xLow, xHigh, yLow, yHigh, ...corners]) => {
    if (w !== 1 || h !== 1) return false;
    if (xLow !== 1 || xHigh !== -1 || yLow !== 1 || yHigh !== -1) return false;
    const allZero = corners.every((s) => s === 0);
    const oneSide = corners.every((s) => s >= 0) || corners.every((s) => s <= 0);
    return allZero || !oneSide;
  },
};

/** This function gives the margin of two boxes on one axis, minus `eps`: `min(a + aw, b + bw) - max(a, b) - eps`. */
function margin(axis: "x" | "y"): Expression {
  const size = axis === "x" ? "w" : "h";
  const a = v(`a${axis}`);
  const b = v(`b${axis}`);
  return minus(minus(least(plus(a, v(`a${size}`)), plus(b, v(`b${size}`))), most(a, b)), v("eps"));
}

/**
 * The overlap of two axis boxes. The answer is true when the margin on each axis is larger than `eps`. Without
 * `eps`, the margin must be larger than zero.
 */
export const boxPair: Predicate = {
  name: "boxPair",
  signs: [signForm("marginX - eps", margin("x")), signForm("marginY - eps", margin("y"))],
  answer: ([x, y]) => x === 1 && y === 1,
};

/** The predicates, by name. */
export const PREDICATES: Readonly<Record<PredicateName, Predicate>> = { segmentPair, segmentBox, boxPair };

/** This function gives the variables of a segment pair. */
export function segmentPairPoint(a: Vec, b: Vec, c: Vec, d: Vec): Point {
  return { ax: a[0], ay: a[1], bx: b[0], by: b[1], cx: c[0], cy: c[1], dx: d[0], dy: d[1] };
}

/** This function gives the variables of a segment and a box. */
export function segmentBoxPoint(a: Vec, b: Vec, box: Box): Point {
  return { ax: a[0], ay: a[1], bx: b[0], by: b[1], boxX: box.x, boxY: box.y, boxW: box.w, boxH: box.h };
}

/** This function gives the variables of a box pair. */
export function boxPairPoint(a: Box, b: Box, eps = 0): Point {
  return { ax: a.x, ay: a.y, aw: a.w, ah: a.h, bx: b.x, by: b.y, bw: b.w, bh: b.h, eps };
}
