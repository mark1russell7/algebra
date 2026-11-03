/**
 * The oracle of the property tests: the correctly rounded value of a real number, found with exact comparisons only.
 * It shares no code with the rounding of `bigfloat.ts`. A bisection finds the two neighbours of the value at a
 * precision, and one more comparison with their midpoint decides the mode `nearest`.
 */
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import type { Rounding } from "./bigfloat.ts";

/** This function gives the sign of `g × 2^w - v`, for a positive real `v` that only this function knows. */
export type Probe = (g: bigint, w: number) => -1 | 0 | 1;

const order = (a: bigint, b: bigint): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

/** This function gives the probe of a positive rational. */
export function probeOf(q: Rational): Probe {
  return (g, w) => (w >= 0 ? order((g << BigInt(w)) * q.d, q.n) : order(g * q.d, q.n << BigInt(-w)));
}

/** This function gives the probe of the root of index `k` of a positive rational. */
export function probeOfRoot(q: Rational, k: number): Probe {
  const K = BigInt(k);
  return (g, w) => {
    const power = g ** K;
    const shift = BigInt(w * k);
    return w >= 0 ? order((power << shift) * q.d, q.n) : order(power * q.d, q.n << -shift);
  };
}

/** This function gives the value `g × 2^w` as a rational. */
const dyadic = (g: bigint, w: number): Rational => (w >= 0 ? Q.rational(g << BigInt(w)) : Q.rational(g, 1n << BigInt(-w)));

/** This function gives the mode on the size of a value, from the mode on the signed value. */
function sizeMode(sign: -1 | 1, rounding: Rounding): "toward" | "away" | "nearest" {
  if (rounding === "nearest") return "nearest";
  if (rounding === "zero") return "toward";
  return (rounding === "up") === (sign > 0) ? "away" : "toward";
}

/**
 * This function gives the correctly rounded value of `sign × v`.
 *
 * @param sign - The sign of the value.
 * @param v - The probe of the positive size of the value.
 * @param guess - A first guess of the binary exponent of the size. A bad guess costs only more steps.
 * @param precision - The precision in bits.
 * @param rounding - The rounding mode.
 * @returns The exact value of the rounded result.
 */
export function correct(sign: -1 | 1, v: Probe, guess: number, precision: number, rounding: Rounding): Rational {
  let e = guess;
  while (v(1n, e) > 0) e -= 1;
  while (v(1n, e + 1) <= 0) e += 1;
  const w = e - precision + 1;
  let low = 1n << BigInt(precision - 1);
  let high = low << 1n;
  while (high - low > 1n) {
    const middle = (low + high) >> 1n;
    if (v(middle, w) <= 0) low = middle;
    else high = middle;
  }
  let g = low;
  if (v(low, w) !== 0) {
    const mode = sizeMode(sign, rounding);
    const half = v(2n * low + 1n, w - 1);
    const up = mode === "away" || (mode === "nearest" && (half < 0 || (half === 0 && (low & 1n) === 1n)));
    if (up) g = high;
  }
  const size = dyadic(g, w);
  return sign < 0 ? Q.neg(size) : size;
}

const bits = (x: bigint): number => x.toString(2).length;

/** This function gives the correctly rounded value of a rational. */
export function correctRational(q: Rational, precision: number, rounding: Rounding): Rational {
  if (q.n === 0n) return Q.ZERO;
  const size = Q.abs(q);
  return correct(q.n < 0n ? -1 : 1, probeOf(size), bits(size.n) - bits(size.d), precision, rounding);
}

/** This function gives the correctly rounded root of index `k` of a rational. An even index needs a value of 0 or more. */
export function correctRoot(q: Rational, k: number, precision: number, rounding: Rounding): Rational {
  if (q.n === 0n) return Q.ZERO;
  const size = Q.abs(q);
  const guess = Math.floor((bits(size.n) - bits(size.d)) / k);
  return correct(q.n < 0n ? -1 : 1, probeOfRoot(size, k), guess, precision, rounding);
}
