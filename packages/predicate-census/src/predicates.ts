/**
 * The predicates of the census. Each predicate is a list of sign expressions and a rule that gives the answer. The
 * rule asks the sign of each expression that it needs. The same rule gives the exact answer, the float answer and the
 * answer of the bounds.
 *
 * @packageDocumentation
 */
import { least, minus, most, negate, num, orientForm, plus, signForm, times, v } from "./expressions.ts";
import type { Point, PointVars, Sign, SignForm } from "./expressions.ts";
import type { Expression } from "@mark1russell7/expression";
import type { Box, Rect, Vec } from "./input.ts";

/** The name of each predicate. */
export type PredicateName = "segmentPair" | "segmentBox" | "boxPair" | "pointSide";

/** The answer of a predicate: a truth value, or a sign for `pointSide`. */
export type Answer = boolean | Sign;

/** A predicate: its sign expressions and the rule of its answer. */
export interface Predicate {
  readonly name: PredicateName;
  readonly signs: readonly SignForm[];
  /**
   * This function gives the answer. It asks the sign of each expression that it needs through `sign`. An evaluator
   * can stop the rule when it cannot fix a sign.
   */
  answer(sign: (form: SignForm) => Sign): Answer;
}

const A: PointVars = ["ax", "ay"];
const B: PointVars = ["bx", "by"];
const C: PointVars = ["cx", "cy"];
const DD: PointVars = ["dx", "dy"];
const P: PointVars = ["px", "py"];

const abc = orientForm("orient(a,b,c)", A, B, C);
const abd = orientForm("orient(a,b,d)", A, B, DD);
const cda = orientForm("orient(c,d,a)", C, DD, A);
const cdb = orientForm("orient(c,d,b)", C, DD, B);

/**
 * The proper crossing of two segments `ab` and `cd`, as `geom.segmentsCross` of highways. A shared end, a touch or a
 * collinear overlap is not a crossing. The rule asks all four signs.
 */
export const segmentPair: Predicate = {
  name: "segmentPair",
  signs: [abc, abd, cda, cdb],
  answer: (s) => {
    const [d1, d2, d3, d4] = [s(cda), s(cdb), s(abc), s(abd)];
    return d1 * d2 < 0 && d3 * d4 < 0;
  },
};

const side = orientForm("orient(a,b,p)", A, B, P);

/** The side of the point `p` against the line `ab`. The answer is the sign of `orient(a,b,p)`. */
export const pointSide: Predicate = {
  name: "pointSide",
  signs: [side],
  answer: (s) => s(side),
};

/**
 * The closed crossing of two segments, as the `crossing` function of the mesh of highways. A touch or a shared end is
 * a crossing. Two collinear segments do not cross. The rule asks all four signs. The tolerances of highways on the
 * shares are not in this rule, so a share near 0 or 1 can give a float-wrong record.
 */
export const segmentPairClosed: Predicate = {
  name: "segmentPair",
  signs: [abc, abd, cda, cdb],
  answer: (s) => {
    const [d1, d2, d3, d4] = [s(cda), s(cdb), s(abc), s(abd)];
    return (d1 !== 0 || d2 !== 0) && d1 * d2 <= 0 && d3 * d4 <= 0;
  },
};

/**
 * The side of the point `p` against the line `ab`, as `outOf` of the physics router of highways. The answer is 1 when
 * `orient(a,b,p)` is positive, and -1 for a zero or a negative sign.
 */
export const pointSideTieLow: Predicate = {
  name: "pointSide",
  signs: [side],
  answer: (s) => (s(side) > 0 ? 1 : -1),
};

/**
 * The predicates of the call sites whose rule is not the default rule of their form. The key is the `fn` field of an
 * input line.
 */
export const CALL_SITE_RULES: Readonly<Record<string, Predicate>> = {
  "mesh.crossing": segmentPairClosed,
  "physics.outOf": pointSideTieLow,
};

/** A part of an expression that can be the constant 0 or 1. The builders fold these constants. */
type Part = Expression | 0 | 1 | -1;

const lit = (x: Part): Expression => (typeof x === "number" ? num(x) : x);
function sub(x: Part, y: Part): Part {
  if (y === 0) return x;
  if (typeof x === "number" && typeof y === "number") return (x - y) as Part;
  if (x === 0) return negate(lit(y));
  return minus(lit(x), lit(y));
}
function mul(x: Part, y: Part): Part {
  if (x === 0 || y === 0) return 0;
  if (x === 1) return y;
  if (y === 1) return x;
  if (typeof x === "number" && typeof y === "number") return (x * y) as Part;
  return times(lit(x), lit(y));
}

/** The corners of the box of a segment-box test, as expressions. */
interface Corners {
  readonly x0: Expression;
  readonly y0: Expression;
  readonly x1: Expression;
  readonly y1: Expression;
}

/** A value of the clip parameter `t`: the quotient `num / den`. The key `0` and the key `1` are the ends of the segment. */
type Key = "0" | "1" | "x0" | "x1" | "y0" | "y1";
const KEYS: readonly Key[] = ["0", "1", "x0", "x1", "y0", "y1"];

/** A sign that is a compiled form or a constant. */
type Term = SignForm | Sign;

/**
 * This function makes the segment-box predicate of highways for one form of the box. The rule is the Liang-Barsky
 * clip of `geom.segmentHitsRect`: the clipped part must be longer than `eps`. The rule has no division. It compares
 * two values of `t` by the sign of a cross product, and the length by its square.
 */
function clipPredicate(corners: Corners): Predicate {
  const ax = v("ax");
  const ay = v("ay");
  const dxDoc = minus(v("bx"), ax);
  const dyDoc = minus(v("by"), ay);
  const dx = signForm("dx", dxDoc);
  const dy = signForm("dy", dyDoc);
  const eps = signForm("eps", v("eps"));
  const den: Record<Key, "1" | "dx" | "dy"> = { "0": "1", "1": "1", x0: "dx", x1: "dx", y0: "dy", y1: "dy" };
  const denDoc = { "1": 1, dx: dxDoc, dy: dyDoc } as const;
  const numer: Record<Key, Part> = {
    "0": 0,
    "1": 1,
    x0: minus(corners.x0, ax),
    x1: minus(corners.x1, ax),
    y0: minus(corners.y0, ay),
    y1: minus(corners.y1, ay),
  };
  const length2 = plus(times(dxDoc, dxDoc), times(dyDoc, dyDoc));
  const eps2 = times(v("eps"), v("eps"));
  const diff = new Map<string, Term>();
  const len = new Map<string, Term>();
  const signs: SignForm[] = [dx, dy, eps];
  const term = (name: string, x: Part): Term => {
    if (typeof x === "number") return Math.sign(x) as Sign;
    const form = signForm(name, x);
    signs.push(form);
    return form;
  };
  for (let i = 0; i < KEYS.length; i++) {
    for (let j = i + 1; j < KEYS.length; j++) {
      const [ki, kj] = [KEYS[i] as Key, KEYS[j] as Key];
      const same = den[ki] === den[kj];
      const n = same ? sub(numer[ki], numer[kj]) : sub(mul(numer[ki], denDoc[den[kj]]), mul(numer[kj], denDoc[den[ki]]));
      const d = same ? denDoc[den[ki]] : mul(denDoc[den[ki]], denDoc[den[kj]]);
      diff.set(`${ki},${kj}`, term(`diff(${ki},${kj})`, n));
      len.set(`${ki},${kj}`, term(`len(${ki},${kj})`, sub(mul(mul(n, n), length2), mul(eps2, mul(d, d)))));
    }
  }
  const pair = <T>(m: Map<string, T>, i: Key, j: Key): [T, Sign] => {
    const at = KEYS.indexOf(i) < KEYS.indexOf(j);
    return [m.get(at ? `${i},${j}` : `${j},${i}`) as T, at ? 1 : -1];
  };
  return {
    name: "segmentBox",
    signs,
    answer: (s) => {
      const value = (t: Term): Sign => (typeof t === "number" ? t : s(t));
      const denSign = (k: Key): Sign => (den[k] === "1" ? 1 : s(den[k] === "dx" ? dx : dy));
      // The numerator of `t(i) - t(j)`, with the sign of the order of the pair.
      const numSign = (i: Key, j: Key): Sign => {
        const [t, flip] = pair(diff, i, j);
        return (value(t) * flip) as Sign;
      };
      // The sign of `t(i) - t(j)`.
      const cmp = (i: Key, j: Key): Sign => {
        if (i === j) return 0;
        const n = numSign(i, j);
        return (den[i] === den[j] ? n * denSign(i) : n * denSign(i) * denSign(j)) as Sign;
      };
      let t0: Key = "0";
      let t1: Key = "1";
      for (const [d, lo, hi] of [
        [dx, "x0", "x1"],
        [dy, "y0", "y1"],
      ] as const) {
        if (s(d) === 0) {
          // The segment is parallel to this axis: the start must be strictly between the two sides.
          if (numSign(lo, "0") >= 0 || numSign(hi, "0") <= 0) return false;
          continue;
        }
        const [first, second] = cmp(lo, hi) <= 0 ? [lo, hi] : [hi, lo];
        if (cmp(first, t0) > 0) t0 = first;
        if (cmp(second, t1) < 0) t1 = second;
        if (cmp(t0, t1) > 0) return false;
      }
      if (s(eps) < 0) return true;
      return value(pair(len, t0, t1)[0]) > 0;
    },
  };
}

/** The segment-box test of a line with `box`: the corners are `x + w` and `y + h`, as exact sums. */
export const segmentBox: Predicate = clipPredicate({
  x0: v("boxX"),
  y0: v("boxY"),
  x1: plus(v("boxX"), v("boxW")),
  y1: plus(v("boxY"), v("boxH")),
});

/** The segment-box test of a line with `rect`: the corners are the four given values. */
export const segmentRect: Predicate = clipPredicate({ x0: v("x0"), y0: v("y0"), x1: v("x1"), y1: v("y1") });

/** This function gives the margin of two boxes on one axis, minus `eps`: `min(a + aw, b + bw) - max(a, b) - eps`. */
function margin(axis: "x" | "y"): Expression {
  const size = axis === "x" ? "w" : "h";
  const a = v(`a${axis}`);
  const b = v(`b${axis}`);
  return minus(minus(least(plus(a, v(`a${size}`)), plus(b, v(`b${size}`))), most(a, b)), v("eps"));
}

const marginX = signForm("marginX - eps", margin("x"));
const marginY = signForm("marginY - eps", margin("y"));

/**
 * The overlap of two axis boxes. The answer is true when the margin on each axis is larger than `eps`. Without
 * `eps`, the margin must be larger than zero.
 */
export const boxPair: Predicate = {
  name: "boxPair",
  signs: [marginX, marginY],
  answer: (s) => {
    const [x, y] = [s(marginX), s(marginY)];
    return x === 1 && y === 1;
  },
};

/** The predicates, by name. The segment-box predicate is the one of a line with `box`. */
export const PREDICATES: Readonly<Record<PredicateName, Predicate>> = { segmentPair, segmentBox, boxPair, pointSide };

/** This function gives the variables of a segment pair. */
export function segmentPairPoint(a: Vec, b: Vec, c: Vec, d: Vec): Point {
  return { ax: a[0], ay: a[1], bx: b[0], by: b[1], cx: c[0], cy: c[1], dx: d[0], dy: d[1] };
}

/** This function gives the variables of a segment and a box. Without `eps`, `eps` is zero. */
export function segmentBoxPoint(a: Vec, b: Vec, box: Box, eps = 0): Point {
  return { ax: a[0], ay: a[1], bx: b[0], by: b[1], boxX: box.x, boxY: box.y, boxW: box.w, boxH: box.h, eps };
}

/** This function gives the variables of a segment and a rectangle `[x0, y0, x1, y1]`. Without `eps`, `eps` is zero. */
export function segmentRectPoint(a: Vec, b: Vec, rect: Rect, eps = 0): Point {
  return { ax: a[0], ay: a[1], bx: b[0], by: b[1], x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3], eps };
}

/** This function gives the variables of a point and a line. */
export function pointSidePoint(p: Vec, a: Vec, b: Vec): Point {
  return { px: p[0], py: p[1], ax: a[0], ay: a[1], bx: b[0], by: b[1] };
}

/** This function gives the variables of a box pair. */
export function boxPairPoint(a: Box, b: Box, eps = 0): Point {
  return { ax: a.x, ay: a.y, aw: a.w, ah: a.h, bx: b.x, by: b.y, bw: b.w, bh: b.h, eps };
}
