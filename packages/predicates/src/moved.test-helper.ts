/**
 * The draws of the tests of moved points: floats with 53 random bits, moves across the antimeridian and float steps.
 *
 * @packageDocumentation
 */
import type { Random } from "@mark1russell7/expression";

/**
 * A value in `[0, 1)` with 53 random bits. The source gives multiples of `2^-32`, and a sum of such a value and 360 has no
 * rounding. So the cases join two values of the source.
 */
export const fine = (rnd: Random): number => (Math.floor(rnd() * 2 ** 21) * 2 ** 32 + Math.floor(rnd() * 2 ** 32)) / 2 ** 53;

/** A float with many bits, from `-scale / 2` to `scale / 2`. A sum with a multiple of 360 rounds for most of them. */
export const wide = (rnd: Random, scale: number): number => (fine(rnd) - 0.5) * scale;

/** A shift: a multiple of 360 up to two turns, as across the antimeridian, or a float with many bits. */
export const shift = (rnd: Random): number => (rnd() < 0.7 ? 360 * (Math.floor(rnd() * 5) - 2) : wide(rnd, 1000));

/** The float next to `x` in the direction of `step`: -1, 0 or 1. */
export function nextTo(x: number, step: number): number {
  if (step === 0 || !Number.isFinite(x)) return x;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigInt64(0);
  if (x === 0) return step * Number.MIN_VALUE;
  view.setBigInt64(0, bits + BigInt((x > 0) === (step > 0) ? 1 : -1));
  return view.getFloat64(0);
}
