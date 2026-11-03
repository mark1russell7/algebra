/**
 * The arms of the bench of A6. An arm is a plan of `@algebra/evaluator-select`: one fixed stage, or the stitched plan.
 * A use of an arm on a case answers the question of the family at each point of the case. It gives the sum of the
 * values of the answers.
 *
 * @packageDocumentation
 */
import { corpusCase, FAMILIES } from "@algebra/expression-corpus";
import type { CorpusCase, Family } from "@algebra/expression-corpus";
import { STAGES, stitch } from "@algebra/evaluator-select";
import type { Answer, Question, Stage } from "@algebra/evaluator-select";

/** An arm: a fixed stage, or `stitched` for the default plan float, ball, interval and exact. */
export type ArmName = Stage | "stitched";

/** The arms, in the order of the report. */
export const ARMS: readonly ArmName[] = [...STAGES, "stitched"];

/** The question of the timed cases of each family. The geometric families ask for a sign. */
export function questionOf(family: Family): Question {
  return family.startsWith("orient") || family.startsWith("incircle") ? { kind: "sign" } : { kind: "value", tolerance: { relative: 1e-12 } };
}

/** The questions of the error records: the sign, an absolute and two relative tolerances. */
export const QUESTIONS: readonly Question[] = [
  { kind: "sign" },
  { kind: "value", tolerance: { absolute: 1e-9 } },
  { kind: "value", tolerance: { relative: 1e-12 } },
  { kind: "value", tolerance: { relative: 0 } },
];

/** This function gives a short name of a question, for the records. */
export function questionName(q: Question): string {
  if (q.kind === "sign") return "sign";
  return "absolute" in q.tolerance ? `abs ${q.tolerance.absolute}` : `rel ${q.tolerance.relative}`;
}

/** This function gives the family of a case name `<family>/s<seed>`. */
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

/** This function gives the plan of an arm. */
export const planOf = (arm: ArmName): readonly Stage[] => (arm === "stitched" ? STAGES : [arm]);

/** This function gives the answer function of an arm for a case and a question. */
export function answerOf(c: CorpusCase, arm: ArmName, question: Question): (values: ArrayLike<number>) => Answer {
  const s = stitch(c.document, question, { variables: c.variables, plan: planOf(arm) });
  return (values) => s.answer(values);
}

/**
 * This function gives the timed use of an arm on a case: the answers of the question of the family at each point.
 * Each arm of a process uses it in its own instance of this module, so the two loops do not share type feedback.
 *
 * @param c - The corpus case.
 * @param arm - The arm.
 * @returns The function of one use. It gives the sum of the values and the signs of the answers.
 */
export function runOf(c: CorpusCase, arm: ArmName): () => number {
  const answer = answerOf(c, arm, questionOf(c.family));
  const points = c.points.map((p) => Float64Array.from(p));
  return () => {
    let sum = 0;
    for (const p of points) {
      const a = answer(p);
      sum += (a.sign ?? 0) + (a.value - a.value === 0 ? a.value : 0);
    }
    return sum;
  };
}
