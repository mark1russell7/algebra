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
import type { Box, ContainerLine, EdgeBox, Rect, StripLine, Vec } from "./input.ts";

/** The name of each predicate. The names `container` and `strip` are predicates of packing. */
export type PredicateName = "segmentPair" | "segmentBox" | "boxPair" | "pointSide" | "container" | "strip";

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

/** A line of the source of highways that a rule of the census copies. */
export interface RuleSource {
  /** The file, from the root of the highways repository. */
  readonly file: string;
  /** The line number at the commit `commit`. */
  readonly line: number;
  /** The text of the line, without the indent. */
  readonly text: string;
}

/** The rule of a call site of highways: the predicate of the census, and the lines of highways that it copies. */
export interface CallSiteRule {
  readonly predicate: Predicate;
  /** The commit of highways with the lines of `sources`. */
  readonly commit: string;
  readonly sources: readonly RuleSource[];
}

/**
 * The rules of the call sites whose rule is not the default rule of their form. The key is the `fn` field of an
 * input line. This table is a copy of the rules of highways. `checkRuleSources` finds a copy that is not current.
 */
export const CALL_SITE_RULES: Readonly<Record<string, CallSiteRule>> = {
  "mesh.crossing": {
    predicate: segmentPairClosed,
    commit: "23fb143edd1b5f6750de9a0e3473ecc2e4d33c32",
    sources: [
      { file: "packages/core/src/highways/mesh/index.ts", line: 55, text: "if (Math.abs(den) < 1e-12) return undefined;" },
      {
        file: "packages/core/src/highways/mesh/index.ts",
        line: 59,
        text: "return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps ? { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) } : undefined;",
      },
    ],
  },
  "physics.outOf": {
    predicate: pointSideTieLow,
    commit: "23fb143edd1b5f6750de9a0e3473ecc2e4d33c32",
    sources: [{ file: "packages/core/src/routers/physics.ts", line: 109, text: "const k = cross > 0 ? 1 : -1;" }],
  },
};

/**
 * The field `rule` of a dump line of highways (highways #258, `CALL_SITE_RULES` of `packages/core/src/predicate-sink.ts`).
 * A call site with the default rule of its form has no field. The census does not use the two tolerances.
 */
export interface DumpRule {
  /** For a point-side test: the answer of a zero sign. */
  readonly zero?: -1 | 0 | 1;
  /** For a segment pair: the value is `true` when a touch is a crossing. */
  readonly touch?: boolean;
  readonly shareTolerance?: number;
  readonly parallelTolerance?: number;
}

/**
 * This function gives the predicate of the field `rule` of a dump line. The predicate is the default of the form
 * when the field has no change of that form.
 *
 * @param form - The form of the line.
 * @param rule - The field `rule` of the line.
 * @returns The predicate, or a reason when the census has no predicate for the rule.
 */
export function predicateOfRule(form: "segmentPair" | "pointSide", rule: unknown): Predicate | { readonly reason: string } {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) return { reason: `the rule field is not an object: ${JSON.stringify(rule)}` };
  const r = rule as DumpRule;
  if (form === "segmentPair") {
    if (r.zero !== undefined) return { reason: "a segment pair rule has the field zero" };
    if (r.touch === undefined || r.touch === false) return PREDICATES.segmentPair;
    if (r.touch === true) return segmentPairClosed;
    return { reason: `the field touch is not a truth value: ${JSON.stringify(r.touch)}` };
  }
  if (r.touch !== undefined) return { reason: "a point-side rule has the field touch" };
  if (r.zero === undefined || r.zero === 0) return PREDICATES.pointSide;
  if (r.zero === -1) return pointSideTieLow;
  return { reason: `the census has no point-side rule with zero ${JSON.stringify(r.zero)}` };
}

/** The result of the check of one source line of a rule. */
export interface RuleSourceCheck {
  readonly fn: string;
  readonly file: string;
  readonly line: number;
  /** The line of the text in the checked tree, or `null` when the file does not have the text. */
  readonly foundAt: number | null;
  /** The value is `true` when the file has the text. A text at another line is a warning, not a failure. */
  readonly holds: boolean;
}

/**
 * This function examines each source line of `CALL_SITE_RULES` in a tree of highways.
 *
 * @param read - This function gives the text of a file of the tree, or `null` when the tree does not have it.
 * @returns One result for each source line.
 */
export function checkRuleSources(read: (file: string) => string | null): RuleSourceCheck[] {
  const out: RuleSourceCheck[] = [];
  for (const [fn, rule] of Object.entries(CALL_SITE_RULES)) {
    for (const s of rule.sources) {
      const lines = read(s.file)?.split(/\r?\n/) ?? [];
      const at = lines[s.line - 1]?.trim() === s.text ? s.line : lines.findIndex((l) => l.trim() === s.text) + 1;
      out.push({ fn, file: s.file, line: s.line, foundAt: at === 0 ? null : at, holds: at !== 0 });
    }
  }
  return out;
}

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

/**
 * This function gives the margin of two boxes of packing on one axis, minus the tolerance:
 * `min(a.r, b.r) - max(a.l, b.l) - tolerance` on the axis `x`. The float value has the operations of packing in its order.
 */
function edgeMargin(axis: "x" | "y"): Expression {
  const [lo, hi] = axis === "x" ? ["l", "r"] : ["t", "b"];
  return minus(minus(least(v(`a${hi}`), v(`b${hi}`)), most(v(`a${lo}`), v(`b${lo}`))), v("tolerance"));
}

const edgeMarginX = signForm("marginX - tolerance", edgeMargin("x"));
const edgeMarginY = signForm("marginY - tolerance", edgeMargin("y"));

/**
 * The overlap of two boxes of packing, as `overlap` of `src/check.ts` of packing at the commit `94bcd79`. The answer is
 * true when the margin of each axis is larger than the tolerance. The rule asks the sign of `y` only when `x` is true,
 * as the `&&` of packing does.
 *
 * Packing computes the margin as a float difference, and then compares it with the tolerance. The float sign of
 * `fl(margin) - tolerance` is the result of that comparison, because the sign of a float difference is exact. Thus the
 * census float answer is the answer of packing. The exact answer compares the exact margin with the tolerance.
 */
export const edgePair: Predicate = {
  name: "boxPair",
  signs: [edgeMarginX, edgeMarginY],
  answer: (s) => s(edgeMarginX) === 1 && s(edgeMarginY) === 1,
};

/** This function gives the sign form of one side of the container test of packing, with the operations of packing in its order. */
function wallForm(edge: string, at: string, size: string | undefined, low: boolean): SignForm {
  const start = plus(v(at), v("inset"));
  if (low) return signForm(`${edge} - (${at} + inset - tolerance)`, minus(v(edge), minus(start, v("tolerance"))));
  const end = minus(plus(v(at), v(size as string)), v("inset"));
  return signForm(`${edge} - (${at} + ${size} - inset + tolerance)`, minus(v(edge), plus(end, v("tolerance"))));
}

const wallLeft = wallForm("l", "x", undefined, true);
const wallRight = wallForm("r", "x", "w", false);
const wallTop = wallForm("t", "y", undefined, true);
const wallBottom = wallForm("b", "y", "h", false);
const containers = new Map<string, Predicate>();

/**
 * This function gives the container test of packing for one box, as `checkHard` of `src/check.ts` of packing at the
 * commit `94bcd79`. The answer is true when the box goes out of a fixed side by more than the tolerance.
 *
 * Packing computes each side as a float sum, for example `fl(fl(x + inset) - tolerance)`, and compares the edge with it.
 * The census float sign of `edge - side` is that comparison. The exact answer compares the edge with the exact side.
 *
 * @param fixedW - The value is `true` when the width of the container is fixed. Then the rule asks the left and the right side.
 * @param fixedH - The value is `true` when the height of the container is fixed. Then the rule asks the top and the bottom side.
 * @returns The predicate. The function gives the same object for the same arguments.
 */
export function containerPredicate(fixedW: boolean, fixedH: boolean): Predicate {
  const key = `${fixedW},${fixedH}`;
  let p = containers.get(key);
  if (p === undefined) {
    const signs = [...(fixedW ? [wallLeft, wallRight] : []), ...(fixedH ? [wallTop, wallBottom] : [])];
    p = {
      name: "container",
      signs,
      answer: (s) => {
        const outX = fixedW && (s(wallLeft) < 0 || s(wallRight) > 0);
        const outY = fixedH && (s(wallTop) < 0 || s(wallBottom) > 0);
        return outX || outY;
      },
    };
    containers.set(key, p);
  }
  return p;
}

const stripLow = signForm("max(ay, by) - y0", minus(most(v("ay"), v("by")), v("y0")));
const stripHigh = signForm("min(ay, by) - y1", minus(least(v("ay"), v("by")), v("y1")));

/**
 * The strip test of `edgeRange` of `src/space.ts` of packing at the commit `94bcd79`. The answer is true when the segment
 * has a part in the open strip from `y0` to `y1`. Packing compares the floats with no arithmetic, so its answer is exact.
 * The census does not examine the range that `xAt` gives.
 */
export const strip: Predicate = {
  name: "strip",
  signs: [stripLow, stripHigh],
  answer: (s) => !(s(stripLow) <= 0 || s(stripHigh) >= 0),
};

/** The predicates, by name. The segment-box predicate is the one of a line with `box`. The container test has two fixed sides. */
export const PREDICATES: Readonly<Record<PredicateName, Predicate>> = {
  segmentPair,
  segmentBox,
  boxPair,
  pointSide,
  container: containerPredicate(true, true),
  strip,
};

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

/** This function gives the variables of a box pair of packing. */
export function edgePairPoint(a: EdgeBox, b: EdgeBox, tolerance: number): Point {
  return { al: a.l, at: a.t, ar: a.r, ab: a.b, bl: b.l, bt: b.t, br: b.r, bb: b.b, tolerance };
}

/** This function gives the variables of a container test of packing. An infinite size of a side that is not fixed is not a variable. */
export function containerPoint(line: Pick<ContainerLine, "box" | "x" | "y" | "w" | "h" | "inset" | "tolerance">): Point {
  const { box, x, y, w, h, inset, tolerance } = line;
  return { l: box.l, t: box.t, r: box.r, b: box.b, x, y, inset, tolerance, ...(w === null ? {} : { w }), ...(h === null ? {} : { h }) };
}

/** This function gives the variables of a strip test of packing. */
export function stripPoint(line: Pick<StripLine, "ax" | "ay" | "bx" | "by" | "y0" | "y1">): Point {
  return { ax: line.ax, ay: line.ay, bx: line.bx, by: line.by, y0: line.y0, y1: line.y1 };
}
