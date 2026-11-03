/**
 * The claim records of the bench of A8. Each case gets one record for each verb and each tier of limits, with the losers
 * too. Each claim is examined at the points of its case against the verb `exact`, or by exact substitution in its roots.
 *
 * @packageDocumentation
 */
import { evaluate, functions, LIMITS, normalForm, rationalForm, SOLVE_LIMITS, solveFunction } from "@algebra/polynomial";
import type { Limits, Polynomial, Root } from "@algebra/polynomial";
import { compileExact, NO_CLAIM } from "@mark1russell7/expression";
import type { ExactFunction } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { type BenchCase, isRootFamily } from "./cases.ts";

/** A tier of limits: the factors of the count of products, and of the count of bits. */
export interface Tier {
  readonly name: string;
  readonly products: number;
  readonly bits: number;
}

/** The tiers, from the tightest to the default. */
export const TIERS: readonly Tier[] = [
  { name: "products/256", products: 1 / 256, bits: 1 },
  { name: "products/16", products: 1 / 16, bits: 1 },
  { name: "bits/8", products: 1, bits: 1 / 8 },
  { name: "default", products: 1, bits: 1 },
];

/** The verbs of the records. */
export type Verb = "polynomial" | "rational" | "solve";

/** One record of one case, one verb and one tier. */
export interface ClaimRecord {
  readonly case: string;
  readonly family: string;
  readonly verb: Verb;
  readonly tier: string;
  /** The kind of the result. A record with the kind `no claim` is a loser. */
  readonly kind: string;
  /** The terms of the numerator and of the denominator, or 0. */
  readonly terms: number;
  readonly denominatorTerms: number;
  /** The largest total degree of a term of the numerator, or 0. */
  readonly degree: number;
  /** The count of roots of each kind. */
  readonly exactRoots: number;
  readonly intervalRoots: number;
  /** The reason of a loser of a solution, or `null`. */
  readonly reason: string | null;
  /** The count of points or roots that the record examined, and the count of these that disagree. */
  readonly checked: number;
  readonly wrong: number;
  /** The time of one call in milliseconds, from one sample. It is a fact of the record, not a compare of two arms. */
  readonly ms: number;
}

const scaled = (base: Limits, tier: Tier): Limits => ({
  ...base,
  maxProducts: Math.max(1, Math.floor(base.maxProducts * tier.products)),
  maxBits: Math.max(1, Math.floor(base.maxBits * tier.bits)),
});

const degreeOf = (p: Polynomial): number => Math.max(0, ...p.terms.map((t) => t.powers.reduce((all, a) => all + a.exponent, 0)));

/** This function counts the points where a value of a form differs from the verb `exact`. */
function examine(c: BenchCase, exact: ExactFunction | undefined, value: (at: Readonly<Record<string, Rational>>) => Rational | null): { readonly checked: number; readonly wrong: number } {
  if (exact === undefined) return { checked: 0, wrong: 0 };
  let [checked, wrong] = [0, 0];
  for (const p of c.points.slice(0, 8)) {
    const want = exact.evaluate(p);
    if (want === NO_CLAIM) continue;
    const got = value(Object.fromEntries(c.variables.map((name, i) => [name, Q.fromFloat(p[i] as number)])));
    checked += 1;
    if (want === null ? got !== null : got === null || !Q.equals(want, got)) wrong += 1;
  }
  return { checked, wrong };
}

/** This function counts the roots that exact substitution does not confirm. An even root has no sign change, so it counts as checked by its own factor. */
function examineRoots(p: Polynomial, name: string, roots: readonly Root[]): { readonly checked: number; readonly wrong: number } {
  const at = (value: Rational): number => Q.sign(evaluate(p, { [name]: value }));
  let wrong = 0;
  for (const r of roots) {
    if (r.kind === "exact") wrong += at(r.value) === 0 ? 0 : 1;
    else if (r.multiplicity % 2 === 1) wrong += at(r.lower) * at(r.upper) < 0 ? 0 : 1;
  }
  return { checked: roots.length, wrong };
}

function polynomialRecord(c: BenchCase, limits: Limits, exact: ExactFunction | undefined): Omit<ClaimRecord, "case" | "family" | "verb" | "tier" | "ms"> {
  const made = normalForm(c.document, limits);
  const empty = { terms: 0, denominatorTerms: 0, degree: 0, exactRoots: 0, intervalRoots: 0, reason: null, checked: 0, wrong: 0 };
  if (!made.ok) return { ...empty, kind: "error", reason: made.error.reason };
  const form = made.value;
  if (form.kind !== "polynomial") return { ...empty, kind: form.kind };
  return { ...empty, kind: form.kind, terms: form.polynomial.terms.length, denominatorTerms: 1, degree: degreeOf(form.polynomial), ...examine(c, exact, (at) => evaluate(form.polynomial, at)) };
}

function rationalRecord(c: BenchCase, limits: Limits, exact: ExactFunction | undefined): Omit<ClaimRecord, "case" | "family" | "verb" | "tier" | "ms"> {
  const made = rationalForm(c.document, limits);
  const empty = { terms: 0, denominatorTerms: 0, degree: 0, exactRoots: 0, intervalRoots: 0, reason: null, checked: 0, wrong: 0 };
  if (!made.ok) return { ...empty, kind: "error", reason: made.error.reason };
  const form = made.value;
  if (form.kind !== "rational") return { ...empty, kind: form.kind };
  const f = form.value;
  return { ...empty, kind: form.kind, terms: f.numerator.terms.length, denominatorTerms: f.denominator.terms.length, degree: degreeOf(f.numerator), ...examine(c, exact, (at) => functions.evaluate(f, at)) };
}

function solveRecord(c: BenchCase, limits: Limits): Omit<ClaimRecord, "case" | "family" | "verb" | "tier" | "ms"> {
  const made = rationalForm(c.document, limits);
  const empty = { terms: 0, denominatorTerms: 0, degree: 0, exactRoots: 0, intervalRoots: 0, reason: null, checked: 0, wrong: 0 };
  if (!made.ok) return { ...empty, kind: "error", reason: made.error.reason };
  const form = made.value;
  if (form.kind !== "rational") return { ...empty, kind: NO_CLAIM, reason: "The verb rational gives no form." };
  const s = solveFunction(form.value, { limits });
  if (s.kind === NO_CLAIM) return { ...empty, kind: s.kind, reason: s.reason };
  if (s.kind === "all") return { ...empty, kind: s.kind };
  const numerator = form.value.numerator;
  return {
    ...empty,
    kind: s.kind,
    terms: numerator.terms.length,
    denominatorTerms: form.value.denominator.terms.length,
    degree: degreeOf(numerator),
    exactRoots: s.roots.filter((r) => r.kind === "exact").length,
    intervalRoots: s.roots.filter((r) => r.kind === "interval").length,
    ...examineRoots(numerator, s.variable ?? "x", s.roots),
  };
}

/**
 * This function gives the records of one case: one for each verb of its family and each tier.
 *
 * @param c - The case.
 * @param tiers - The tiers. The default is `TIERS`.
 * @returns The records, the losers too.
 */
export function claimRecords(c: BenchCase, tiers: readonly Tier[] = TIERS): ClaimRecord[] {
  const compiled = compileExact(c.document, { variables: c.variables });
  const exact = compiled.ok ? compiled.value : undefined;
  const verbs: readonly Verb[] = isRootFamily(c.family) ? ["rational", "solve"] : ["polynomial", "rational"];
  return tiers.flatMap((tier) =>
    verbs.map((verb) => {
      const start = performance.now();
      const body =
        verb === "polynomial" ? polynomialRecord(c, scaled(LIMITS, tier), exact) : verb === "rational" ? rationalRecord(c, scaled(LIMITS, tier), exact) : solveRecord(c, scaled(SOLVE_LIMITS, tier));
      return { case: c.name, family: c.family, verb, tier: tier.name, ...body, ms: performance.now() - start };
    }),
  );
}
