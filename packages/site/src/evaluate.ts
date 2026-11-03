/**
 * The evaluators of the playground. Each one reads the same document. These are the A3 float evaluator and the A1
 * interval of the expression package, and the exact value of the census.
 *
 * @packageDocumentation
 */
import { compileFloat, summarize } from "@mark1russell7/expression";
import type { Document, Expression } from "@mark1russell7/expression";
import { exactValue } from "./census.ts";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { dyadicToRational } from "./grid.ts";

/** The kinds that the exact evaluator of the census knows. */
export const CENSUS_KINDS: readonly string[] = ["num", "var", "add", "sub", "mul", "neg", "min", "max"];

/** The result of one evaluator: a value, or the reason why it gives no value. */
export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** The results of the three evaluators of one document at one point. */
export interface Evaluation {
  /** The float value and the bound of its error, from the A3 evaluator. */
  readonly float: Outcome<FloatOutcome>;
  /** The A1 interval of the summary, with each variable at a point interval. */
  readonly interval: Outcome<readonly [number, number] | null>;
  /** The exact value, from the dyadic evaluator of the census. */
  readonly exact: Outcome<Rational>;
  /** The distance from the float value to the exact value, when both exist. */
  readonly floatError: Rational | null;
  /** The value is `true` when the bound of A3 holds for the exact value, and `null` when no check is possible. */
  readonly boundHolds: boolean | null;
  /** The value is `true` when the interval contains the exact value, and `null` when one of them is missing. */
  readonly contained: boolean | null;
}

/** The float value of A3 and the bound of its error. `Infinity` makes no claim. */
export interface FloatOutcome {
  readonly value: number;
  readonly error: number;
  /** The value is `true` for a comparison. Then the error `0` tells that the bound decides the truth value. */
  readonly comparison: boolean;
}

const COMPARISONS: readonly string[] = ["lt", "le", "eq"];

/** This function gives the first kind of a document that the census evaluators do not know, or `null`. */
export function unknownKind(doc: Document): string | null {
  if (!CENSUS_KINDS.includes(doc.type)) return doc.type;
  const value = doc.value as unknown;
  const parts = Array.isArray(value) ? value : typeof value === "object" && value !== null ? [value] : [];
  for (const part of parts) {
    const k = unknownKind(part as Document);
    if (k !== null) return k;
  }
  return null;
}

function containsExact(bounds: readonly [number, number] | null, exact: Rational): boolean {
  if (bounds === null) return false;
  const [lo, hi] = bounds;
  const below = lo === -Infinity || Q.compare(Q.fromFloat(lo), exact) <= 0;
  const above = hi === Infinity || Q.compare(Q.fromFloat(hi), exact) >= 0;
  return below && above;
}

/**
 * This function evaluates a document with each evaluator.
 *
 * @param doc - The document.
 * @param values - The float value of each variable.
 * @returns The result of each evaluator, the error of the float value and the check of the interval.
 */
export function evaluateAll(doc: Document, values: Readonly<Record<string, number>>): Evaluation {
  const missing = unknownKind(doc);
  const why = (name: string): string => `The ${name} evaluator of the census has no kind ${missing}.`;
  const compiled = compileFloat(doc);
  let float: Outcome<FloatOutcome>;
  if (compiled.ok) {
    const run = compiled.value;
    const r = run.evaluate(run.variables.map((name) => values[name] ?? Number.NaN));
    float = { ok: true, value: { value: r.value, error: r.error, comparison: COMPARISONS.includes(doc.type) } };
  } else {
    float = { ok: false, reason: `The float evaluator failed: ${compiled.error.reason}` };
  }
  const exact: Outcome<Rational> =
    missing === null ? { ok: true, value: dyadicToRational(exactValue(doc as Expression, values)) } : { ok: false, reason: why("exact") };
  const bounds: Record<string, readonly [number, number]> = {};
  for (const [k, x] of Object.entries(values)) bounds[k] = [x, x];
  const s = summarize(doc, { bounds });
  const interval: Outcome<readonly [number, number] | null> = s.ok
    ? { ok: true, value: s.value.bounds }
    : { ok: false, reason: `The summary failed: ${JSON.stringify(s).slice(0, 120)}` };
  const f = float.ok && !float.value.comparison && Number.isFinite(float.value.value) ? float.value : null;
  const floatError = f !== null && exact.ok ? Q.abs(Q.sub(Q.fromFloat(f.value), exact.value)) : null;
  const boundHolds =
    f === null || floatError === null ? null : f.error === Infinity ? true : Number.isFinite(f.error) ? Q.compare(floatError, Q.fromFloat(f.error)) <= 0 : null;
  const contained = interval.ok && exact.ok ? containsExact(interval.value, exact.value) : null;
  return { float, interval, exact, floatError, boundHolds, contained };
}

/** This function gives the sign of an exact value. */
export const exactSign = (x: Rational): -1 | 0 | 1 => Q.sign(x);

/** This function writes a rational as a decimal with `digits` significant digits, from its nearest float. */
export function approx(x: Rational, digits = 6): string {
  const v = Q.toNumber(x);
  return v === 0 && Q.sign(x) !== 0 ? (Q.sign(x) > 0 ? "a tiny positive value" : "a tiny negative value") : formatFloat(v, digits);
}

/** This function writes a float with `digits` significant digits, and an integer as it is. */
export function formatFloat(x: number, digits = 6): string {
  if (x === 0) return Object.is(x, -0) ? "-0" : "0";
  if (Number.isInteger(x) && Math.abs(x) < 1e21) return String(x);
  const a = Math.abs(x);
  return a >= 1e-4 && a < 1e9 ? String(Number(x.toPrecision(digits))) : x.toExponential(digits - 1);
}

/** This function gives the free variables of a document, from its summary: sorted, each one time. */
export function variables(doc: Document): readonly string[] {
  const s = summarize(doc);
  return s.ok ? s.value.free : [];
}
