/**
 * Binary floats with a precision that the caller selects, and correct rounding of the basic operations.
 *
 * @packageDocumentation
 */
export type { BigFloat, Context, Rounding } from "./bigfloat.ts";
export {
  abs,
  add,
  compare,
  div,
  DOUBLE_PRECISION,
  equals,
  fromBigInt,
  fromNumber,
  fromRational,
  MAX_EXPONENT,
  mul,
  neg,
  root,
  round,
  sqrt,
  sub,
  toNumber,
  toRational,
  zero,
} from "./bigfloat.ts";
