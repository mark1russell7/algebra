/**
 * A seeded source of random values for the property tests. The same seed gives the same values on each run.
 */
import { type Rational, rational } from "./index.ts";

/** A source of random numbers in `[0, 1)`. */
export type Random = () => number;

/** This function makes a seeded source of random numbers (mulberry32). */
export function random(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** This function gives a random `bigint` of 0 to `bits` bits. */
export function randomBits(rnd: Random, bits: number): bigint {
  let x = 0n;
  for (let left = bits; left > 0; left -= 16) {
    const width = Math.min(16, left);
    x = (x << BigInt(width)) | BigInt(Math.floor(rnd() * 2 ** width));
  }
  return x;
}

/** This function gives a random signed `bigint`. Most values are small, and some have up to 200 bits. */
export function randomInteger(rnd: Random): bigint {
  const pick = rnd();
  const bits = pick < 0.5 ? 1 + Math.floor(rnd() * 8) : pick < 0.85 ? 1 + Math.floor(rnd() * 60) : 1 + Math.floor(rnd() * 200);
  const x = randomBits(rnd, bits);
  return rnd() < 0.5 ? -x : x;
}

/** This function gives a random rational. Approximately one in ten is 0, and some are integers. */
export function randomRational(rnd: Random): Rational {
  if (rnd() < 0.1) return rational(0n);
  let d = 0n;
  while (d === 0n) d = rnd() < 0.2 ? 1n : randomInteger(rnd);
  return rational(randomInteger(rnd), d);
}

/** This function gives a random finite double from random bits, subnormals and the extremes too. */
export function randomDouble(rnd: Random): number {
  const view = new DataView(new ArrayBuffer(8));
  for (;;) {
    view.setUint32(0, Math.floor(rnd() * 2 ** 32));
    view.setUint32(4, Math.floor(rnd() * 2 ** 32));
    const x = view.getFloat64(0);
    if (Number.isFinite(x)) return x;
  }
}

/** This function gives the next double up from a finite double. */
export function nextUp(x: number): number {
  if (x === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, x > 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

/** This function gives the next double down from a finite double. */
export function nextDown(x: number): number {
  return -nextUp(-x);
}
