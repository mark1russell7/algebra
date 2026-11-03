/**
 * The exact oracle and the corpus of the property tests of the compiled evaluators. The corpus is the documents of
 * the seeded generator and random points. The oracle gives an enclosure of the exact value with `@mark1russell7/rational`.
 */
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { DEGENERATE_CONSTANTS, random, randomComparison, randomExpression } from "./generate.ts";
import type { Random } from "./generate.ts";
import type { Document, Expression } from "./schema.ts";

/** The environment of the process. This file is also in the source build, which has no types of Node. */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** The count of random documents of each property. The variable `PROPERTY_RUNS` sets it. The default is 1000. */
export const RUNS: number = Number(env["PROPERTY_RUNS"] ?? 1000);
/** The count of random points of each document. */
export const POINTS: number = 4;
export const VARS: readonly string[] = ["x", "y", "z"];
/** The time limit of a property test, in milliseconds. The exact oracle is slow on a large corpus. */
export const LONG: number = 30_000 + RUNS * 60;

// ---------------------------------------------------------------------------------------------------------------
// The exact oracle: an enclosure of the exact real value with rational ends. A root-free document gives a point.
// A root gives an interval of width 2^-PREC around the real root. "none": no real value. "unknown": the enclosure
// cannot tell (a divisor interval with zero inside, an even root of an interval with negative points).
// ---------------------------------------------------------------------------------------------------------------

export interface Enc {
  readonly lo: Rational;
  readonly hi: Rational;
}
export type Oracle = Enc | "none" | "unknown" | "large";

/** The oracle gives up on a rational with more bits than this: a deep power of a tiny constant has 10^5 bits or more. */
const LIMIT = 1n << 6000n;
const small = (r: Rational): boolean => (r.n < 0n ? -r.n : r.n) < LIMIT && r.d < LIMIT;

const PREC = 1200;
const point = (r: Rational): Enc => ({ lo: r, hi: r });
export const isPoint: (e: Enc) => boolean = (e: Enc): boolean => Q.equals(e.lo, e.hi);
const minR = (a: Rational, b: Rational): Rational => (Q.compare(a, b) <= 0 ? a : b);
const maxR = (a: Rational, b: Rational): Rational => (Q.compare(a, b) >= 0 ? a : b);
const hull = (xs: readonly Rational[]): Enc => ({ lo: xs.reduce(minR), hi: xs.reduce(maxR) });
const containsZero = (e: Enc): boolean => Q.sign(e.lo) <= 0 && Q.sign(e.hi) >= 0;

/** The integer k-th root of n >= 0, rounded down (Newton on bigint). */
/** Rational bounds of the k-th root of r >= 0: lo <= root(r) <= hi, with hi - lo <= 2^-PREC. */
function rootEnc(r: Rational, k: number): Enc {
  const scale = 1n << BigInt(PREC * k);
  const m = Q.integerRoot((r.n * scale) / r.d, k);
  const den = 1n << BigInt(PREC);
  const lo = Q.rational(m, den);
  return Q.equals(Q.pow(lo, k), r) ? point(lo) : { lo, hi: Q.rational(m + 1n, den) };
}

function signedRoot(r: Rational, k: number): Enc {
  if (Q.sign(r) >= 0) return rootEnc(r, k);
  const e = rootEnc(Q.neg(r), k);
  return { lo: Q.neg(e.hi), hi: Q.neg(e.lo) };
}

function powEnc(e: Enc, n: number): Oracle {
  if (n === 0) return point(Q.ONE);
  if (n < 0) {
    if (containsZero(e)) return isPoint(e) ? "none" : "unknown";
    const p = powEnc(e, -n) as Enc;
    return hull([Q.inverse(p.lo), Q.inverse(p.hi)]);
  }
  const ends = [Q.pow(e.lo, n), Q.pow(e.hi, n)];
  if (n % 2 === 0 && containsZero(e)) return { lo: Q.ZERO, hi: ends.reduce(maxR) };
  return hull(ends);
}

export function oracle(doc: Document, at: Readonly<Record<string, number>>): Oracle {
  const v = oracleOf(doc, at);
  return typeof v === "string" || (small(v.lo) && small(v.hi)) ? v : "large";
}

function oracleOf(doc: Document, at: Readonly<Record<string, number>>): Oracle {
  const many = (xs: readonly Expression[]): Enc[] | "none" | "unknown" | "large" => {
    const out: Enc[] = [];
    let unknown: "unknown" | "large" | undefined;
    for (const x of xs) {
      const v = oracle(x, at);
      if (v === "none") return "none";
      if (v === "unknown" || v === "large") unknown = unknown === "large" ? "large" : v;
      else out.push(v);
    }
    return unknown ?? out;
  };
  switch (doc.type) {
    case "num":
      return point(Q.fromFloat(doc.value));
    case "var": {
      const v = at[doc.value] as number;
      return Number.isFinite(v) ? point(Q.fromFloat(v)) : "none";
    }
    case "neg": {
      const v = oracle(doc.value, at);
      return typeof v === "string" ? v : { lo: Q.neg(v.hi), hi: Q.neg(v.lo) };
    }
    case "pow": {
      const v = oracle(doc.value.base, at);
      return typeof v === "string" ? v : powEnc(v, doc.value.exp);
    }
    case "root": {
      const v = oracle(doc.value.radicand, at);
      if (typeof v === "string") return v;
      const k = doc.value.index;
      if (k % 2 === 0) {
        if (Q.sign(v.hi) < 0) return "none";
        if (Q.sign(v.lo) < 0) return "unknown";
      }
      return { lo: signedRoot(v.lo, k).lo, hi: signedRoot(v.hi, k).hi };
    }
    default: {
      const vs = many(doc.value);
      if (typeof vs === "string") return vs;
      const [a, b] = vs as [Enc, Enc];
      switch (doc.type) {
        case "add":
          return vs.reduce((x, y) => ({ lo: Q.add(x.lo, y.lo), hi: Q.add(x.hi, y.hi) }));
        case "sub":
          return { lo: Q.sub(a.lo, b.hi), hi: Q.sub(a.hi, b.lo) };
        case "mul":
          return vs.reduce((x, y) => hull([Q.mul(x.lo, y.lo), Q.mul(x.lo, y.hi), Q.mul(x.hi, y.lo), Q.mul(x.hi, y.hi)]));
        case "div":
          if (containsZero(b)) return isPoint(b) ? "none" : "unknown";
          return hull([Q.div(a.lo, b.lo), Q.div(a.lo, b.hi), Q.div(a.hi, b.lo), Q.div(a.hi, b.hi)]);
        case "min":
          return vs.reduce((x, y) => ({ lo: minR(x.lo, y.lo), hi: minR(x.hi, y.hi) }));
        case "max":
          return vs.reduce((x, y) => ({ lo: maxR(x.lo, y.lo), hi: maxR(x.hi, y.hi) }));
        case "lt":
          if (Q.compare(a.hi, b.lo) < 0) return point(Q.ONE);
          if (Q.compare(a.lo, b.hi) >= 0) return point(Q.ZERO);
          return "unknown";
        case "le":
          if (Q.compare(a.hi, b.lo) <= 0) return point(Q.ONE);
          if (Q.compare(a.lo, b.hi) > 0) return point(Q.ZERO);
          return "unknown";
        case "eq":
          if (isPoint(a) && isPoint(b)) return point(Q.equals(a.lo, b.lo) ? Q.ONE : Q.ZERO);
          if (Q.compare(a.hi, b.lo) < 0 || Q.compare(b.hi, a.lo) < 0) return point(Q.ZERO);
          return "unknown";
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The corpus.
// ---------------------------------------------------------------------------------------------------------------

export function docs(seed: number, n: number = RUNS): Document[] {
  const rnd = random(seed);
  return Array.from({ length: n }, () => (rnd() < 0.2 ? randomComparison(rnd) : randomExpression(rnd)));
}

export function randomPoint(rnd: Random): Record<string, number> {
  const value = (): number => {
    const t = rnd();
    if (t < 0.25) return DEGENERATE_CONSTANTS[Math.floor(rnd() * DEGENERATE_CONSTANTS.length)] as number;
    if (t < 0.6) return Math.floor(rnd() * 19) - 9;
    return (rnd() - 0.5) * 2 ** (Math.floor(rnd() * 17) - 8);
  };
  return Object.fromEntries(VARS.map((v) => [v, value()]));
}

/** This function tells if the float bounds `[lo, hi]`, which can be infinite, contain the enclosure `want`. */
export function encloses(lo: number, hi: number, want: Enc): boolean {
  const low = lo === -Infinity || (lo < Infinity && Q.compare(Q.fromFloat(lo), want.lo) <= 0);
  const high = hi === Infinity || (hi > -Infinity && Q.compare(want.hi, Q.fromFloat(hi)) <= 0);
  return low && high;
}
