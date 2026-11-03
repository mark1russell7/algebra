/**
 * The intersection of two closed segments `ab` and `cd`. The answer comes from four exact orientation signs and, for
 * collinear segments, from comparisons of the floats. A touch and a collinear overlap are explicit answers.
 *
 * @packageDocumentation
 */
import { orientCode } from "./orient.ts";
import type { Stage } from "./sign.ts";

/**
 * The relation of two closed segments.
 *
 * - `disjoint`: the segments have no common point.
 * - `cross`: the segments have one common point, and it is inside each segment. No end is on the other segment.
 * - `touch`: the segments have exactly one common point, and it is an end of one segment or of the two segments.
 * - `overlap`: the segments are on one line and they have a common part that is longer than 0.
 */
export type SegmentRelation = "disjoint" | "cross" | "touch" | "overlap";

/** The result of `classifySegments`. */
export interface SegmentIntersection {
  readonly relation: SegmentRelation;
  /**
   * The value is `true` when the four points are on one line. Then the comparisons of the floats give the relation. A
   * segment of length 0 is on each line through its point.
   */
  readonly collinear: boolean;
  /** The value is `exact` when the exact stage decided one of the orientation signs that the answer used. */
  readonly stage: Stage;
}

const RELATIONS: readonly SegmentRelation[] = ["disjoint", "cross", "touch", "overlap"];
const DISJOINT = 0;
const CROSS = 1;
const TOUCH = 2;
const OVERLAP = 3;
/** The frozen results, at the index `4 relation + 2 collinear + exact`. The function makes no object for a result. */
const RESULTS: readonly SegmentIntersection[] = RELATIONS.flatMap((relation) =>
  [false, true].flatMap((collinear) => (["filter", "exact"] as const).map((stage) => Object.freeze({ relation, collinear, stage }))),
);

/** This function gives the frozen result of a relation code. */
function result(relation: number, collinear: boolean, exact: boolean): SegmentIntersection {
  return RESULTS[relation * 4 + (collinear ? 2 : 0) + (exact ? 1 : 0)] as SegmentIntersection;
}

/** The comparison of two points in the order of `x`, then of `y`. On one line, this order is an order along the line. */
function compare(px: number, py: number, qx: number, qy: number): number {
  return px < qx ? -1 : px > qx ? 1 : py < qy ? -1 : py > qy ? 1 : 0;
}

/** This function gives the relation of two collinear segments from the order of their ends along the line. */
function collinearRelation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const abSwap = compare(ax, ay, bx, by) > 0;
  const cdSwap = compare(cx, cy, dx, dy) > 0;
  const [lo1x, lo1y, hi1x, hi1y] = abSwap ? [bx, by, ax, ay] : [ax, ay, bx, by];
  const [lo2x, lo2y, hi2x, hi2y] = cdSwap ? [dx, dy, cx, cy] : [cx, cy, dx, dy];
  // The common part goes from the larger low end to the smaller high end.
  const [lox, loy] = compare(lo1x, lo1y, lo2x, lo2y) >= 0 ? [lo1x, lo1y] : [lo2x, lo2y];
  const [hix, hiy] = compare(hi1x, hi1y, hi2x, hi2y) <= 0 ? [hi1x, hi1y] : [hi2x, hi2y];
  const order = compare(lox, loy, hix, hiy);
  return order < 0 ? OVERLAP : order === 0 ? TOUCH : DISJOINT;
}

/**
 * This function gives the exact relation of the closed segments `ab` and `cd`. The inputs must be finite.
 *
 * The rule uses the exact signs `orient(a, b, c)`, `orient(a, b, d)`, `orient(c, d, a)` and `orient(c, d, b)`. When
 * the first two signs are equal and not 0, the function stops after them.
 *
 * @returns The relation, the collinear flag and the stage.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function classifySegments(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): SegmentIntersection {
  const k1 = orientCode(ax, ay, bx, by, cx, cy);
  const k2 = orientCode(ax, ay, bx, by, dx, dy);
  let exact = k1 > 1 || k2 > 1;
  const o1 = k1 > 1 ? k1 - 3 : k1;
  const o2 = k2 > 1 ? k2 - 3 : k2;
  if (o1 * o2 > 0) return result(DISJOINT, false, exact);
  const k3 = orientCode(cx, cy, dx, dy, ax, ay);
  const k4 = orientCode(cx, cy, dx, dy, bx, by);
  exact = exact || k3 > 1 || k4 > 1;
  const o3 = k3 > 1 ? k3 - 3 : k3;
  const o4 = k4 > 1 ? k4 - 3 : k4;
  if (o3 * o4 > 0) return result(DISJOINT, false, exact);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return result(collinearRelation(ax, ay, bx, by, cx, cy, dx, dy), true, exact);
  // Here each segment meets the line of the other one. A zero sign puts an end on the other segment.
  return result(o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 ? TOUCH : CROSS, false, exact);
}
