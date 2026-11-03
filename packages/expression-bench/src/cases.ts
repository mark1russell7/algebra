/**
 * The cases of the bench of A3. Each case is one case of the corpus of A12: one document and its 64 points. A use of a
 * case gives the sum of the float values at its points.
 *
 * @packageDocumentation
 */
import { corpusCase, FAMILIES } from "@algebra/expression-corpus";
import type { CorpusCase, Family } from "@algebra/expression-corpus";
import { compileFloat } from "@mark1russell7/expression";

/** A function of the values of the variables. It gives the float value of a document. */
export type Evaluate = (values: Float64Array) => number;

/** One case of the bench. */
export interface Case {
  /** The name of the corpus case, `<family>/s<seed>`. */
  readonly name: string;
  readonly family: Family;
  /** This function gives the sum of the values at the points of the case. */
  readonly run: () => number;
}

/** This function gives the family of a case name. */
export function familyOf(name: string): Family {
  const family = name.split("/")[0] as Family;
  if (!FAMILIES.includes(family)) throw new RangeError(`The case ${name} has no family of the corpus.`);
  return family;
}

/** This function gives the corpus case of a case name `<family>/s<seed>`. */
export function corpusCaseOf(name: string): CorpusCase {
  const seed = Number(name.split("/")[1]?.slice(1));
  if (!Number.isSafeInteger(seed)) throw new RangeError(`The case ${name} has no seed.`);
  return corpusCase(familyOf(name), seed);
}

/**
 * This function gives the arm `b` of a case: `compileFloat`, which gives the value and the bound of its error. The arm
 * uses only the value.
 *
 * @param c - The corpus case.
 * @returns The function of the values of the variables.
 */
export function compiled(c: CorpusCase): Evaluate {
  const made = compileFloat(c.document);
  if (!made.ok) throw new Error(`The case ${c.name} does not compile: ${made.error.reason}`);
  const f = made.value;
  return (values) => f.evaluate(values).value;
}

/**
 * This function gives a case of the bench for one arm. Each arm uses it in its own instance of this module. Thus the
 * loops of the two arms do not share the type feedback of the engine.
 *
 * @param c - The corpus case.
 * @param evaluate - The function of the arm.
 * @returns The case.
 */
export function caseOf(c: CorpusCase, evaluate: Evaluate): Case {
  const points = c.points.map((p) => Float64Array.from(p));
  return {
    name: c.name,
    family: c.family,
    run: () => {
      let sum = 0;
      for (const p of points) sum += evaluate(p);
      return sum;
    },
  };
}
