/**
 * The exact value and the condition number of a polynomial document at a point, with `@mark1russell7/rational`.
 *
 * The condition number is the absolute evaluation over the absolute exact value. The absolute evaluation replaces each
 * literal and each variable by its absolute value, and each `sub` by an `add`. It is the factor of the forward bound of
 * a polynomial (Higham, chapter 3). A condition of 1 tells that the evaluation has no cancellation.
 *
 * @packageDocumentation
 */
import type { Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/** The exact value of a document at a point, and the exact value of its absolute evaluation. */
export interface ExactValue {
  readonly value: Rational;
  readonly absolute: Rational;
}

/**
 * This function tells if a document is a polynomial in the sense of this module. Its kinds are `num`, `var`, `add`,
 * `sub`, `mul`, `neg`, and `pow` with an exponent of 0 or more.
 *
 * @param doc - The document.
 * @returns `true` for a polynomial document.
 */
export function isPolynomial(doc: Expression): boolean {
  switch (doc.type) {
    case "num":
    case "var":
      return true;
    case "neg":
      return isPolynomial(doc.value);
    case "pow":
      return doc.value.exp >= 0 && isPolynomial(doc.value.base);
    case "add":
    case "sub":
    case "mul":
      return doc.value.every(isPolynomial);
    default:
      return false;
  }
}

/**
 * This function gives the exact value and the exact absolute evaluation of a polynomial document at a point.
 *
 * @param doc - The document.
 * @param variables - The names of the variables, in the order of `point`.
 * @param point - The finite value of each variable.
 * @returns The two exact values, or `undefined` when the document is not a polynomial.
 */
export function exactValue(doc: Expression, variables: readonly string[], point: readonly number[]): ExactValue | undefined {
  if (!isPolynomial(doc)) return undefined;
  const values = new Map(variables.map((name, i) => [name, Q.fromFloat(point[i] as number)]));
  const walk = (e: Expression): ExactValue => {
    switch (e.type) {
      case "num": {
        const v = Q.fromFloat(e.value);
        return { value: v, absolute: Q.abs(v) };
      }
      case "var": {
        const v = values.get(e.value);
        if (v === undefined) throw new RangeError(`The variable ${e.value} has no value.`);
        return { value: v, absolute: Q.abs(v) };
      }
      case "neg": {
        const p = walk(e.value);
        return { value: Q.neg(p.value), absolute: p.absolute };
      }
      case "pow": {
        const p = walk(e.value.base);
        return { value: Q.pow(p.value, e.value.exp), absolute: Q.pow(p.absolute, e.value.exp) };
      }
      case "sub": {
        const [a, b] = e.value.map(walk) as [ExactValue, ExactValue];
        return { value: Q.sub(a.value, b.value), absolute: Q.add(a.absolute, b.absolute) };
      }
      case "add":
      case "mul": {
        const op = e.type === "add" ? Q.add : Q.mul;
        const parts = e.value.map(walk);
        return parts.reduce((x, y) => ({ value: op(x.value, y.value), absolute: op(x.absolute, y.absolute) }));
      }
      default:
        throw new RangeError(`The kind ${e.type} is not a polynomial kind.`);
    }
  };
  return walk(doc);
}

/**
 * This function gives the condition number of a polynomial document at a point. A zero value with a zero absolute
 * evaluation gives 1. A zero value with another absolute evaluation gives `Infinity`.
 *
 * @param doc - The document.
 * @param variables - The names of the variables, in the order of `point`.
 * @param point - The finite value of each variable.
 * @returns The condition number, rounded to a float, or `undefined` when the document is not a polynomial.
 */
export function condition(doc: Expression, variables: readonly string[], point: readonly number[]): number | undefined {
  const exact = exactValue(doc, variables, point);
  if (exact === undefined) return undefined;
  if (Q.sign(exact.value) === 0) return Q.sign(exact.absolute) === 0 ? 1 : Infinity;
  return Q.toNumber(Q.div(exact.absolute, Q.abs(exact.value)));
}
