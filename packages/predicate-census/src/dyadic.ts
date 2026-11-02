/**
 * Exact dyadic numbers `m * 2^e` over `bigint`. Each finite float is a dyadic number, and the sum, the difference and
 * the product of two dyadic numbers are dyadic too. So the predicates of this package need no division.
 *
 * @packageDocumentation
 */

/** A dyadic number: the value `m * 2^e`. */
export interface Dyadic {
  readonly m: bigint;
  readonly e: number;
}

const view = new DataView(new ArrayBuffer(8));

/**
 * This function gives the exact value of a finite float.
 *
 * @param x - The float.
 * @returns The dyadic number that is equal to `x`.
 */
export function fromFloat(x: number): Dyadic {
  if (!Number.isFinite(x)) throw new RangeError(`A dyadic number needs a finite float, not ${x}.`);
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
  return { m: bits >> 63n ? -mantissa : mantissa, e: (biased === 0 ? 1 : biased) - 1075 };
}

/** This function gives the exact sum of two dyadic numbers. */
export function add(x: Dyadic, y: Dyadic): Dyadic {
  if (x.e === y.e) return { m: x.m + y.m, e: x.e };
  return x.e < y.e ? { m: x.m + (y.m << BigInt(y.e - x.e)), e: x.e } : { m: (x.m << BigInt(x.e - y.e)) + y.m, e: y.e };
}

/** This function gives the exact negation of a dyadic number. */
export function neg(x: Dyadic): Dyadic {
  return { m: -x.m, e: x.e };
}

/** This function gives the exact difference of two dyadic numbers. */
export function sub(x: Dyadic, y: Dyadic): Dyadic {
  return add(x, neg(y));
}

/** This function gives the exact product of two dyadic numbers. */
export function mul(x: Dyadic, y: Dyadic): Dyadic {
  return { m: x.m * y.m, e: x.e + y.e };
}

/** This function gives the sign of a dyadic number: `-1`, `0` or `1`. */
export function sign(x: Dyadic): -1 | 0 | 1 {
  return x.m < 0n ? -1 : x.m > 0n ? 1 : 0;
}

/** This function compares two dyadic numbers. It gives the sign of `x - y`. */
export function compare(x: Dyadic, y: Dyadic): -1 | 0 | 1 {
  return sign(sub(x, y));
}

/**
 * This function compares a float bound with a dyadic number. An infinite bound is larger or smaller than each number.
 *
 * @param bound - The float bound.
 * @param x - The exact number.
 * @returns The sign of `bound - x`.
 */
export function compareBound(bound: number, x: Dyadic): -1 | 0 | 1 {
  if (bound === Infinity) return 1;
  if (bound === -Infinity) return -1;
  return compare(fromFloat(bound), x);
}
