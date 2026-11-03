/**
 * The stitched evaluator: it tries the stages of a plan in order, and stops at the first stage that answers the
 * question. The default plan is float, ball, interval and exact. Thus the exact stage operates only where each float
 * filter before it fails.
 *
 * @packageDocumentation
 */
import { compileBall, compileExact, compileFloat, compileInterval } from "@mark1russell7/expression";
import type { CompileFloatOptions, Document } from "@mark1russell7/expression";
import { ballClaim, exactClaim, floatClaim, intervalClaim, NOTHING, STAGES } from "./claim.ts";
import type { Claim, Stage } from "./claim.ts";
import { checkTolerance, meets, signOf } from "./question.ts";
import type { Question } from "./question.ts";

/** The answer of a stitched evaluator at one point. */
export interface Answer extends Claim {
  /** The stage that gave the claim. */
  readonly stage: Stage;
  /** `true` when the claim answers the question. Else the claim is the one with the smallest error of the plan. */
  readonly met: boolean;
  /** The sign of the exact value, when the claim tells it. */
  readonly sign: -1 | 0 | 1 | undefined;
}

/** A document compiled for each stage of a plan. */
export interface Stitched {
  /** The names of the variables, in the order of the values of `answer`. */
  readonly variables: readonly string[];
  /** The stages, in the order of the tries. */
  readonly plan: readonly Stage[];
  /** The question of each call. */
  readonly question: Question;
  /**
   * This function gives the answer at one point. It tries each stage of the plan in order, and stops at the first
   * stage whose claim meets the question.
   *
   * @param values - The value of each variable, in the order of `variables`.
   * @returns The answer, with its stage and its error bound.
   */
  answer(values: ArrayLike<number>): Answer;
}

/** The options of `stitch`. */
export interface StitchOptions extends CompileFloatOptions {
  /** The stages, in the order of the tries. The default is `STAGES`. */
  readonly plan?: readonly Stage[];
}

type Run = (values: ArrayLike<number>) => Claim;

/** This function gives the value of a compiled document, or throws the error of coeval. */
function made<T>(stage: Stage, r: { ok: true; value: T } | { ok: false; error: { reason: string } }): T {
  if (!r.ok) throw new Error(`The stage ${stage} does not compile the document: ${r.error.reason}`);
  return r.value;
}

/** This function compiles the document for one stage. */
function compileStage(stage: Stage, doc: Document, options: CompileFloatOptions): { variables: readonly string[]; run: Run } {
  switch (stage) {
    case "float": {
      const f = made(stage, compileFloat(doc, options));
      return { variables: f.variables, run: (v) => floatClaim(f.evaluate(v)) };
    }
    case "ball": {
      const f = made(stage, compileBall(doc, options));
      return { variables: f.variables, run: (v) => ballClaim(f.evaluate(v)) };
    }
    case "interval": {
      const f = made(stage, compileInterval(doc, options));
      return { variables: f.variables, run: (v) => intervalClaim(f.evaluate(v)) };
    }
    case "exact": {
      const f = made(stage, compileExact(doc, options));
      return { variables: f.variables, run: (v) => exactClaim(f.evaluate(v)) };
    }
  }
}

/**
 * This function compiles a document one time for each stage of a plan, and gives the stitched evaluator of a question.
 *
 * @param doc - The document.
 * @param question - The question of each call.
 * @param options - The plan and the order of the variables.
 * @returns The stitched evaluator.
 * @throws Error when a stage does not compile the document, and RangeError for an empty plan or a bad tolerance.
 */
export function stitch(doc: Document, question: Question, options: StitchOptions = {}): Stitched {
  const plan = options.plan ?? STAGES;
  if (plan.length === 0) throw new RangeError("A plan needs one stage or more.");
  if (question.kind === "value") checkTolerance(question.tolerance);
  const stages = plan.map((stage) => ({ stage, ...compileStage(stage, doc, options) }));
  const variables = stages[0]!.variables;
  return {
    variables,
    plan: [...plan],
    question,
    answer(values) {
      let best: { stage: Stage; claim: Claim } = { stage: plan[plan.length - 1]!, claim: NOTHING };
      for (const { stage, run } of stages) {
        const claim = run(values);
        if (meets(claim, question)) return { ...claim, stage, met: true, sign: signOf(claim) };
        if (claim.error < best.claim.error || (claim.kind === "value" && best.claim.kind !== "value")) best = { stage, claim };
      }
      return { ...best.claim, stage: best.stage, met: false, sign: signOf(best.claim) };
    },
  };
}
