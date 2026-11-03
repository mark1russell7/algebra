/**
 * The way back from a polynomial to a document. The document has the same exact value as the polynomial at each point.
 * A coefficient that has no exact float becomes a quotient of integers, and a large integer becomes a sum of limbs.
 * Thus the literals of the document stay exact floats, and the kinds of the document do not change.
 *
 * @packageDocumentation
 */
import type { Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import type { Polynomial, Power, Term } from "./polynomial.ts";

/** The bits of one limb of a large integer. A limb of this size is an exact float. */
const LIMB_BITS = 52n;
const LIMB = 1n << LIMB_BITS;

const num = (value: number): Expression => ({ type: "num", value });

/** This function gives the float of a rational, when the float is exactly the rational. */
function exactFloat(value: Rational): number | undefined {
  const float = Q.toNumber(value);
  return Number.isFinite(float) && Q.equals(Q.fromFloat(float), value) ? float : undefined;
}

/** This function gives a document of a whole number of 0 or more. */
function wholeDocument(value: bigint): Expression {
  const float = exactFloat(Q.rational(value));
  if (float !== undefined) return num(float);
  const low = Number(value % LIMB);
  return { type: "add", value: [{ type: "mul", value: [wholeDocument(value >> LIMB_BITS), num(Number(LIMB))] }, num(low)] };
}

/** This function gives a document of an integer. */
function integerDocument(value: bigint): Expression {
  return value < 0n ? { type: "neg", value: wholeDocument(-value) } : wholeDocument(value);
}

/** This function gives a document of a rational. */
function coefficientDocument(value: Rational): Expression {
  const float = exactFloat(value);
  if (float !== undefined) return num(float);
  return value.d === 1n ? integerDocument(value.n) : { type: "div", value: [integerDocument(value.n), integerDocument(value.d)] };
}

const powerDocument = ({ variable, exponent }: Power): Expression => {
  const base: Expression = { type: "var", value: variable };
  return exponent === 1 ? base : { type: "pow", value: { base, exp: exponent } };
};

function termDocument({ coefficient, powers }: Term): Expression {
  const factors = powers.map(powerDocument);
  if (!Q.equals(coefficient, Q.ONE) || factors.length === 0) factors.unshift(coefficientDocument(coefficient));
  const [first, second, ...rest] = factors as [Expression, ...Expression[]];
  return second === undefined ? first : { type: "mul", value: [first, second, ...rest] };
}

/**
 * This function gives a document of a polynomial: a sum of terms in the canonical order. Equal polynomials give equal
 * documents. The zero polynomial gives the literal `0`.
 *
 * @param p - The polynomial.
 * @returns The document.
 */
export function toDocument(p: Polynomial): Expression {
  const [first, second, ...rest] = p.terms.map(termDocument);
  if (first === undefined) return num(0);
  return second === undefined ? first : { type: "add", value: [first, second, ...rest] };
}
