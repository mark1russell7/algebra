/**
 * Exact predicates on points that move by a translation `t = (tx, ty)`. The moved point is the exact sum of a point and
 * `t`, also when the float sum rounds. A test across the antimeridian is an example: it moves a polygon by 360 degrees.
 *
 * The float sum of a coordinate and its exact tail give the exact sum. When each tail is 0, the moved point is a float,
 * and the stages of `orient2d` decide. When a tail is not 0, the shifted filter answers first, and the exact sign over
 * dyadic numbers answers the rest.
 *
 * @packageDocumentation
 */
import * as D from "./dyadic.ts";
import { twoSumTail } from "./expansion.ts";
import { orientCode } from "./orient.ts";
import { classifySegments, CROSS, DISJOINT, OVERLAP, result, TOUCH } from "./segment.ts";
import type { SegmentIntersection } from "./segment.ts";
import { codeResult, codeSign, EXACT, requireFinite, UNDERFLOW_TERM, UNIT_ROUNDOFF } from "./sign.ts";
import type { Sign, SignCode, SignResult } from "./sign.ts";

const U = UNIT_ROUNDOFF;

/**
 * The relative bound of the shifted filter: `(4 + 64u) u`, with `u = 2^-53`. The filter decides when
 * `|det| > ORIENT_SHIFTED_BOUND (|left| + |right|) + 2k + 2 UNDERFLOW_TERM`.
 *
 * Proof. Let `s` be the float sum of `c` and `t`, and let `e` be its exact tail, so `c + t = s + e`. The orientation is
 * affine in its third point: `orient(a, b, s + e) = orient(a, b, s) + L`, with `L = (ay - by) ex + (bx - ax) ey`.
 *
 * Let `left = fl(fl(ax - sx) fl(by - sy))`, `right = fl(fl(ay - sy) fl(bx - sx))` and `det = fl(left - right)`. Each
 * product has at most 3 roundings, so it is within `(3u + 13u^2)` of its real value, relative to its float value. The
 * last difference adds `u (|left| + |right|)`. So `|det - orient(a, b, s)|` is at most `(4u + 13u^2) (|left| + |right|)`.
 *
 * Let `k = fl(|fl(fl(ay - by) ex)| + |fl(fl(bx - ax) ey)|)`. It has 3 roundings on each term, so `|L| <= (1 + 4u) k`.
 *
 * The float bound has 4 roundings, so it is at least `(1 - 4u)` times its real value. `(4 + 64u) (1 - 4u)` is above
 * `4 + 13u`, and `2 (1 - 4u)` is above `1 + 4u`. A product that underflows adds at most `2^-1075`, and the four products
 * add at most `2^-1073`. A difference does not underflow with an error. The term `2 UNDERFLOW_TERM` is `2^-1068`, so it
 * covers them. When `|det|` is above the bound, `orient(a, b, s)` has the sign of `det`, and its magnitude is above `|L|`.
 * So the exact orientation has the sign of `det`. An overflow gives `Infinity` or `NaN` in the bound, and the filter
 * then does not decide.
 */
export const ORIENT_SHIFTED_BOUND: number = (4 + 64 * U) * U;

/** The underflow term of the shifted filter: `2 UNDERFLOW_TERM`. */
const SHIFTED_UNDERFLOW = 2 * UNDERFLOW_TERM;

/**
 * This function gives the exact sign of `x + t - y`. The inputs must be finite.
 *
 * The float sum `s` of `x` and `t` is the float nearest to `x + t`. So `s < y` proves `x + t < y`: if `x + t` were at
 * `y` or above, the float `y` is nearer to it than `s`. In the same way, `s > y` proves `x + t > y`. When `s` is equal
 * to `y`, the sign of the exact tail of the sum decides. A sum that overflows is past each finite `y`.
 *
 * @returns The sign is -1 when `x + t` is less than `y`, 0 when it is equal, and 1 when it is more.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function compareShifted(x: number, t: number, y: number): Sign {
  // A finite float times 0 is 0. An infinite float or NaN times 0 is NaN.
  if (x * 0 + t * 0 + y * 0 !== 0) requireFinite([x, t, y]);
  const s = x + t;
  if (s < y) return -1;
  if (s > y) return 1;
  const tail = twoSumTail(x, t, s);
  return tail < 0 ? -1 : tail > 0 ? 1 : 0;
}

/**
 * This function gives the exact orientation sign of `a`, `b` and `c + t` over dyadic numbers, with no filter.
 *
 * @returns The sign of `(ax - cx - tx)(by - cy - ty) - (ay - cy - ty)(bx - cx - tx)`.
 */
export function orient2dShiftedExact(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, tx: number, ty: number): Sign {
  const x = D.add(D.fromFloat(cx), D.fromFloat(tx));
  const y = D.add(D.fromFloat(cy), D.fromFloat(ty));
  const acx = D.sub(D.fromFloat(ax), x);
  const bcx = D.sub(D.fromFloat(bx), x);
  const acy = D.sub(D.fromFloat(ay), y);
  const bcy = D.sub(D.fromFloat(by), y);
  return D.sign(D.sub(D.mul(acx, bcy), D.mul(acy, bcx)));
}

/**
 * This function is the shifted orientation as a code. When the two sums have no rounding, the moved point is a float
 * and `orientCode` decides. Otherwise the shifted filter of `ORIENT_SHIFTED_BOUND` answers first, and the exact sign
 * over dyadic numbers answers the rest.
 */
function orientShiftedCode(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, tx: number, ty: number): SignCode {
  if (ax * 0 + ay * 0 + bx * 0 + by * 0 + cx * 0 + cy * 0 + tx * 0 + ty * 0 !== 0) requireFinite([ax, ay, bx, by, cx, cy, tx, ty]);
  const sx = cx + tx;
  const sy = cy + ty;
  const ex = twoSumTail(cx, tx, sx);
  const ey = twoSumTail(cy, ty, sy);
  // A sum that overflows is not finite. Its tail is NaN, so the filter does not decide, and the exact stage decides.
  if (ex === 0 && ey === 0) return orientCode(ax, ay, bx, by, sx, sy);
  const left = (ax - sx) * (by - sy);
  const right = (ay - sy) * (bx - sx);
  const det = left - right;
  const k = Math.abs((ay - by) * ex) + Math.abs((bx - ax) * ey);
  const bound = ORIENT_SHIFTED_BOUND * (Math.abs(left) + Math.abs(right)) + 2 * k + SHIFTED_UNDERFLOW;
  if (det > bound) return 1;
  if (-det > bound) return -1;
  return orient2dShiftedExact(ax, ay, bx, by, cx, cy, tx, ty) + EXACT;
}

/**
 * This function gives the exact orientation sign of the points `a`, `b` and `c + t`, and the stage that decided it.
 * The inputs must be finite. The sign does not change when `a` and `b` move by `-t` in place of `c` by `t`.
 *
 * @returns The sign is 1 when the points turn counterclockwise, -1 when they turn clockwise, and 0 when they are on one line.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function orient2dShifted(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, tx: number, ty: number): SignResult {
  return codeResult(orientShiftedCode(ax, ay, bx, by, cx, cy, tx, ty));
}

/**
 * This function gives the exact sign of `orient2dShifted` without the stage. It is the form for a hot loop.
 *
 * @returns The exact sign.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function orient2dShiftedSign(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, tx: number, ty: number): Sign {
  return codeSign(orientShiftedCode(ax, ay, bx, by, cx, cy, tx, ty));
}

/** The order of the point `p` and the point `q + t`, in the order of `x`, then of `y`, with no rounding. */
function compareToShifted(px: number, py: number, qx: number, qy: number, tx: number, ty: number): number {
  const x = compareShifted(qx, tx, px);
  return x !== 0 ? 0 - x : 0 - compareShifted(qy, ty, py);
}

/**
 * This function gives the order of two points in the order of `x`, then of `y`. A point moves by `t` when its flag is
 * `true`. A translation keeps the order of two moved points, so only a mixed pair needs the exact sum.
 */
function compareMoved(px: number, py: number, pMoves: boolean, qx: number, qy: number, qMoves: boolean, tx: number, ty: number): number {
  if (pMoves === qMoves) return px < qx ? -1 : px > qx ? 1 : py < qy ? -1 : py > qy ? 1 : 0;
  return pMoves ? 0 - compareToShifted(qx, qy, px, py, tx, ty) : compareToShifted(px, py, qx, qy, tx, ty);
}

/**
 * This function gives the relation of the collinear segments `ab` and `(c + t)(d + t)` from the order of their ends
 * along the line. It is `collinearRelation` of `classifySegments` with exact moved points.
 */
function shiftedCollinearRelation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, tx: number, ty: number): number {
  const abSwap = compareMoved(ax, ay, false, bx, by, false, tx, ty) > 0;
  const cdSwap = compareMoved(cx, cy, true, dx, dy, true, tx, ty) > 0;
  const [lo1x, lo1y, hi1x, hi1y] = abSwap ? [bx, by, ax, ay] : [ax, ay, bx, by];
  const [lo2x, lo2y, hi2x, hi2y] = cdSwap ? [dx, dy, cx, cy] : [cx, cy, dx, dy];
  // The common part goes from the larger low end to the smaller high end. The ends of cd move by t.
  const loMoves = compareMoved(lo1x, lo1y, false, lo2x, lo2y, true, tx, ty) < 0;
  const hiMoves = compareMoved(hi1x, hi1y, false, hi2x, hi2y, true, tx, ty) > 0;
  const [lox, loy] = loMoves ? [lo2x, lo2y] : [lo1x, lo1y];
  const [hix, hiy] = hiMoves ? [hi2x, hi2y] : [hi1x, hi1y];
  const order = compareMoved(lox, loy, loMoves, hix, hiy, hiMoves, tx, ty);
  return order < 0 ? OVERLAP : order === 0 ? TOUCH : DISJOINT;
}

/**
 * This function gives the exact relation of the closed segment `ab` and the closed segment `cd` after its move by `t`.
 * The rule is the rule of `classifySegments` on the exact moved points. The inputs must be finite.
 *
 * The function uses `orient(a, b, c + t)`, `orient(a, b, d + t)`, `orient(c, d, a - t)` and `orient(c, d, b - t)`. A
 * translation does not change an orientation, so the last two signs are `orient(c + t, d + t, a)` and
 * `orient(c + t, d + t, b)`.
 *
 * @returns The relation, the collinear flag and the stage.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function classifySegmentsShifted(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  tx: number,
  ty: number,
): SegmentIntersection {
  if (tx === 0 && ty === 0) return classifySegments(ax, ay, bx, by, cx, cy, dx, dy);
  const k1 = orientShiftedCode(ax, ay, bx, by, cx, cy, tx, ty);
  const k2 = orientShiftedCode(ax, ay, bx, by, dx, dy, tx, ty);
  let exact = k1 > 1 || k2 > 1;
  const o1 = k1 > 1 ? k1 - EXACT : k1;
  const o2 = k2 > 1 ? k2 - EXACT : k2;
  if (o1 * o2 > 0) return result(DISJOINT, false, exact);
  const k3 = orientShiftedCode(cx, cy, dx, dy, ax, ay, 0 - tx, 0 - ty);
  const k4 = orientShiftedCode(cx, cy, dx, dy, bx, by, 0 - tx, 0 - ty);
  exact = exact || k3 > 1 || k4 > 1;
  const o3 = k3 > 1 ? k3 - EXACT : k3;
  const o4 = k4 > 1 ? k4 - EXACT : k4;
  if (o3 * o4 > 0) return result(DISJOINT, false, exact);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return result(shiftedCollinearRelation(ax, ay, bx, by, cx, cy, dx, dy, tx, ty), true, exact);
  // Here each segment meets the line of the other one. A zero sign puts an end on the other segment.
  return result(o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 ? TOUCH : CROSS, false, exact);
}
