/**
 * The selector: from a cost model, it gives the plan of the stitched evaluator with the least expected cost for a
 * question. This package has no default cost model. The model comes from the records of the bench of A6.
 *
 * @packageDocumentation
 */
import { STAGES } from "./claim.ts";
import type { Stage } from "./claim.ts";
import { checkTolerance } from "./question.ts";
import type { Question, Tolerance } from "./question.ts";

/** The share of the points that a stage answers for one question, as the bench measured it. */
export interface ShareRow {
  readonly question: Question;
  readonly stage: Stage;
  /** The answered points over all the points, from 0 to 1. */
  readonly share: number;
}

/** A cost model from the records of a bench. */
export interface CostModel {
  /** The cost of one call of each stage, for one node and one point. The unit is the unit of the bench. */
  readonly cost: Readonly<Record<Stage, number>>;
  /** The share of each stage for each question of the bench. */
  readonly shares: readonly ShareRow[];
}

/** The plan of a selection, and the cost that the model expects for one node and one point. */
export interface Selection {
  readonly plan: readonly Stage[];
  readonly expectedCost: number;
}

const bound = (t: Tolerance): number => ("absolute" in t ? t.absolute : t.relative);
const sameType = (a: Tolerance, b: Tolerance): boolean => "absolute" in a === "absolute" in b;

/**
 * This function gives the shares of the model for a question. A value question uses the rows of the same type of
 * tolerance with the largest bound that is not more than its bound. A stricter tolerance answers fewer points, so these
 * shares are not more than the real shares.
 */
function sharesOf(question: Question, model: CostModel): Partial<Record<Stage, number>> | undefined {
  let rows: readonly ShareRow[];
  if (question.kind === "sign") rows = model.shares.filter((r) => r.question.kind === "sign");
  else {
    const t = question.tolerance;
    const fit = model.shares.flatMap((r) =>
      r.question.kind === "value" && sameType(r.question.tolerance, t) && bound(r.question.tolerance) <= bound(t) ? [{ r, b: bound(r.question.tolerance) }] : [],
    );
    const best = Math.max(...fit.map((f) => f.b));
    rows = fit.filter((f) => f.b === best).map((f) => f.r);
  }
  if (rows.length === 0) return undefined;
  return Object.fromEntries(rows.map((r) => [r.stage, r.share]));
}

/**
 * This function gives the expected cost of a plan. The model takes the answered points of a stage as a part of the
 * answered points of each later stage. Thus a point gets to a stage with the chance `1 - s`, where `s` is the largest
 * share of the stages before it.
 *
 * @param plan - The stages, in the order of the tries.
 * @param cost - The cost of one call of each stage.
 * @param shares - The share of each stage. A stage without a share has the share 0.
 * @returns The expected cost of one call of the plan.
 */
export function planCost(plan: readonly Stage[], cost: Readonly<Record<Stage, number>>, shares: Partial<Record<Stage, number>>): number {
  let total = 0;
  let answered = 0;
  for (const stage of plan) {
    total += (1 - answered) * cost[stage];
    answered = Math.max(answered, shares[stage] ?? 0);
  }
  return total;
}

/**
 * This function selects the plan of the least expected cost for a question. Each plan is a set of the stages
 * `float`, `ball` and `interval` in the order of their cost, and then `exact`. The stage `exact` is always last,
 * because only it answers each value question of a root-free document. Without shares for the question, the plan has
 * each stage in the order of cost.
 *
 * @param question - The question, with its tolerance.
 * @param model - The cost model.
 * @returns The plan and its expected cost.
 */
export function select(question: Question, model: CostModel): Selection {
  if (question.kind === "value") checkTolerance(question.tolerance);
  const filters = STAGES.filter((s) => s !== "exact").sort((a, b) => model.cost[a] - model.cost[b]);
  const shares = sharesOf(question, model);
  if (shares === undefined) {
    const plan: Stage[] = [...filters, "exact"];
    return { plan, expectedCost: planCost(plan, model.cost, {}) };
  }
  let best: Selection | undefined;
  for (let mask = 0; mask < 1 << filters.length; mask++) {
    const plan: Stage[] = [...filters.filter((_, i) => (mask >> i) & 1), "exact"];
    const expectedCost = planCost(plan, model.cost, shares);
    if (best === undefined || expectedCost < best.expectedCost || (expectedCost === best.expectedCost && plan.length < best.plan.length)) {
      best = { plan, expectedCost };
    }
  }
  return best!;
}
