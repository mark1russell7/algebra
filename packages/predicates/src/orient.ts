/**
 * The orientation of three points: the sign of `(a - c) x (b - c)`. The sign is positive when `a`, `b` and `c` turn
 * counterclockwise in axes with `y` up, as in the code of Shewchuk.
 *
 * The float filter answers first. When it cannot decide, the exact stage gives the sign over dyadic numbers.
 *
 * @packageDocumentation
 */
import * as D from "./dyadic.ts";
import { codeResult, codeSign, EXACT, requireFinite, UNDERFLOW_TERM, UNIT_ROUNDOFF } from "./sign.ts";
import type { Sign, SignCode, SignResult } from "./sign.ts";

const U = UNIT_ROUNDOFF;

/**
 * The relative bound of the orientation filter: `(3 + 32u) u`, with `u = 2^-53`.
 *
 * Proof sketch. Let `left = fl(fl(ax - cx) fl(by - cy))` and `right = fl(fl(ay - cy) fl(bx - cx))`, and let
 * `det = fl(left - right)`. The four differences, the two products and the last difference each add a relative error
 * of at most `u`. Shewchuk (1997, section 4.2) shows that `|det - exact|` is at most `(3u + 16u^2) |left + right|` when
 * the two products have the same sign, also after the rounding of the bound. This package doubles the term `16u^2`
 * for the rounding of the added term `UNDERFLOW_TERM`.
 *
 * When the two products have opposite signs, the sign of `det` is exact. A rounded difference has the sign of its real
 * value, and a rounded product that is not 0 has the sign of its real value. A product that rounds to 0 is at most `2^-1075` in magnitude, and `UNDERFLOW_TERM` keeps the
 * other product larger than it.
 *
 * Shewchuk assumes that no operation underflows. A difference does not underflow with an error, because a subnormal
 * difference is exact. A product that underflows adds at most `2^-1075`, and `UNDERFLOW_TERM` covers the two products.
 * An overflow gives `Infinity` or `NaN` in the bound or in `det`, and the filter then does not decide.
 */
export const ORIENT_BOUND: number = (3 + 32 * U) * U;

/**
 * This function is the orientation filter and the exact stage, as a code. The filter decides when
 * `|det| > ORIENT_BOUND * |left + right| + UNDERFLOW_TERM`.
 *
 * @returns The code of the sign and of its stage.
 */
export function orientCode(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): SignCode {
  const acx = ax - cx;
  const bcx = bx - cx;
  const acy = ay - cy;
  const bcy = by - cy;
  const left = acx * bcy;
  const right = acy * bcx;
  const det = left - right;
  const bound = ORIENT_BOUND * Math.abs(left + right) + UNDERFLOW_TERM;
  if (det > bound) return 1;
  if (-det > bound) return -1;
  return orientSlow(ax, ay, bx, by, cx, cy, acx, bcx, acy, bcy);
}

/** This function is the path of a sign that the bound does not decide. It is not inline, so the hot path stays small. */
function orientSlow(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, acx: number, bcx: number, acy: number, bcy: number): SignCode {
  requireFinite([ax, ay, bx, by, cx, cy]);
  // A difference of two finite floats is exactly 0 only when the floats are equal. Then each term has an exact 0 factor.
  if ((acx === 0 || bcy === 0) && (acy === 0 || bcx === 0)) return 0;
  // The points a and b are equal.
  if (ax === bx && ay === by) return 0;
  return orient2dExact(ax, ay, bx, by, cx, cy) + EXACT;
}

/**
 * This function gives the exact orientation sign over dyadic numbers, with no filter. Each finite float is a dyadic
 * number, so the differences and the products are exact.
 *
 * @returns The sign of `(ax - cx)(by - cy) - (ay - cy)(bx - cx)`.
 */
export function orient2dExact(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Sign {
  const x = D.fromFloat(cx);
  const y = D.fromFloat(cy);
  const acx = D.sub(D.fromFloat(ax), x);
  const bcx = D.sub(D.fromFloat(bx), x);
  const acy = D.sub(D.fromFloat(ay), y);
  const bcy = D.sub(D.fromFloat(by), y);
  return D.sign(D.sub(D.mul(acx, bcy), D.mul(acy, bcx)));
}

/**
 * This function gives the exact orientation sign of the points `a`, `b` and `c`, and the stage that decided it. The
 * inputs must be finite.
 *
 * @returns The sign is 1 when the points turn counterclockwise, -1 when they turn clockwise, and 0 when they are on one line.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function orient2d(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): SignResult {
  return codeResult(orientCode(ax, ay, bx, by, cx, cy));
}

/**
 * This function gives the exact orientation sign of `orient2d` without the stage. It is the form for a hot loop.
 *
 * @returns The exact sign.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function orient2dSign(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Sign {
  return codeSign(orientCode(ax, ay, bx, by, cx, cy));
}
