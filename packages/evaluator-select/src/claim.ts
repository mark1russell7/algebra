/**
 * The claim of one evaluator at one point. Each evaluator of `@mark1russell7/expression` gives its own result. This
 * module puts each result into one form: a value, a bound of its error, and an interval that contains the exact value.
 *
 * @packageDocumentation
 */
import * as B from "@algebra/bigfloat";
import type { BigFloat } from "@algebra/bigfloat";
import { interval as I, NO_CLAIM } from "@mark1russell7/expression";
import type { Ball, BigfloatClaim, BigfloatResult, Enclosure, ExactResult, FloatResult } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/** A stage of the default plan. */
export type DefaultStage = "float" | "ball" | "interval" | "exact";

/**
 * An evaluator of the expression kinds, as a stage of a plan. The stage `bigfloat` raises the precision of the verb
 * `bigfloat`. It is not in `STAGES`, so a plan has it only when the caller names it.
 */
export type Stage = DefaultStage | "bigfloat";

/** The stages of the default plan, in the order of the roadmap: float first, exact last. */
export const STAGES: readonly DefaultStage[] = ["float", "ball", "interval", "exact"];

/**
 * What one stage tells about the exact value `x` at a point. Each field is a claim of the stage.
 *
 * - `value`: `|value - x| <= error`, and `low <= x <= high`. An infinite `error` makes no claim on the value, but
 *   `low` and `high` can still tell the sign.
 * - `no value`: the point gives no real value. The error is `0`.
 * - `no claim`: the stage cannot tell. The error is `Infinity`.
 */
export interface Claim {
  readonly kind: "value" | "no value" | "no claim";
  /** The float value. It is `NaN` for `no value` and `no claim`. */
  readonly value: number;
  /** The bound of `|value - x|`. */
  readonly error: number;
  /** The low bound of `x`. */
  readonly low: number;
  /** The high bound of `x`. */
  readonly high: number;
  /** The exact value, only from the stage `exact`. Its error is zero. */
  readonly exact?: Rational;
  /** The interval with `BigFloat` ends, only from the stage `bigfloat`. The fields above round it to doubles. */
  readonly big?: BigClaim;
}

/** The claim of the verb `bigfloat` at the precision that made it. Each point `v` of the interval has `|v - x| <= error`. */
export interface BigClaim extends BigfloatClaim {
  /** The precision of the call, in bits. */
  readonly precision: number;
}

/** The claim of no real value. */
export const NO_VALUE: Claim = { kind: "no value", value: Number.NaN, error: 0, low: Number.NaN, high: Number.NaN };

/** The claim that tells nothing. */
export const NOTHING: Claim = { kind: "no claim", value: Number.NaN, error: Infinity, low: -Infinity, high: Infinity };

const finite = (x: number): boolean => x - x === 0;
const HALF = B.fromNumber(0.5);

/** This function gives the claim of a value and an error bound, with an outward interval. */
function around(value: number, error: number): Claim {
  if (!finite(value) || !(error < Infinity)) return NOTHING;
  if (error === 0) return { kind: "value", value, error, low: value, high: value };
  return { kind: "value", value, error, low: I.nextDown(value - error), high: I.nextUp(value + error) };
}

/**
 * This function gives the claim of a result of `compileFloat`. An infinite bound makes no claim.
 *
 * @param r - The value and the bound of its error.
 * @returns The claim.
 */
export function floatClaim(r: FloatResult): Claim {
  return around(r.value, r.error);
}

/**
 * This function gives the claim of a result of `compileBall`. An infinite radius makes no claim.
 *
 * @param b - The midpoint and the radius.
 * @returns The claim.
 */
export function ballClaim(b: Ball): Claim {
  return around(b.mid, b.rad);
}

/**
 * This function gives the claim of a result of `compileInterval`. The value is the midpoint. The error is the larger
 * distance to a bound, rounded up. An infinite bound gives an infinite error, and the bounds stay.
 *
 * @param e - The interval, `null` or `"no claim"`.
 * @returns The claim.
 */
export function intervalClaim(e: Enclosure): Claim {
  if (e === null) return NO_VALUE;
  if (e === NO_CLAIM) return NOTHING;
  const [low, high] = e;
  if (low === high) return { kind: "value", value: low, error: 0, low, high };
  if (!finite(low) || !finite(high)) {
    const value = finite(low) ? low : finite(high) ? high : 0;
    return { kind: "value", value, error: Infinity, low, high };
  }
  const value = low / 2 + high / 2;
  const error = I.nextUp(Math.max(value - low, high - value));
  return { kind: "value", value, error, low, high };
}

/**
 * This function gives the claim of a result of `compileExact`. The value is the nearest float, and the error bound is
 * the distance to it, rounded up. The field `exact` keeps the rational.
 *
 * @param r - The rational, `null` or `"no claim"`.
 * @returns The claim.
 */
export function exactClaim(r: ExactResult): Claim {
  if (r === null) return NO_VALUE;
  if (r === NO_CLAIM) return NOTHING;
  const value = Q.toNumber(r);
  if (!finite(value)) {
    const low = value > 0 ? Number.MAX_VALUE : -Infinity;
    return { kind: "value", value, error: Infinity, low, high: value > 0 ? Infinity : -Number.MAX_VALUE, exact: r };
  }
  const gap = Q.abs(Q.sub(Q.fromFloat(value), r));
  let error = Q.toNumber(gap);
  if (Q.compare(Q.fromFloat(error), gap) < 0) error = I.nextUp(error);
  if (error === 0) return { kind: "value", value, error, low: value, high: value, exact: r };
  // the nearest float is nearer than each neighbour, so the neighbours bound the rational
  return { kind: "value", value, error, low: I.nextDown(value), high: I.nextUp(value), exact: r };
}

/** This function gives the largest double that is at or below a value. */
function doubleBelow(x: BigFloat): number {
  const v = B.toNumber(x);
  if (v === Infinity) return Number.MAX_VALUE;
  if (v === -Infinity) return v;
  return B.compare(B.fromNumber(v), x) > 0 ? I.nextDown(v) : v;
}

/** This function gives the smallest double that is at or above a value. */
const doubleAbove = (x: BigFloat): number => 0 - doubleBelow(B.neg(x));

/**
 * This function gives the claim of a result of `compileBigfloat`. The field `big` keeps the interval. The other fields
 * are its doubles: `value` is the double nearest to the midpoint, and `low` and `high` round outward. Thus `error`
 * includes the rounding of `value` to a double, and it can be larger than the error of `big`.
 *
 * @param r - The interval, `null` or `"no claim"`.
 * @param precision - The precision of the call, in bits.
 * @returns The claim.
 * @throws RangeError when a midpoint is past the range of a `BigFloat`.
 */
export function bigfloatClaim(r: BigfloatResult, precision: number): Claim {
  if (r === null) return NO_VALUE;
  if (r === NO_CLAIM) return NOTHING;
  const { low, high } = r;
  const low53 = doubleBelow(low);
  const high53 = doubleAbove(high);
  const big = { ...r, precision };
  const middle = B.mul(B.add(low, high, { precision: precision + 1 }), HALF, { precision: precision + 1 });
  const value = B.toNumber(middle);
  if (!finite(value)) return { kind: "value", value, error: Infinity, low: low53, high: high53, big };
  const v = B.fromNumber(value);
  const up = { precision: B.DOUBLE_PRECISION, rounding: "up" } as const;
  const above = B.sub(high, v, up);
  const below = B.sub(v, low, up);
  return { kind: "value", value, error: doubleAbove(B.compare(above, below) >= 0 ? above : below), low: low53, high: high53, big };
}
