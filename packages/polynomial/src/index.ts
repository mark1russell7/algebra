/**
 * The symbolic evaluator of A8: the canonical normal form of a polynomial with exact rational coefficients, from an
 * expression document. A result is an exact equality of polynomial functions, so its error is zero. A node that the
 * normal form cannot hold gives no claim.
 *
 * @packageDocumentation
 */
export { toDocument } from "./document.ts";
export { normalForm, POLYNOMIAL, polynomialMachine, simplify } from "./normal-form.ts";
export type { NormalForm, PolynomialResult } from "./normal-form.ts";
export {
  constant,
  constantOf,
  DEGREE_LIMIT,
  degree,
  differentiate,
  evaluate,
  key,
  LIMITS,
  multiply,
  negate,
  ONE,
  power,
  PRODUCT_LIMIT,
  scale,
  subtract,
  sum,
  TERM_LIMIT,
  variable,
  within,
  ZERO,
} from "./polynomial.ts";
export type { Limited, Limits, Polynomial, Power, Term } from "./polynomial.ts";
