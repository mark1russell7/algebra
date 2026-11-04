/**
 * The symbolic evaluator of A8. It gives the canonical normal form of a polynomial and of a rational function with exact
 * rational coefficients, from an expression document. It solves linear and polynomial equations. A normal form is an
 * exact equality of functions, so its error is zero. Each root states its error. A node that a form cannot hold gives no
 * claim.
 *
 * @packageDocumentation
 */
export { toDocument, toRationalDocument } from "./document.ts";
export { divide, gcd, monic, primitive, radical, squareFree, STEP_BITS } from "./gcd.ts";
export type { SquareFreeFactor } from "./gcd.ts";
export { addVerb, normalForm, POLYNOMIAL, polynomialMachine, simplify } from "./normal-form.ts";
export type { NormalForm, PolynomialResult, VerbRules } from "./normal-form.ts";
export {
  coefficientsIn,
  constant,
  constantOf,
  DEGREE_LIMIT,
  degree,
  differentiate,
  evaluate,
  fromCoefficients,
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
  variablesOf,
  within,
  ZERO,
} from "./polynomial.ts";
export type { Limited, Limits, Polynomial, Power, Term } from "./polynomial.ts";
export { RATIONAL, rationalForm, rationalMachine, simplifyRational } from "./rational-form.ts";
export type { RationalForm, RationalResult } from "./rational-form.ts";
export * as functions from "./rational-function.ts";
export type { LimitedFunction, PartialFunction, RationalFunction } from "./rational-function.ts";
export { SOLVE_LIMITS, solveEquation, solveFunction, solveLinear, TOLERANCE } from "./solve.ts";
export type { Assignment, LinearSolution, Root, Solution, SolveOptions } from "./solve.ts";
