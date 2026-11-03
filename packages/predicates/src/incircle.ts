/**
 * The in-circle test of four points, as in the code of Shewchuk. The sign is positive when `d` is inside the circle
 * through `a`, `b` and `c`, and these three points turn counterclockwise. A clockwise turn changes the sign.
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
 * The relative bound of the in-circle filter: `(10 + 128u) u`, with `u = 2^-53`.
 *
 * Proof sketch. The determinant is `alift (bdx cdy - cdx bdy) + blift (cdx ady - adx cdy) + clift (adx bdy - bdx ady)`,
 * with the differences `adx = ax - dx` and the others, and `alift = adx^2 + ady^2`. The permanent is the same sum with
 * the absolute value of each product. Shewchuk (1997, section 4.3) shows that the error of the float determinant is at
 * most `(10u + 96u^2)` times the float permanent, also after the rounding of the bound. This package changes the term
 * `96u^2` to `128u^2` for the rounding of the two added underflow terms.
 *
 * Shewchuk assumes that no operation underflows. A difference does not underflow with an error, because a subnormal
 * difference is exact. Each product that underflows adds at most `2^-1075`.
 *
 * In one term, the inner products add at most `2^-1074` times a lift. The squares of a lift add at most `2^-1074` times
 * the inner difference. The inner difference is at most half the sum of the two other lifts. Thus `2^-1073 (alift + blift + clift)`, plus `2^-1073` for
 * the outer products, bounds all underflow errors. The filter adds `UNDERFLOW_TERM (alift + blift + clift + 1)`, which
 * is 16 times more. An overflow gives `Infinity` or `NaN` in the bound or in the determinant, and the filter then does
 * not decide.
 */
export const INCIRCLE_BOUND: number = (10 + 128 * U) * U;

/**
 * This function is the in-circle filter and the exact stage, as a code.
 *
 * @returns The code of the sign and of its stage.
 */
export function incircleCode(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): SignCode {
  const adx = ax - dx;
  const bdx = bx - dx;
  const cdx = cx - dx;
  const ady = ay - dy;
  const bdy = by - dy;
  const cdy = cy - dy;
  const bdxcdy = bdx * cdy;
  const cdxbdy = cdx * bdy;
  const alift = adx * adx + ady * ady;
  const cdxady = cdx * ady;
  const adxcdy = adx * cdy;
  const blift = bdx * bdx + bdy * bdy;
  const adxbdy = adx * bdy;
  const bdxady = bdx * ady;
  const clift = cdx * cdx + cdy * cdy;
  const det = alift * (bdxcdy - cdxbdy) + blift * (cdxady - adxcdy) + clift * (adxbdy - bdxady);
  const permanent =
    (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * alift + (Math.abs(cdxady) + Math.abs(adxcdy)) * blift + (Math.abs(adxbdy) + Math.abs(bdxady)) * clift;
  const bound = INCIRCLE_BOUND * permanent + UNDERFLOW_TERM * (alift + blift + clift + 1);
  if (det > bound) return 1;
  if (-det > bound) return -1;
  requireFinite([ax, ay, bx, by, cx, cy, dx, dy]);
  return incircleExact(ax, ay, bx, by, cx, cy, dx, dy) + EXACT;
}

/**
 * This function gives the exact in-circle sign over dyadic numbers, with no filter.
 *
 * @returns The sign of the determinant of Shewchuk.
 */
export function incircleExact(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): Sign {
  const x = D.fromFloat(dx);
  const y = D.fromFloat(dy);
  const adx = D.sub(D.fromFloat(ax), x);
  const bdx = D.sub(D.fromFloat(bx), x);
  const cdx = D.sub(D.fromFloat(cx), x);
  const ady = D.sub(D.fromFloat(ay), y);
  const bdy = D.sub(D.fromFloat(by), y);
  const cdy = D.sub(D.fromFloat(cy), y);
  const lift = (u: D.Dyadic, v: D.Dyadic): D.Dyadic => D.add(D.mul(u, u), D.mul(v, v));
  const cross = (p: D.Dyadic, q: D.Dyadic, r: D.Dyadic, s: D.Dyadic): D.Dyadic => D.sub(D.mul(p, q), D.mul(r, s));
  const det = D.add(
    D.add(D.mul(lift(adx, ady), cross(bdx, cdy, cdx, bdy)), D.mul(lift(bdx, bdy), cross(cdx, ady, adx, cdy))),
    D.mul(lift(cdx, cdy), cross(adx, bdy, bdx, ady)),
  );
  return D.sign(det);
}

/**
 * This function gives the exact in-circle sign of the point `d` against the circle through `a`, `b` and `c`, and the
 * stage that decided it. The inputs must be finite.
 *
 * @returns The sign is 1 when `d` is inside the circle and `a`, `b`, `c` turn counterclockwise. It is 0 when the four points are on one circle or one line.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function incircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): SignResult {
  return codeResult(incircleCode(ax, ay, bx, by, cx, cy, dx, dy));
}

/**
 * This function gives the exact in-circle sign of `incircle` without the stage. It is the form for a hot loop.
 *
 * @returns The exact sign.
 * @throws RangeError - The function refuses an input that is not finite.
 */
export function incircleSign(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): Sign {
  return codeSign(incircleCode(ax, ay, bx, by, cx, cy, dx, dy));
}
