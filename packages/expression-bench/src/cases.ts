/**
 * The cases of the bench of A3. Each case is one case of the corpus of A12: one document and its 64 points. A use of a
 * case gives the sum of the float values at its points.
 *
 * @packageDocumentation
 */
import { corpusCase, FAMILIES } from "@algebra/expression-corpus";
import type { CorpusCase, Family } from "@algebra/expression-corpus";
import { compileClosures, compileFloat, compileTape } from "@mark1russell7/expression";
import { median } from "@mark1russell7/rigor-statistics";

/** A function of the values of the variables. It gives the float value of a document. */
export type Evaluate = (values: Float64Array) => number;

/** An arm: the written function, the written function with a bound, `compileFloat`, the closures or the tape. */
export type ArmKind = "written" | "bound" | "float" | "closures" | "tape";

/**
 * The pairs of the bench: arm `a`, then arm `b`. A ratio is the time of `b` over the time of `a`. The pair `aa` has the
 * same function in the two arms. It gives the A/A band of each other pair.
 */
export const PAIRS: Readonly<Record<PairName, readonly [ArmKind, ArmKind]>> = {
  ab: ["written", "float"],
  aa: ["written", "written"],
  at: ["written", "tape"],
  ft: ["closures", "tape"],
  wf: ["bound", "float"],
  wt: ["bound", "tape"],
};

/** The name of a pair. */
export type PairName = "ab" | "aa" | "at" | "ft" | "wf" | "wt";

/**
 * This function reads a list of seeds: whole numbers and ranges with commas, for example `1,2,9-24`.
 *
 * @param text - The list.
 * @returns The seeds, in the order of the list.
 */
export function seedsOf(text: string): number[] {
  return text.split(",").flatMap((part) => {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range !== null) {
      const [low, high] = [Number(range[1]), Number(range[2])];
      if (high < low) throw new RangeError(`The range ${part} has no seeds.`);
      return Array.from({ length: high - low + 1 }, (_, i) => low + i);
    }
    if (!/^\d+$/.test(part)) throw new RangeError(`The seed ${part} is not a whole number or a range.`);
    return [Number(part)];
  });
}

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
 * This function gives the arm of the closures: `compileClosures`, which gives the value and the bound of its error. The
 * arm uses only the value.
 *
 * @param c - The corpus case.
 * @returns The function of the values of the variables.
 */
export function closed(c: CorpusCase): Evaluate {
  const made = compileClosures(c.document);
  if (!made.ok) throw new Error(`The case ${c.name} does not compile: ${made.error.reason}`);
  const f = made.value;
  return (values) => f.evaluate(values).value;
}

/** The count of the compiles of each form that `compileTimes` times. */
export const COMPILE_ROUNDS = 21;

/** The median time of one compile of each form, in milliseconds. */
export interface CompileTimes {
  readonly closures: number;
  readonly tape: number;
}

/**
 * This function times the compile of a case in each form. The two forms take turns, so a drift of the machine affects
 * the two. The child calls it after the timed rounds, so the compiles do not change the time of a call.
 *
 * @param c - The corpus case.
 * @param rounds - The count of the compiles of each form.
 * @returns The median time of each form.
 */
export function compileTimes(c: CorpusCase, rounds: number = COMPILE_ROUNDS): CompileTimes {
  const once = (compile: typeof compileTape): number => {
    const start = performance.now();
    const made = compile(c.document);
    const end = performance.now();
    if (!made.ok) throw new Error(`The case ${c.name} does not compile: ${made.error.reason}`);
    return end - start;
  };
  const closures: number[] = [];
  const tape: number[] = [];
  for (let i = 0; i < rounds; i++) {
    if (i % 2 === 0) {
      closures.push(once(compileClosures));
      tape.push(once(compileTape));
    } else {
      tape.push(once(compileTape));
      closures.push(once(compileClosures));
    }
  }
  return { closures: median(closures), tape: median(tape) };
}

/**
 * This function gives the arm of the tape: `compileTape`, which gives the value and the bound of its error. The arm
 * uses only the value.
 *
 * @param c - The corpus case.
 * @returns The function of the values of the variables.
 */
export function taped(c: CorpusCase): Evaluate {
  const made = compileTape(c.document);
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
