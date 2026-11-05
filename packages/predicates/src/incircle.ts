/**
 * The in-circle test of four points, as in the code of Shewchuk. The sign is positive when `d` is inside the circle
 * through `a`, `b` and `c`, and these three points turn counterclockwise. A clockwise turn changes the sign.
 *
 * The float filter answers first. When it cannot decide, an adaptive stage over float expansions answers most inputs.
 * The exact sign over dyadic numbers answers the rest.
 *
 * @packageDocumentation
 */
import * as D from "./dyadic.ts";
import { crossExpansion, estimate, expansionSign, inExpansionRange, RESULT_BOUND, scaleExpansion, sumExpansions, twoDiffTail } from "./expansion.ts";
import { codeResult, codeSign, EXACT, requireFinite, UNIT_ROUNDOFF } from "./sign.ts";
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
 * the outer products, bounds all underflow errors. The filter adds `INCIRCLE_UNDERFLOW_TERM (alift + blift + clift + 1)`,
 * which is more than `2^-1073 (alift + blift + clift + 1)`. An overflow gives `Infinity` or `NaN` in the bound or in the determinant, and the filter then does
 * not decide.
 */
export const INCIRCLE_BOUND: number = (10 + 128 * U) * U;

/**
 * The factor of the underflow term of the in-circle filter: `2^-1022`, the smallest normal float.
 *
 * The filter multiplies this factor by `alift + blift + clift + 1` at each call. That sum is at least 1, so the product
 * is a normal float. A product with a subnormal result costs many cycles on some processors. With the factor `2^-1069`,
 * run 41896000324 on an Intel Xeon measured approximately 37 ns more than `robust-predicates` at each call.
 *
 * A larger factor makes the bound larger, so the filter stays sound. The filter decides fewer inputs only when the
 * determinant is near `2^-1022` or smaller, so the differences of the points are near `2^-255` or smaller.
 */
export const INCIRCLE_UNDERFLOW_TERM: number = 2 ** -1022;

/**
 * The relative bound of stage B of the adaptive stage: `(4 + 128u) u`.
 *
 * Proof. Stage B has the exact expansion `V` of the determinant of the float differences. The exact value `T` is the
 * same polynomial of the true differences. Each difference has a relative error of at most `u`, and each term has degree
 * 4. Let `Q` be the sum of the absolute terms of `V`. Then `|T - V| <= ((1 + u)^4 - 1) Q <= (4 + 7u) u Q`.
 *
 * Each term of the float `permanent` has at most 5 operations, so `permanent >= Q / (1 + u)^5`. The TSDoc of `estimate`
 * gives `|V| >= |est| / (1 + 17u)`. So `|est| > fl(INCIRCLE_STAGE_B permanent)` gives `|V| > (4 + 128u) u Q (1 - 23u)`, which
 * is above `(4 + 7u) u Q`. Then `T` has the sign of `V`. Shewchuk (1997, section 6) has `(4 + 48u) u`, from a tighter
 * estimate.
 */
export const INCIRCLE_STAGE_B: number = (4 + 128 * U) * U;

/**
 * The bound of stage C of the adaptive stage, relative to `permanent`: `128 u^2`. The result term is `RESULT_BOUND`.
 *
 * Proof. Write `T` as the sum of `(l + m + n)(x + y + z)` over the three rows. Here `l` is the lift and `x` is the cross
 * product of the float differences. The values `m` and `y` are their first-order terms in the tails, and `n` and `z` are
 * their second-order terms. The tails are at most `u` times their differences. So, with `Q` of `INCIRCLE_STAGE_B`:
 *
 * - The first-order sum `S` of the terms `l y + m x` has absolute terms of at most `4u Q`.
 * - The rest, the terms of order 2 and more, is at most `(6 + 4u + u^2) u^2 Q`.
 * - The float value `s` of `S` has at most 9 operations on a term. So `|S - s| <= (36 + 148u) u^2 Q`, and `|s| <= (4 + 37u) u Q`.
 *
 * Stage C has `r = fl(est + s)`, and `|est| <= (1 + u) |r| + |s|`. With `|V - est| <= 18u |est|`, this gives
 * `|T - r| <= (114 + O(u)) u^2 Q + (19 + 18u) u |r|`. The rounded bound `128 u^2 permanent + 20u |r|` is larger. When `|r|`
 * is above it, `T` has the sign of `r`. Shewchuk has `(44 + 576u) u^2`, from a tighter estimate.
 */
export const INCIRCLE_STAGE_C: number = 128 * U * U;

/** The answer of `incircleAdaptive` when its stages do not decide. */
export const UNDECIDED = 2;

/** The largest count of components of the expansion of stage B. */
export const INCIRCLE_COMPONENTS = 96;

const CROSS = new Float64Array(4);
const SCALED = new Float64Array(8);
const X_SQUARED = new Float64Array(16);
const Y_SQUARED = new Float64Array(16);
const ROW_A = new Float64Array(32);
const ROW_B = new Float64Array(32);
const ROW_C = new Float64Array(32);
const TWO_ROWS = new Float64Array(64);
const ALL_ROWS = new Float64Array(INCIRCLE_COMPONENTS);

/**
 * This function writes the exact value of `(u^2 + v^2) x`, where `x` is the expansion of `crossExpansion`.
 *
 * @param n - The count of components of `CROSS`.
 * @param u - The first difference.
 * @param v - The second difference.
 * @param h - The output, with room for 32 components.
 * @returns The count of components of `h`.
 */
function liftedRow(n: number, u: number, v: number, h: Float64Array): number {
  const x = scaleExpansion(scaleExpansion(n, CROSS, u, SCALED), SCALED, u, X_SQUARED);
  const y = scaleExpansion(scaleExpansion(n, CROSS, v, SCALED), SCALED, v, Y_SQUARED);
  return sumExpansions(x, X_SQUARED, y, Y_SQUARED, h);
}

/**
 * This function writes the exact determinant of the float differences, the value `V` of stage B.
 *
 * @param h - The output, with room for `INCIRCLE_COMPONENTS` components.
 * @returns The count of components of `h`.
 */
export function incircleStageB(adx: number, bdx: number, cdx: number, ady: number, bdy: number, cdy: number, h: Float64Array): number {
  const a = liftedRow(crossExpansion(bdx, cdy, cdx, bdy, CROSS), adx, ady, ROW_A);
  const b = liftedRow(crossExpansion(cdx, ady, adx, cdy, CROSS), bdx, bdy, ROW_B);
  const c = liftedRow(crossExpansion(adx, bdy, bdx, ady, CROSS), cdx, cdy, ROW_C);
  return sumExpansions(sumExpansions(a, ROW_A, b, ROW_B, TWO_ROWS), TWO_ROWS, c, ROW_C, h);
}

/** This function gives the float value of the first-order term `S` of `INCIRCLE_STAGE_C`. It has at most 9 operations on a term. */
export function incircleFirstOrder(
  adx: number,
  bdx: number,
  cdx: number,
  ady: number,
  bdy: number,
  cdy: number,
  adxTail: number,
  bdxTail: number,
  cdxTail: number,
  adyTail: number,
  bdyTail: number,
  cdyTail: number,
): number {
  const alift = adx * adx + ady * ady;
  const blift = bdx * bdx + bdy * bdy;
  const clift = cdx * cdx + cdy * cdy;
  const a = alift * (bdx * cdyTail + cdy * bdxTail - (bdy * cdxTail + cdx * bdyTail)) + 2 * (adx * adxTail + ady * adyTail) * (bdx * cdy - cdx * bdy);
  const b = blift * (cdx * adyTail + ady * cdxTail - (cdy * adxTail + adx * cdyTail)) + 2 * (bdx * bdxTail + bdy * bdyTail) * (cdx * ady - adx * cdy);
  const c = clift * (adx * bdyTail + bdy * adxTail - (ady * bdxTail + bdx * adyTail)) + 2 * (cdx * cdxTail + cdy * cdyTail) * (adx * bdy - bdx * ady);
  return a + b + c;
}

/** This function gives the float `permanent` of the differences. Each term has at most 5 operations. */
export function incirclePermanent(adx: number, bdx: number, cdx: number, ady: number, bdy: number, cdy: number): number {
  return (
    (Math.abs(bdx * cdy) + Math.abs(cdx * bdy)) * (adx * adx + ady * ady) +
    (Math.abs(cdx * ady) + Math.abs(adx * cdy)) * (bdx * bdx + bdy * bdy) +
    (Math.abs(adx * bdy) + Math.abs(bdx * ady)) * (cdx * cdx + cdy * cdy)
  );
}

/**
 * This function gives the exact in-circle sign by the adaptive stage, or `UNDECIDED`. Each input must pass
 * `inExpansionRange`.
 *
 * Stage B takes the float differences as exact. When all tails are 0, its expansion is the exact value. Stage C adds the
 * first-order terms of the tails. The TSDoc of `INCIRCLE_STAGE_B` and of `INCIRCLE_STAGE_C` has the bounds. After stage C,
 * the value is 0 or below about `2^-99` of the permanent. An exact expansion of such a value costs as much as the exact
 * stage over dyadic numbers, so that stage answers.
 *
 * @returns The exact sign, or `UNDECIDED`.
 */
export function incircleAdaptive(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): Sign | typeof UNDECIDED {
  const adx = ax - dx;
  const bdx = bx - dx;
  const cdx = cx - dx;
  const ady = ay - dy;
  const bdy = by - dy;
  const cdy = cy - dy;

  const all = incircleStageB(adx, bdx, cdx, ady, bdy, cdy, ALL_ROWS);
  const est = estimate(all, ALL_ROWS);
  const permanent = incirclePermanent(adx, bdx, cdx, ady, bdy, cdy);
  const boundB = INCIRCLE_STAGE_B * permanent;
  if (est > boundB) return 1;
  if (-est > boundB) return -1;

  const adxTail = twoDiffTail(ax, dx, adx);
  const bdxTail = twoDiffTail(bx, dx, bdx);
  const cdxTail = twoDiffTail(cx, dx, cdx);
  const adyTail = twoDiffTail(ay, dy, ady);
  const bdyTail = twoDiffTail(by, dy, bdy);
  const cdyTail = twoDiffTail(cy, dy, cdy);
  if (adxTail === 0 && bdxTail === 0 && cdxTail === 0 && adyTail === 0 && bdyTail === 0 && cdyTail === 0) return expansionSign(all, ALL_ROWS);

  const r = est + incircleFirstOrder(adx, bdx, cdx, ady, bdy, cdy, adxTail, bdxTail, cdxTail, adyTail, bdyTail, cdyTail);
  const boundC = INCIRCLE_STAGE_C * permanent + RESULT_BOUND * Math.abs(r);
  if (r > boundC) return 1;
  if (-r > boundC) return -1;
  return UNDECIDED;
}

/**
 * This function is the in-circle filter, as a code.
 *
 * The numbers in the bound are the values of `INCIRCLE_BOUND` and `INCIRCLE_UNDERFLOW_TERM` as literals. The engine folds a
 * literal, so the hot path has no load of a module cell. Change them together with the two constants. The bytecode of
 * this function must stay below 460 bytes, the limit of the engine for an inlined function. Above it, each call boxes 8
 * floats.
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
  const bound = ((10 + 128 * 2 ** -53) * 2 ** -53) * permanent + 2 ** -1022 * (alift + blift + clift + 1);
  if (det > bound) return 1;
  if (-det > bound) return -1;
  return incircleSlow(ax, ay, bx, by, cx, cy, dx, dy);
}

/** This function is the path of a sign that the bound does not decide. It is not in `incircleCode`, so `incircleCode` stays small. */
function incircleSlow(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): SignCode {
  // A finite float times 0 is 0. An infinite float or NaN times 0 is NaN. So this test needs no array.
  if (ax * 0 + ay * 0 + bx * 0 + by * 0 + cx * 0 + cy * 0 + dx * 0 + dy * 0 !== 0) requireFinite([ax, ay, bx, by, cx, cy, dx, dy]);
  // The determinant has two equal rows when a, b or c repeats, and a row of 0 when d is equal to one of them.
  if ((ax === bx && ay === by) || (ax === cx && ay === cy) || (bx === cx && by === cy) || (ax === dx && ay === dy) || (bx === dx && by === dy) || (cx === dx && cy === dy)) return 0;
  if (
    inExpansionRange(ax) &&
    inExpansionRange(ay) &&
    inExpansionRange(bx) &&
    inExpansionRange(by) &&
    inExpansionRange(cx) &&
    inExpansionRange(cy) &&
    inExpansionRange(dx) &&
    inExpansionRange(dy)
  ) {
    const sign = incircleAdaptive(ax, ay, bx, by, cx, cy, dx, dy);
    if (sign !== UNDECIDED) return sign + EXACT;
  }
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
