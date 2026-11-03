/**
 * The arms and the pairs of the bench of A8. A use of an arm starts from the document, so each use pays the whole cost of
 * the arm. It gives a number that depends on the answer, so a compiler cannot drop the work.
 * The number is `NaN` when the arm has no answer.
 *
 * @packageDocumentation
 */
import { normalForm, rationalForm, functions, solveEquation } from "@algebra/polynomial";
import { compileExact, NO_CLAIM } from "@mark1russell7/expression";
import type { Expression, ExactResult } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { type BenchCase, familyOf, GENERATED, isRootFamily } from "./cases.ts";

/** The arms. */
export type ArmName = "exact-1" | "exact-64" | "form-1" | "form-64" | "points-equal" | "keys-equal" | "polynomial" | "rational" | "solve-16" | "solve-64";

/** The name of a pair that compares two different arms. */
export type DifferentPair = "verbs" | "points-1" | "points-64" | "equal" | "solve";

/** The two arms of each pair. A ratio of a pair is the time of arm `b` over the time of arm `a`. */
export const PAIRS: Readonly<Record<DifferentPair, readonly [ArmName, ArmName]>> = {
  /** The cost of the gcd and the domain on a document with no quotient. */
  verbs: ["polynomial", "rational"],
  /** One form and one evaluation, against one compilation and one exact evaluation. */
  "points-1": ["exact-1", "form-1"],
  /** One form and 64 evaluations, against one compilation and 64 exact evaluations. */
  "points-64": ["exact-64", "form-64"],
  /** A proof of equality by two keys, against a test of equality at 64 points that proves nothing. */
  equal: ["points-equal", "keys-equal"],
  /** The cost of 48 more bits of each interval of a root. */
  solve: ["solve-16", "solve-64"],
};

/** The name of a pair, or `aa` for the A/A pair. */
export type PairName = DifferentPair | "aa";

/** This function gives the pairs of a family. */
export function pairsOf(family: string): readonly PairName[] {
  if (isRootFamily(family)) return ["solve", "aa"];
  const shape = GENERATED[family];
  return shape === undefined || shape.kind === "expand" ? ["verbs", "points-1", "points-64", "equal", "aa"] : ["points-1", "points-64", "equal", "aa"];
}

/** This function gives the two arms of a pair on a family. The A/A pair has the longest arm of the family two times. */
export function armsOf(pair: PairName, family: string): readonly [ArmName, ArmName] {
  if (pair !== "aa") return PAIRS[pair];
  const arm: ArmName = isRootFamily(familyOf(family)) ? "solve-64" : "form-64";
  return [arm, arm];
}

/** This function gives a document with the value of `doc`, and with another shape: `2 * doc - doc`. */
export const rewriteOf = (doc: Expression): Expression => ({
  type: "sub",
  value: [{ type: "mul", value: [{ type: "num", value: 2 }, doc] }, doc],
});

const WIDE = Q.rational(1n, 1n << 16n);
const TIGHT = Q.rational(1n, 1n << 64n);

const signOf = (r: ExactResult): number => (r === null ? 2 : r === NO_CLAIM ? 3 : Q.sign(r));

function pointsOf(c: BenchCase, count: number): { readonly floats: readonly Float64Array[]; readonly exact: readonly Record<string, Rational>[] } {
  const chosen = c.points.slice(0, count);
  return {
    floats: chosen.map((p) => Float64Array.from(p)),
    exact: chosen.map((p) => Object.fromEntries(c.variables.map((name, i) => [name, Q.fromFloat(p[i] as number)]))),
  };
}

function exactArm(c: BenchCase, count: number): () => number {
  const { floats } = pointsOf(c, count);
  return () => {
    const f = compileExact(c.document, { variables: c.variables });
    if (!f.ok) return Number.NaN;
    let out = 0;
    for (const p of floats) out += signOf(f.value.evaluate(p));
    return out;
  };
}

function formArm(c: BenchCase, count: number): () => number {
  const { exact } = pointsOf(c, count);
  return () => {
    const made = rationalForm(c.document);
    if (!made.ok || made.value.kind !== "rational") return Number.NaN;
    let out = 0;
    for (const p of exact) out += signOf(functions.evaluate(made.value.value, p));
    return out;
  };
}

function pointsEqualArm(c: BenchCase): () => number {
  const { floats } = pointsOf(c, c.points.length);
  const other = rewriteOf(c.document);
  return () => {
    const [f, g] = [compileExact(c.document, { variables: c.variables }), compileExact(other, { variables: c.variables })];
    if (!f.ok || !g.ok) return Number.NaN;
    let same = 0;
    for (const p of floats) {
      const [a, b] = [f.value.evaluate(p), g.value.evaluate(p)];
      if (a === b || (typeof a === "object" && a !== null && typeof b === "object" && b !== null && Q.equals(a, b))) same += 1;
    }
    return same;
  };
}

function keysEqualArm(c: BenchCase): () => number {
  const other = rewriteOf(c.document);
  return () => {
    const [f, g] = [rationalForm(c.document), rationalForm(other)];
    if (!f.ok || !g.ok || f.value.kind !== "rational" || g.value.kind !== "rational") return Number.NaN;
    return f.value.key === g.value.key ? f.value.key.length : 0;
  };
}

function solveArm(c: BenchCase, tolerance: Rational): () => number {
  return () => {
    const made = solveEquation(c.document, { tolerance });
    return made.ok && made.value.kind === "roots" ? made.value.roots.length + Q.sign(made.value.error) : Number.NaN;
  };
}

/**
 * This function gives the timed use of an arm on a case. Each arm of a process uses it in its own instance of this module,
 * so the two loops do not share type feedback.
 *
 * @param c - The case.
 * @param arm - The arm.
 * @returns The function of one use.
 */
export function runOf(c: BenchCase, arm: ArmName): () => number {
  switch (arm) {
    case "exact-1":
      return exactArm(c, 1);
    case "exact-64":
      return exactArm(c, 64);
    case "form-1":
      return formArm(c, 1);
    case "form-64":
      return formArm(c, 64);
    case "points-equal":
      return pointsEqualArm(c);
    case "keys-equal":
      return keysEqualArm(c);
    case "polynomial":
      return () => {
        const made = normalForm(c.document);
        return made.ok && made.value.kind === "polynomial" ? made.value.key.length : Number.NaN;
      };
    case "rational":
      return () => {
        const made = rationalForm(c.document);
        return made.ok && made.value.kind === "rational" ? made.value.key.length : Number.NaN;
      };
    case "solve-16":
      return solveArm(c, WIDE);
    case "solve-64":
      return solveArm(c, TIGHT);
  }
}
