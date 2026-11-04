/**
 * Exact expansion arithmetic on floats, from the method of Shewchuk (1997), "Adaptive Precision Floating-Point
 * Arithmetic and Fast Robust Geometric Predicates", section 2. This module is internal to the package.
 *
 * An expansion is a sum of floats with no zero, in order of increasing magnitude. Its value is the exact sum. An
 * expansion is `nonoverlapping` when no two components have a common bit position. It is `nonadjacent` when, in
 * addition, no two components have adjacent bit positions. It is `strongly nonoverlapping` when only powers of two can
 * be adjacent, and no component is adjacent to two others.
 *
 * The theorems of Shewchuk give these facts for floats of 53 bits with round to even, the rounding of ECMAScript:
 *
 * - Two-Sum, Two-Diff and Two-Product give a `nonadjacent` pair `x + y` that is exactly the true result.
 * - The expansion sum of two `nonadjacent` expansions is `nonadjacent`. `crossExpansion` is such a sum.
 * - Scale-Expansion of a `nonadjacent` expansion is `nonadjacent`.
 * - Fast-Expansion-Sum of two `strongly nonoverlapping` expansions is `strongly nonoverlapping`.
 *
 * The removal of zeros changes none of these facts.
 *
 * The theorems assume that no operation has an underflow error and that no operation overflows. `inExpansionRange` is
 * the guard of these assumptions.
 *
 * @packageDocumentation
 */
import { UNIT_ROUNDOFF } from "./sign.ts";

const U = UNIT_ROUNDOFF;

/** The splitter of Dekker for floats of 53 bits: `2^27 + 1`. */
const SPLITTER = 134217729;

/** The smallest magnitude, other than 0, that the guard of the expansion stages accepts: `2^-150`. */
export const EXPANSION_MIN: number = 2 ** -150;

/** The largest magnitude that the guard of the expansion stages accepts: `2^150`. */
export const EXPANSION_MAX: number = 2 ** 150;

/**
 * The relative error term of the result of an adaptive stage: `20u`. The TSDoc of `ORIENT_STAGE_C` and of
 * `INCIRCLE_STAGE_C` has the proof. The value of Shewchuk is `(3 + 8u) u`, and the proof of Shewchuk uses a tighter estimate.
 */
export const RESULT_BOUND: number = 20 * U;

/**
 * This function is the guard of the expansion stages. Each input of a predicate must pass it.
 *
 * The guard is sufficient for a polynomial of degree at most 4. This is the proof for underflow.
 *
 * An input that passes is 0, or it has an ulp of at least `2^-202`. So each input is a multiple of `2^-202`. A
 * difference and its tail are multiples of `2^-202` too. A rounded multiple of `2^k` is a multiple of `2^k`, because a
 * rounded value is a multiple of its own ulp, or it is exact. So each value of a product of degree `d` is a multiple of
 * `2^(-202 d)`, and at degree 4 it is a multiple of `2^-808`.
 *
 * A multiple of `2^-1074` has no underflow error, so the operations are the same as with no limit on the exponent. A
 * value of degree 4 that is not 0 is at least `2^-808`. Thus a product of that value and a bound near `2^-106` is a
 * normal float. The rounded bounds have no underflow error either.
 *
 * A difference is at most `2^151`, and a value of degree 4 is at most `2^604`. The sum of the 12 terms of a determinant
 * and each split, a factor of `2^28`, stay far below `2^1024`. So no operation overflows.
 *
 * @param x - A finite float.
 * @returns `true` when `x` is 0, or `|x|` is in `[EXPANSION_MIN, EXPANSION_MAX]`.
 */
export function inExpansionRange(x: number): boolean {
  const a = Math.abs(x);
  return a === 0 || (a >= EXPANSION_MIN && a <= EXPANSION_MAX);
}

/** This function gives the exact error `a + b - x` of the float sum `x = a + b` (Two-Sum of Knuth). */
export function twoSumTail(a: number, b: number, x: number): number {
  const bVirtual = x - a;
  const aVirtual = x - bVirtual;
  return a - aVirtual + (b - bVirtual);
}

/** This function gives the exact error `a - b - x` of the float difference `x = a - b` (Two-Diff). */
export function twoDiffTail(a: number, b: number, x: number): number {
  const bVirtual = a - x;
  const aVirtual = x + bVirtual;
  return a - aVirtual + (bVirtual - b);
}

/** This function gives the exact error of the float sum `x = a + b`, when `a` is 0 or `|a| >= |b|` (Fast-Two-Sum of Dekker). */
export function fastTwoSumTail(a: number, b: number, x: number): number {
  return b - (x - a);
}

/** This function gives the exact error `a b - x` of the float product `x = a b` (Two-Product, with the split of Dekker). */
export function twoProductTail(a: number, b: number, x: number): number {
  const ca = SPLITTER * a;
  const aHigh = ca - (ca - a);
  const aLow = a - aHigh;
  const cb = SPLITTER * b;
  const bHigh = cb - (cb - b);
  const bLow = b - bHigh;
  return aLow * bLow - (x - aHigh * bHigh - aLow * bHigh - aHigh * bLow);
}

/**
 * This function writes the exact value of `a b - c d` as a nonadjacent expansion.
 *
 * @param h - The output, with room for 4 components.
 * @returns The count of components. The count is 0 when the value is 0.
 */
export function crossExpansion(a: number, b: number, c: number, d: number, h: Float64Array): number {
  const left = a * b;
  const leftTail = twoProductTail(a, b, left);
  const right = c * d;
  const rightTail = twoProductTail(c, d, right);
  // The expansion sum of Shewchuk, with the negative of (rightTail, right).
  const q1 = leftTail - rightTail;
  const h0 = twoDiffTail(leftTail, rightTail, q1);
  const q2 = left + q1;
  const t = twoSumTail(left, q1, q2);
  const q3 = t - right;
  const h1 = twoDiffTail(t, right, q3);
  const q4 = q2 + q3;
  const h2 = twoSumTail(q2, q3, q4);
  let n = 0;
  if (h0 !== 0) h[n++] = h0;
  if (h1 !== 0) h[n++] = h1;
  if (h2 !== 0) h[n++] = h2;
  if (q4 !== 0) h[n++] = q4;
  return n;
}

/**
 * This function writes the exact product of a nonadjacent expansion and a float (Scale-Expansion of Shewchuk).
 *
 * @param n - The count of components of `e`.
 * @param e - The expansion.
 * @param b - The float.
 * @param h - The output, with room for `2 n` components. It must not be `e`.
 * @returns The count of components of `h`.
 */
export function scaleExpansion(n: number, e: Float64Array, b: number, h: Float64Array): number {
  if (n === 0) return 0;
  let out = 0;
  const first = e[0] as number;
  let q = first * b;
  const firstTail = twoProductTail(first, b, q);
  if (firstTail !== 0) h[out++] = firstTail;
  for (let i = 1; i < n; i++) {
    const c = e[i] as number;
    const product = c * b;
    const low = twoProductTail(c, b, product);
    const sum = q + low;
    const sumTail = twoSumTail(q, low, sum);
    if (sumTail !== 0) h[out++] = sumTail;
    q = product + sum;
    const tail = fastTwoSumTail(product, sum, q);
    if (tail !== 0) h[out++] = tail;
  }
  if (q !== 0) h[out++] = q;
  return out;
}

/**
 * This function writes the exact sum of two strongly nonoverlapping expansions (Fast-Expansion-Sum of Shewchuk). The
 * function uses Two-Sum in each step. Two-Sum gives the result of Fast-Two-Sum in the first step, so the theorem holds.
 *
 * @param m - The count of components of `e`.
 * @param e - The first expansion.
 * @param n - The count of components of `f`.
 * @param f - The second expansion.
 * @param h - The output, with room for `m + n` components. It must not be `e` or `f`.
 * @returns The count of components of `h`.
 */
export function sumExpansions(m: number, e: Float64Array, n: number, f: Float64Array, h: Float64Array): number {
  let i = 0;
  let j = 0;
  let out = 0;
  let q = 0;
  while (i < m || j < n) {
    const g = j >= n || (i < m && Math.abs(e[i] as number) <= Math.abs(f[j] as number)) ? (e[i++] as number) : (f[j++] as number);
    const sum = q + g;
    const tail = twoSumTail(q, g, sum);
    if (tail !== 0) h[out++] = tail;
    q = sum;
  }
  if (q !== 0) h[out++] = q;
  return out;
}

/**
 * This function gives the float sum of an expansion, from the smallest component.
 *
 * The bound: for a `strongly nonoverlapping` expansion of fewer than `2^40` components with the value `V`, the sum
 * `est` has `|V - est| <= 17u |V|`, with `u = 2^-53`.
 *
 * The proof has two parts. The first part bounds `V` from below. Let `H(k)` be the highest power of two in the component
 * `k`, and let `L(k)` be its lowest bit. With no overlap, `H(k-1) <= L(k) / 2`. So the absolute sum of the components up
 * to `k` is below `2 H(k)`, by induction.
 *
 * When the top component `t` has no adjacent component, the rest is below `H(t) / 2`, so `|V| > H(t) / 2`. When it has
 * an adjacent one, both are powers of two, and the next one is not adjacent. Then `|V| > H(t) / 4`. In each case `|V|`
 * is above `H(t) / 4`, and the top component gives the sign of `V`.
 *
 * The second part adds the errors. The partial sums are at most `2 H(k)`, and `H(k)` at least halves in each step. So
 * their absolute sum is below `4 H(t)`, which is below `16 |V|`. Each addition adds an error of at most `u` times its
 * result. This gives `16u |V|`, plus a term of order `2^-13` of that value for the errors in the partial sums.
 *
 * It follows that `|V - est| <= 18u |est|`, and that `est` has the sign of `V`.
 *
 * @param n - The count of components.
 * @param e - The expansion.
 * @returns The float sum. It is 0 only when `n` is 0.
 */
export function estimate(n: number, e: Float64Array): number {
  let q = 0;
  for (let i = 0; i < n; i++) q += e[i] as number;
  return q;
}

/**
 * This function gives the exact sign of an expansion: the sign of its top component. The proof is in the TSDoc of
 * `estimate`.
 *
 * @param n - The count of components.
 * @param e - The expansion.
 * @returns The exact sign of the value.
 */
export function expansionSign(n: number, e: Float64Array): -1 | 0 | 1 {
  if (n === 0) return 0;
  return (e[n - 1] as number) > 0 ? 1 : -1;
}
