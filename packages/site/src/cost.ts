/**
 * The cost section of the page: the measured cost of each stage, and the plan that `select` gives from it.
 * The numbers come from the kept run of the A6 bench. The plan is not stored: `select` calculates it in the browser.
 *
 * @packageDocumentation
 */
import type { CostModel, Question, Selection, Stage } from "@algebra/evaluator-select";
import { select } from "@algebra/evaluator-select";

/** The verdict of a family in the kept report. */
export interface FamilyVerdict {
  readonly family: string;
  readonly outcome: string;
  readonly medianRatio: number;
}

/** The verdict of the stitched plan against one fixed stage. */
export interface PairVerdict {
  readonly stage: Stage;
  readonly outcome: string;
  readonly medianRatio: number;
  readonly families: readonly FamilyVerdict[];
}

/** The parts of the kept `report.json` that the page reads. */
export interface CostReport {
  readonly model: CostModel;
  readonly pairs: readonly PairVerdict[];
  /** The count of the wrong answers of the stitched plan in the run. */
  readonly stitchedFailures: number;
  readonly selections: readonly (Selection & { readonly question: string })[];
}

/** One stage of the selected view of a question. */
export interface StageRow {
  readonly stage: Stage;
  /** The cost of one call, for one node and one point, in nanoseconds. */
  readonly cost: number;
  /** The part of the points that the stage answers alone, from 0 to 1. */
  readonly share: number;
  /** This value is true when the plan uses the stage. */
  readonly inPlan: boolean;
  /** The part of the points that reach the stage in the plan, from 0 to 1. A stage out of the plan has `null`. */
  readonly reach: number | null;
}

/**
 * This function gives the verdict of the stitched plan against fixed `exact` over all the cases of the run, in plain words.
 *
 * @throws {Error} The report has no pair with the stage `exact`.
 */
export function overallText(report: Pick<CostReport, "pairs" | "stitchedFailures">): string {
  const exact = report.pairs.find((p) => p.stage === "exact");
  if (!exact) throw new Error("The report has no pair with the stage exact.");
  const wrong = report.stitchedFailures === 1 ? "1 wrong answer" : `${report.stitchedFailures} wrong answers`;
  return `All cases together in that run: ${exact.outcome}, median × ${exact.medianRatio.toPrecision(3)}. The plan gave ${wrong}.`;
}

/** This function gives the address of the kept folder of a run of the bench, and the text of its link. */
export function rawRecordsLink(bench: { readonly run: string; readonly folder: string }): { readonly href: string; readonly text: string } {
  return {
    href: `https://github.com/mark1russell7/algebra/tree/main/packages/evaluator-bench/results/${bench.folder}`,
    text: `The raw records of run ${bench.run}`,
  };
}

/** This function gives each question of the model, in the order of the model. */
export function questionsOf(model: CostModel): readonly Question[] {
  const seen = new Map<string, Question>();
  for (const row of model.shares) seen.set(JSON.stringify(row.question), row.question);
  return [...seen.values()];
}

/** This function gives the name of a question in the records of the bench. */
export function questionName(q: Question): string {
  if (q.kind === "sign") return "sign";
  return "absolute" in q.tolerance ? `abs ${q.tolerance.absolute}` : `rel ${q.tolerance.relative}`;
}

/** This function gives the model with the cost of `exact` scaled by a factor. The shares do not change. */
export function scaleExact(model: CostModel, factor: number): CostModel {
  return { ...model, cost: { ...model.cost, exact: model.cost.exact * factor } };
}

/**
 * This function gives a row for each stage, in the order of the stages of a plan: the filters by cost, and `exact`
 * last. The reach of a stage follows the rule of `planCost`: the points that no earlier stage of the plan answers
 * reach it.
 *
 * @param question - The question.
 * @param model - The cost model.
 * @param plan - The plan of the question.
 * @returns The rows, with `exact` last.
 */
export function stageRows(question: Question, model: CostModel, plan: readonly Stage[]): readonly StageRow[] {
  const key = JSON.stringify(question);
  const shareOf = (stage: Stage): number => model.shares.find((r) => r.stage === stage && JSON.stringify(r.question) === key)?.share ?? 0;
  const measured = Object.entries(model.cost) as [Stage, number][];
  const filters = measured.filter(([stage]) => stage !== "exact").sort((a, b) => a[1] - b[1]).map(([stage]) => stage);
  let answered = 0;
  return [...filters, "exact" as const].map((stage) => {
    const inPlan = plan.includes(stage);
    const reach = inPlan ? 1 - answered : null;
    if (inPlan) answered = Math.max(answered, shareOf(stage));
    return { stage, cost: model.cost[stage] as number, share: shareOf(stage), inPlan, reach };
  });
}

/** This function gives the place of a value on a logarithmic axis, from 0 to 1. A value out of the axis stays at its end. */
export function logPlace(value: number, low: number, high: number): number {
  return Math.min(1, Math.max(0, Math.log(value / low) / Math.log(high / low)));
}

/** This function gives the plan of a question for a factor of the cost of `exact`. */
export function planAt(question: Question, model: CostModel, factor: number): Selection {
  return select(question, scaleExact(model, factor));
}
