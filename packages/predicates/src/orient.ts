/**
 * The orientation of three points: the sign of `(a - c) x (b - c)`. The sign is positive when `a`, `b` and `c` turn
 * counterclockwise in axes with `y` up, as in the code of Shewchuk.
 *
 * The float filter answers first. When it cannot decide, an adaptive stage over float expansions gives the exact sign.
 * Inputs out of the range of that stage get the exact sign over dyadic numbers.
 *
 * @packageDocumentation
 */
import * as D from "./dyadic.ts";
import { crossExpansion, estimate, expansionSign, inExpansionRange, RESULT_BOUND, sumExpansions, twoDiffTail } from "./expansion.ts";
import { codeResult, codeSign, EXACT, requireFinite, UNIT_ROUNDOFF } from "./sign.ts";
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
 * The relative bound of stage B of the adaptive stage: `(2 + 64u) u`.
 *
 * Proof. The float differences are `A = acx`, `B = bcy`, `C = acy` and `D = bcx`. Their exact tails are `a`, `b`, `c`
 * and `d`, each at most `u` times its difference. Let `P = |AB| + |CD|`. The exact value is
 * `T = (A + a)(B + b) - (C + c)(D + d)`, and stage B has the exact expansion of `V = AB - CD`. So `|T - V| <= (2 + u) u P`.
 *
 * The float `sum = |fl(AB)| + |fl(CD)|` is at least `P / (1 + u)^2`. The TSDoc of `estimate` gives
 * `|V| >= |est| / (1 + 17u)`. So `|est| > fl(ORIENT_STAGE_B sum)` gives `|V| > (2 + 64u) u P (1 - 21u)`, which is above
 * `(2 + u) u P`. Then `T` has the sign of `V`. Shewchuk (1997, section 6) has `(2 + 12u) u`, from a tighter estimate.
 */
export const ORIENT_STAGE_B: number = (2 + 64 * U) * U;

/**
 * The bound of stage C of the adaptive stage, relative to `sum`: `64 u^2`. The result term is `RESULT_BOUND`.
 *
 * Proof. With the names of `ORIENT_STAGE_B`, let `S = Ab + Ba - Cd - Dc` and let `s` be its float value. Stage C has
 * `r = fl(est + s)`. The sum of the absolute terms of `S` is at most `2u P`, and `|ab - cd| <= u^2 P`. The value `s` has
 * at most 3 operations on a term, so `|S - s| <= (6 + 7u) u^2 P` and `|s| <= (2 + 7u) u P`. Then
 *
 * `|T - r| <= u^2 P + (6 + 7u) u^2 P + 18u |est| + u |r|`, with `|est| <= (1 + u) |r| + |s|`.
 *
 * This gives `|T - r| <= (43 + O(u)) u^2 P + (19 + 18u) u |r|`. The rounded bound `64 u^2 sum + 20u |r|` is larger. When
 * `|r|` is above it, `T` has the sign of `r`. Shewchuk has `(9 + 64u) u^2`, from a tighter estimate.
 */
export const ORIENT_STAGE_C: number = 64 * U * U;

const STAGE = new Float64Array(4);
const CROSS = new Float64Array(4);
const LEFT = new Float64Array(8);
const MIDDLE = new Float64Array(12);
const FULL = new Float64Array(16);

/** This function gives the float value of the first-order term `S` of `ORIENT_STAGE_C`. It has 3 operations on a term. */
export function orientFirstOrder(acx: number, bcx: number, acy: number, bcy: number, acxTail: number, bcxTail: number, acyTail: number, bcyTail: number): number {
  return acx * bcyTail + bcy * acxTail - (acy * bcxTail + bcx * acyTail);
}

/**
 * This function gives the exact orientation sign by the adaptive stage: each step costs more than the last one, and
 * most inputs stop early. Each input must pass `inExpansionRange`.
 *
 * Stage B takes the float differences as exact. When all tails are 0, its expansion is the exact value. Stage C adds the
 * first-order terms of the tails. Stage D adds all terms, so its expansion is the exact value. The TSDoc of
 * `ORIENT_STAGE_B` and of `ORIENT_STAGE_C` has the bounds, and each answer is the exact sign.
 *
 * @returns The sign of `(ax - cx)(by - cy) - (ay - cy)(bx - cx)`.
 */
export function orientAdaptive(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Sign {
  const acx = ax - cx;
  const bcx = bx - cx;
  const acy = ay - cy;
  const bcy = by - cy;
  const stage = crossExpansion(acx, bcy, acy, bcx, STAGE);
  const est = estimate(stage, STAGE);
  const sum = Math.abs(acx * bcy) + Math.abs(acy * bcx);
  const boundB = ORIENT_STAGE_B * sum;
  if (est > boundB) return 1;
  if (-est > boundB) return -1;

  const acxTail = twoDiffTail(ax, cx, acx);
  const bcxTail = twoDiffTail(bx, cx, bcx);
  const acyTail = twoDiffTail(ay, cy, acy);
  const bcyTail = twoDiffTail(by, cy, bcy);
  if (acxTail === 0 && bcxTail === 0 && acyTail === 0 && bcyTail === 0) return expansionSign(stage, STAGE);

  const r = est + orientFirstOrder(acx, bcx, acy, bcy, acxTail, bcxTail, acyTail, bcyTail);
  const boundC = ORIENT_STAGE_C * sum + RESULT_BOUND * Math.abs(r);
  if (r > boundC) return 1;
  if (-r > boundC) return -1;

  // Stage D: the exact value is V + (A b - C d) + (a B - c D) + (a b - c d).
  const m = crossExpansion(acx, bcyTail, acy, bcxTail, CROSS);
  const left = sumExpansions(stage, STAGE, m, CROSS, LEFT);
  const n = crossExpansion(acxTail, bcy, acyTail, bcx, CROSS);
  const middle = sumExpansions(left, LEFT, n, CROSS, MIDDLE);
  const o = crossExpansion(acxTail, bcyTail, acyTail, bcxTail, CROSS);
  return expansionSign(sumExpansions(middle, MIDDLE, o, CROSS, FULL), FULL);
}

/**
 * This function is the orientation filter, as a code. The filter decides when
 * `|det| > ORIENT_BOUND * |left + right| + UNDERFLOW_TERM`.
 *
 * The two numbers in the bound are the values of `ORIENT_BOUND` and `UNDERFLOW_TERM` as literals. The engine folds a
 * literal, so the hot path has no load of a module cell. Change them together with the two constants.
 *
 * @returns The code of the sign and of its stage.
 */
export function orientCode(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): SignCode {
  const left = (ax - cx) * (by - cy);
  const right = (ay - cy) * (bx - cx);
  const det = left - right;
  const bound = ((3 + 32 * 2 ** -53) * 2 ** -53) * Math.abs(left + right) + 2 ** -1069;
  if (det > bound) return 1;
  if (-det > bound) return -1;
  return orientSlow(ax, ay, bx, by, cx, cy);
}

/** This function is the path of a sign that the bound does not decide. It is not in `orientCode`, so `orientCode` stays small. */
function orientSlow(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): SignCode {
  // A finite float times 0 is 0. An infinite float or NaN times 0 is NaN. So this test needs no array.
  if (ax * 0 + ay * 0 + bx * 0 + by * 0 + cx * 0 + cy * 0 !== 0) requireFinite([ax, ay, bx, by, cx, cy]);
  // A difference of two finite floats is exactly 0 only when the floats are equal. Then each term has an exact 0 factor.
  if ((ax === cx || by === cy) && (ay === cy || bx === cx)) return 0;
  // The points a and b are equal.
  if (ax === bx && ay === by) return 0;
  if (inExpansionRange(ax) && inExpansionRange(ay) && inExpansionRange(bx) && inExpansionRange(by) && inExpansionRange(cx) && inExpansionRange(cy)) {
    return orientAdaptive(ax, ay, bx, by, cx, cy) + EXACT;
  }
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
