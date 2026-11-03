/**
 * The solution of equations of roadmap item A8: a polynomial or rational equation in one variable, and a system of linear
 * equations. Each result states its error, and each list of roots is complete. A result outside the limits gives
 * `"no claim"` with its reason, and it gives no partial list.
 *
 * @packageDocumentation
 */
import { fail, ok } from "@mark1russell7/coeval";
import type { Result } from "@mark1russell7/coeval";
import { NO_CLAIM } from "@mark1russell7/expression";
import type { Document, Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { attempt, divide, gcd, must, primitive, squareFree } from "./gcd.ts";
import type { SquareFreeFactor } from "./gcd.ts";
import { constantOf, degree, LIMITS, ONE, variablesOf } from "./polynomial.ts";
import type { Limits, Polynomial } from "./polynomial.ts";
import { rationalForm } from "./rational-form.ts";
import type { RationalFunction } from "./rational-function.ts";
import { denseOf, denseProduct, isolate, narrow, signAt, workOf } from "./sturm.ts";
import type { Bracket, Dense, Work } from "./sturm.ts";

/** The default width of an interval of a root: `2^-64`. */
export const TOLERANCE: Rational = Q.rational(1n, 1n << 64n);

/** The default limits of the isolation of roots. `maxProducts` counts products of two integers in one solution. */
export const SOLVE_LIMITS: Limits = { ...LIMITS, maxDegree: 256, maxProducts: 16_777_216 };

/**
 * One real root. The kind `exact` holds the rational root, with the error 0. The kind `interval` holds an irrational
 * root: the root is the one root in the open interval from `lower` to `upper`. The theorem of Sturm proves that there
 * is one, and the rational root theorem proves that it is irrational. The error is the width.
 */
export type Root =
  | { readonly kind: "exact"; readonly value: Rational; readonly multiplicity: number; readonly error: Rational }
  | { readonly kind: "interval"; readonly lower: Rational; readonly upper: Rational; readonly multiplicity: number; readonly error: Rational };

/**
 * The solution of an equation in one variable. Each claim states its error, which is the largest error of its roots.
 *
 * - `roots`: `roots` holds each real solution one time, in increasing order. The list can be empty.
 * - `all`: each real number is a solution, except the numbers of `excluded`, where the equation has no value.
 * - `no claim`: the method cannot tell. The error is `Infinity`, and `reason` tells why.
 */
export type Solution =
  | { readonly kind: "roots"; readonly variable: string | null; readonly roots: readonly Root[]; readonly error: Rational }
  | { readonly kind: "all"; readonly variable: string | null; readonly excluded: readonly Root[]; readonly error: Rational }
  | { readonly kind: typeof NO_CLAIM; readonly reason: string; readonly error: number };

/** The options of a solution. */
export interface SolveOptions {
  /** The largest width of an interval of a root, more than 0. The default is `TOLERANCE`. */
  readonly tolerance?: Rational;
  /** The limits of the isolation of roots, and of the document. The default is `SOLVE_LIMITS` and `LIMITS`. */
  readonly limits?: Limits;
}

const noClaim = (reason: string): { readonly kind: typeof NO_CLAIM; readonly reason: string; readonly error: number } => ({ kind: NO_CLAIM, reason, error: Infinity });

/** This function gives the largest error of the roots. */
const largestError = (roots: readonly Root[]): Rational => roots.reduce((best, r) => (Q.compare(r.error, best) > 0 ? r.error : best), Q.ZERO);

/** This function gives the root of a bracket. */
function rootOf(bracket: Bracket, multiplicity: number): Root {
  if ("value" in bracket) return { kind: "exact", value: bracket.value, multiplicity, error: Q.ZERO };
  return { ...bracket, kind: "interval", multiplicity, error: Q.sub(bracket.upper, bracket.lower) };
}

/** A factor of a square-free decomposition as a list of integers. */
interface Piece {
  readonly dense: Dense;
  readonly multiplicity: number;
}

/** This function gives each real root of a list of factors with no common zero. */
function rootsOf(factors: readonly SquareFreeFactor[], name: string, tolerance: Rational, work: Work): readonly Root[] {
  const pieces: Piece[] = factors.map(({ factor, multiplicity }) => ({ dense: denseOf(primitive(factor), name), multiplicity }));
  const [first, ...rest] = pieces;
  if (first === undefined) return [];
  const whole = rest.reduce((all, piece) => denseProduct(all, piece.dense, work), first.dense);
  return isolate(whole, work).map((bracket) => {
    if ("value" in bracket) {
      const piece = pieces.find((p) => signAt(p.dense, bracket.value, work) === 0) as Piece;
      return rootOf(bracket, piece.multiplicity);
    }
    // the interval has one root of the product, so one factor has the root, and it is the factor that changes sign
    const piece = pieces.find((p) => signAt(p.dense, bracket.lower, work) !== signAt(p.dense, bracket.upper, work)) as Piece;
    return rootOf(narrow(piece.dense, bracket, tolerance, work), piece.multiplicity);
  });
}

/** This function removes the zeros of the domain from a factor. */
function outsideDomain(factor: Polynomial, domain: Polynomial, limits: Limits): Polynomial {
  const out = divide(factor, must(gcd(factor, domain, limits)), limits);
  return must(out) as Polynomial;
}

/**
 * This function solves `f = 0` for a rational function in one variable. A solution is a point where `f` has a value and
 * the value is 0. A zero of the numerator that is a zero of the domain is not a solution. The multiplicity of a root is
 * its multiplicity in the numerator.
 *
 * @param f - The function.
 * @param options - The tolerance and the limits.
 * @returns The solution.
 * @throws RangeError when the tolerance is not more than 0.
 */
export function solveFunction(f: RationalFunction, options: SolveOptions = {}): Solution {
  const tolerance = options.tolerance ?? TOLERANCE;
  const limits = options.limits ?? SOLVE_LIMITS;
  if (Q.sign(tolerance) <= 0) throw new RangeError("The tolerance must be more than 0.");
  const names = [...new Set([...variablesOf(f.numerator), ...variablesOf(f.domain)])];
  if (names.length > 1) return noClaim("The equation has more than one variable.");
  const name = names[0] ?? null;
  if (degree(f.numerator) > limits.maxDegree || degree(f.domain) > limits.maxDegree) return noClaim("The degree is past the limit.");
  const solved = attempt((): Solution => {
    const work = workOf(limits);
    if (f.numerator.terms.length === 0) {
      const excluded = name === null ? [] : rootsOf([{ factor: f.domain, multiplicity: 1 }], name, tolerance, work);
      return { kind: "all", variable: name, excluded, error: largestError(excluded) };
    }
    if (name === null || constantOf(f.numerator) !== undefined) return { kind: "roots", variable: name, roots: [], error: Q.ZERO };
    const factors = must(squareFree(f.numerator, name, limits))
      .map(({ factor, multiplicity }) => ({ factor: outsideDomain(factor, f.domain, limits), multiplicity }))
      .filter(({ factor }) => degree(factor) > 0);
    const roots = rootsOf(factors, name, tolerance, work);
    return { kind: "roots", variable: name, roots, error: largestError(roots) };
  });
  return solved === NO_CLAIM ? noClaim("The solution is past a limit.") : solved;
}

/** This function gives the expression that is 0 at a solution of a document: `a - b` for `a = b`, and each other expression. */
function equationOf(doc: Document): Expression | undefined {
  if (doc.type === "lt" || doc.type === "le") return undefined;
  return doc.type === "eq" ? { type: "sub", value: doc.value as [Expression, Expression] } : (doc as Expression);
}

/**
 * This function solves one equation in one variable. A document `a = b` asks for the points where the two parts have one
 * value. Each other expression asks for the points where its value is 0. A solution is a point where each part has a
 * value.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The tolerance and the limits.
 * @returns The solution, or the error of coeval. A strict comparison is an error, because it is not an equation.
 * @throws RangeError when the tolerance is not more than 0.
 */
export function solveEquation(doc: Document, options: SolveOptions = {}): Result<Solution> {
  const equation = equationOf(doc);
  if (equation === undefined) return fail("#VALUE!", "An inequality is not an equation.");
  const made = rationalForm(equation, options.limits ?? LIMITS);
  if (!made.ok) return made;
  const form = made.value;
  if (form.kind === NO_CLAIM) return ok(noClaim("The verb rational gives no claim."));
  if (form.kind === "no value") return ok({ kind: "roots", variable: null, roots: [], error: Q.ZERO });
  return ok(solveFunction(form.value, options));
}

/** The values of the variables of a linear system. */
export type Assignment = Readonly<Record<string, Rational>>;

/**
 * The solution of a linear system. Each result is exact, so the error is zero.
 *
 * - `unique`: `values` is the one solution.
 * - `none`: the system has no solution.
 * - `family`: each solution is `particular` plus a sum of multiples of the `directions`, and each such sum is a solution.
 *   The directions are independent.
 * - `no claim`: the system is not linear in the variables, or it is past a limit. The error is `Infinity`.
 */
export type LinearSolution =
  | { readonly kind: "unique"; readonly values: Assignment; readonly error: 0 }
  | { readonly kind: "none"; readonly error: 0 }
  | { readonly kind: "family"; readonly particular: Assignment; readonly directions: readonly Assignment[]; readonly error: 0 }
  | { readonly kind: typeof NO_CLAIM; readonly reason: string; readonly error: number };

/** This function gives the row `a1, a2, ..., b` of `a1 x1 + a2 x2 + ... = b`, or `undefined` for a polynomial that is not linear. */
function rowOf(p: Polynomial, variables: readonly string[]): Rational[] | undefined {
  const row: Rational[] = variables.map(() => Q.ZERO);
  row.push(Q.ZERO);
  for (const { coefficient, powers } of p.terms) {
    const [only, second] = powers;
    if (only === undefined) {
      row[variables.length] = Q.neg(coefficient);
      continue;
    }
    const at = variables.indexOf(only.variable);
    if (second !== undefined || only.exponent !== 1 || at < 0) return undefined;
    row[at] = coefficient;
  }
  return row;
}

/** This function changes the rows into the reduced echelon form, and it gives the column of each pivot. */
function eliminate(rows: Rational[][], columns: number): readonly number[] {
  const pivots: number[] = [];
  for (let column = 0; column < columns; column++) {
    const rank = pivots.length;
    const at = rows.findIndex((row, i) => i >= rank && Q.sign(row[column] as Rational) !== 0);
    if (at < 0) continue;
    const pivot = rows[at] as Rational[];
    rows[at] = rows[rank] as Rational[];
    const scale = Q.inverse(pivot[column] as Rational);
    const unit = pivot.map((c) => Q.mul(c, scale));
    rows[rank] = unit;
    rows.forEach((row, i) => {
      const factor = row[column] as Rational;
      if (i !== rank && Q.sign(factor) !== 0) rows[i] = row.map((c, j) => Q.sub(c, Q.mul(factor, unit[j] as Rational)));
    });
    pivots.push(column);
  }
  return pivots;
}

/** This function gives the solution of rows in the reduced echelon form. */
function solutionOf(rows: readonly Rational[][], pivots: readonly number[], variables: readonly string[]): LinearSolution {
  const columns = variables.length;
  if (rows.slice(pivots.length).some((row) => Q.sign(row[columns] as Rational) !== 0)) return { kind: "none", error: 0 };
  const assignment = (values: readonly Rational[]): Assignment => Object.fromEntries(variables.map((name, i) => [name, values[i] as Rational]));
  const particular: Rational[] = variables.map(() => Q.ZERO);
  pivots.forEach((column, row) => (particular[column] = (rows[row] as Rational[])[columns] as Rational));
  if (pivots.length === columns) return { kind: "unique", values: assignment(particular), error: 0 };
  const free = variables.map((_, i) => i).filter((i) => !pivots.includes(i));
  const directions = free.map((column) => {
    const direction: Rational[] = variables.map((_, i) => (i === column ? Q.ONE : Q.ZERO));
    pivots.forEach((pivot, row) => (direction[pivot] = Q.neg((rows[row] as Rational[])[column] as Rational)));
    return assignment(direction);
  });
  return { kind: "family", particular: assignment(particular), directions, error: 0 };
}

/**
 * This function solves a system of linear equations with exact rational coefficients, by Gauss-Jordan elimination. Each
 * equation must have a polynomial of degree 1 or less in the named variables, a constant denominator and a value at each
 * point. An equation with no value at any point has no solution.
 *
 * @param equations - The documents, each one `a = b` or an expression that is 0.
 * @param variables - The names of the variables, each one time.
 * @param limits - The limits of each document. `maxProducts` also limits the products of the elimination.
 * @returns The solution, or the error of coeval.
 * @throws RangeError when a name occurs two times.
 */
export function solveLinear(equations: readonly Document[], variables: readonly string[], limits: Limits = LIMITS): Result<LinearSolution> {
  if (new Set(variables).size !== variables.length) throw new RangeError("Each variable of a system occurs one time.");
  const rows: Rational[][] = [];
  for (const doc of equations) {
    const equation = equationOf(doc);
    if (equation === undefined) return fail("#VALUE!", "An inequality is not an equation.");
    const made = rationalForm(equation, limits);
    if (!made.ok) return made;
    const form = made.value;
    if (form.kind === NO_CLAIM) return ok(noClaim("The verb rational gives no claim."));
    if (form.kind === "no value") return ok({ kind: "none", error: 0 });
    const total = form.value.domain === ONE || constantOf(form.value.domain) !== undefined;
    const row = total ? rowOf(form.value.numerator, variables) : undefined;
    if (row === undefined) return ok(noClaim("An equation is not linear in the variables, or it has no value at some points."));
    rows.push(row);
  }
  const columns = variables.length;
  if (rows.length * (columns + 1) * Math.min(rows.length, columns) > limits.maxProducts) return ok(noClaim("The system is past the limit of products."));
  return ok(solutionOf(rows, eliminate(rows, columns), variables));
}
