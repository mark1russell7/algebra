/**
 * The evaluators of the playground. Each one reads the same document. These are the A3 float evaluator, the A4
 * interval and ball evaluators and the A1 interval of the expression package, and the exact value of the census.
 *
 * @packageDocumentation
 */
import { compileBall, compileFloat, compileInterval, decideBall, decideInterval, interval as I, NO_CLAIM, summarize } from "@mark1russell7/expression";
import type { Ball, Document, Enclosure } from "@mark1russell7/expression";
import { exactValue } from "./census.ts";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { dyadicToRational } from "./grid.ts";

/** The kinds that the exact evaluator of the census knows. */
export const CENSUS_KINDS: readonly string[] = ["num", "var", "add", "sub", "mul", "neg", "min", "max"];

/** The result of one evaluator: a value, or the reason why it gives no value. */
export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** The results of the evaluators of one document at one point. */
export interface Evaluation {
  /** The value is `true` for a comparison document. Then each value is 1 for true and 0 for false. */
  readonly comparison: boolean;
  /** The float value and the bound of its error, from the A3 evaluator. */
  readonly float: Outcome<FloatOutcome>;
  /** The A4 interval of `compileInterval`: an interval, `null` for no real value, or `"no claim"`. */
  readonly enclosure: Outcome<Enclosure>;
  /** The A4 ball of `compileBall`: a midpoint and a radius. */
  readonly ball: Outcome<Ball>;
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
  if (!CENSUS_KINDS.includes(doc.type) && !COMPARISONS.includes(doc.type)) return doc.type;
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
  const comparison = COMPARISONS.includes(doc.type);
  const compiled = compileFloat(doc);
  let float: Outcome<FloatOutcome>;
  if (compiled.ok) {
    const run = compiled.value;
    const r = run.evaluate(run.variables.map((name) => values[name] ?? Number.NaN));
    float = { ok: true, value: { value: r.value, error: r.error, comparison } };
  } else {
    float = { ok: false, reason: `The float evaluator failed: ${compiled.error.reason}` };
  }
  const iv = compileInterval(doc);
  const enclosure: Outcome<Enclosure> = iv.ok
    ? { ok: true, value: iv.value.evaluate(iv.value.variables.map((name) => values[name] ?? Number.NaN)) }
    : { ok: false, reason: `The interval evaluator failed: ${iv.error.reason}` };
  const b = compileBall(doc);
  const ball: Outcome<Ball> = b.ok
    ? { ok: true, value: b.value.evaluate(b.value.variables.map((name) => values[name] ?? Number.NaN)) }
    : { ok: false, reason: `The ball evaluator failed: ${b.error.reason}` };
  const exact: Outcome<Rational> = missing === null ? { ok: true, value: exactOf(doc, values) } : { ok: false, reason: why("exact") };
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
  return { comparison, float, enclosure, ball, interval, exact, floatError, boundHolds, contained };
}

/** This function gives the exact value of a document. A comparison gives 1 for true and 0 for false. */
function exactOf(doc: Document, values: Readonly<Record<string, number>>): Rational {
  if (doc.type !== "lt" && doc.type !== "le" && doc.type !== "eq") return dyadicToRational(exactValue(doc, values));
  const [l, r] = doc.value.map((part) => dyadicToRational(exactValue(part, values))) as [Rational, Rational];
  const c = Q.compare(l, r);
  const truth = doc.type === "lt" ? c < 0 : doc.type === "le" ? c <= 0 : c === 0;
  return Q.rational(truth ? 1n : 0n);
}

/** The answer of one evaluator: a sign, a truth value of a comparison, `"undecided"`, or `"no value"`. */
export type Decision = -1 | 0 | 1 | boolean | "undecided" | "no value";

/** The answer of each evaluator. The value is `null` when the evaluator gives no result. */
export interface Decisions {
  readonly float: Decision | null;
  readonly enclosure: Decision | null;
  readonly ball: Decision | null;
  readonly interval: Decision | null;
  readonly exact: Decision | null;
}

/** This function gives the sign that an interval fixes, or `"undecided"`. */
function intervalSign(x: readonly [number, number]): Decision {
  if (x[0] > 0) return 1;
  if (x[1] < 0) return -1;
  return x[0] === 0 && x[1] === 0 ? 0 : "undecided";
}

const truth = (x: number): Decision => (x === 1 ? true : x === 0 ? false : "undecided");

function floatDecision(f: FloatOutcome, comparison: boolean): Decision {
  if (comparison) return f.error === 0 ? truth(f.value) : "undecided";
  return f.error === 0 || Math.abs(f.value) > f.error ? (Math.sign(f.value) as -1 | 0 | 1) : "undecided";
}

function enclosureDecision(x: Enclosure, comparison: boolean): Decision {
  if (comparison) return decideInterval(x);
  if (x === null) return "no value";
  return x === NO_CLAIM ? "undecided" : intervalSign(x);
}

function ballDecision(x: Ball, comparison: boolean): Decision {
  if (comparison) return decideBall(x);
  return x.rad === 0 || Math.abs(x.mid) > x.rad ? (Math.sign(x.mid) as -1 | 0 | 1) : "undecided";
}

function boundsDecision(x: readonly [number, number] | null, comparison: boolean): Decision {
  if (x === null) return "no value";
  if (comparison) return x[0] === x[1] ? truth(x[0]) : "undecided";
  return intervalSign(x);
}

/**
 * This function gives the sign, or the truth value of a comparison, that each evaluator proves. A comparison uses
 * `decideInterval` and `decideBall` of A4. A ball proves a sign when `|mid| > rad`. That float comparison is exact.
 *
 * @param e - The results of the evaluators.
 * @returns The answer of each evaluator.
 */
export function decisions(e: Evaluation): Decisions {
  const c = e.comparison;
  return {
    float: e.float.ok ? floatDecision(e.float.value, c) : null,
    enclosure: e.enclosure.ok ? enclosureDecision(e.enclosure.value, c) : null,
    ball: e.ball.ok ? ballDecision(e.ball.value, c) : null,
    interval: e.interval.ok ? boundsDecision(e.interval.value, c) : null,
    exact: !e.exact.ok ? null : c ? truth(Q.toNumber(e.exact.value)) : Q.sign(e.exact.value),
  };
}

/**
 * This function gives the width of an interval, rounded upward. A point interval has the width 0.
 *
 * @param x - The interval.
 * @returns A float that is at least `hi - lo`.
 */
export function widthOf(x: readonly [number, number]): number {
  const w = I.sub([x[1], x[1]], [x[0], x[0]]);
  return w === null ? Infinity : w[1];
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
