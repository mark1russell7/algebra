/**
 * The precision section of the page. It shows the measured cost of the verb `bigfloat` at each precision and of the
 * stage `bigfloat` of the selector. The verbs `interval` and `exact` are the base. The numbers come from the kept run of
 * the bench of A7. The plans are not stored: `select` calculates them in the browser.
 *
 * @packageDocumentation
 */
import type { CostModel, Question, Selection, ShareRow } from "@algebra/evaluator-select";
import { select } from "@algebra/evaluator-select";
import { questionName, questionsOf } from "./cost.ts";
import type { FamilyVerdict } from "./cost.ts";

/** The two verbs that the bench compares with each precision and with the stage. */
export type Baseline = "exact" | "interval";

/** The verdict of one arm against one verb. */
export interface PrecisionPair {
  readonly pair: string;
  readonly baseline: Baseline;
  /** The arm: a precision in bits, which the report writes as a number, or `stage`. */
  readonly arm: string | number;
  readonly outcome: string;
  readonly medianRatio: number;
  readonly families: readonly FamilyVerdict[];
}

/** The answers of the stage for one question of the run. */
export interface StageAnswers {
  readonly question: string;
  /** The count of the points where the stage met the question. */
  readonly met: number;
  readonly records: number;
  /** The count of the answers that the exact value shows wrong. */
  readonly wrong: number;
  readonly medianPrecision: number;
  readonly maxPrecision: number;
}

/** The parts of the kept `report.json` of the bench of A7 that the page reads. */
export interface PrecisionReport {
  readonly pairs: readonly PrecisionPair[];
  /** The cost of one call of each arm, for one node and one point, in nanoseconds. */
  readonly costs: readonly { readonly arm: string; readonly cost: number }[];
  readonly stage: readonly StageAnswers[];
  /** The cost and the shares of the stage. JSON writes a failed measure of the cost as `null`. */
  readonly model: { readonly limit: number; readonly bigfloat: number | null; readonly shares: readonly ShareRow[] };
}

/** One row of the costs. */
export interface CostRow {
  readonly arm: string;
  readonly cost: number;
}

/** One row of the grid of the verdicts: a family, or `all` for all the families. It has a cell for each arm. */
export interface GridRow {
  readonly family: string;
  readonly cells: readonly { readonly arm: string; readonly outcome: string; readonly medianRatio: number }[];
}

/** The plan of the selector for one question of the run, with the stage in the model. */
export interface StagePlan extends StageAnswers {
  readonly selection: Selection;
}

const isPrecision = (arm: string): boolean => /^\d+$/.test(arm);

/** This function gives the precisions of the run in bits, from the lowest. */
export function precisionsOf(report: Pick<PrecisionReport, "pairs">): readonly string[] {
  return [...new Set(report.pairs.map((p) => String(p.arm)).filter(isPrecision))].sort((a, b) => Number(a) - Number(b));
}

/** This function gives the name of an arm in plain words. */
export function armName(arm: string): string {
  if (arm === "stage") return "the stage";
  return isPrecision(arm) ? `bigfloat ${arm} bits` : arm;
}

/**
 * This function gives the costs in the order of the page: `interval`, `exact`, each precision from the lowest, and
 * then the stage.
 *
 * @throws {Error} The report has no cost of one of these arms.
 */
export function costRows(report: Pick<PrecisionReport, "pairs" | "costs">): readonly CostRow[] {
  return ["interval", "exact", ...precisionsOf(report), "stage"].map((arm) => {
    const row = report.costs.find((c) => c.arm === arm);
    if (!row) throw new Error(`The report has no cost of the arm ${arm}.`);
    return row;
  });
}

/**
 * This function gives the verdict of each arm against a verb, for each family, and then for all the families. The
 * columns are the precisions from the lowest, and then the stage.
 *
 * @throws {Error} The report has no pair of an arm with the verb, or a pair has a different set of families.
 */
export function verdictGrid(report: Pick<PrecisionReport, "pairs">, baseline: Baseline): { readonly arms: readonly string[]; readonly rows: readonly GridRow[] } {
  const arms = [...precisionsOf(report), "stage"];
  const pairs = arms.map((arm) => {
    const pair = report.pairs.find((p) => String(p.arm) === arm && p.baseline === baseline);
    if (!pair) throw new Error(`The report has no pair of ${arm} with ${baseline}.`);
    return pair;
  });
  const families = pairs[0]!.families.map((f) => f.family);
  const rows = families.map((family) => ({
    family,
    cells: pairs.map((pair) => {
      const verdict = pair.families.find((f) => f.family === family);
      if (!verdict || pair.families.length !== families.length) throw new Error(`The pair ${pair.pair} does not have the families of the other pairs.`);
      return { arm: String(pair.arm), outcome: verdict.outcome, medianRatio: verdict.medianRatio };
    }),
  }));
  return { arms, rows: [...rows, { family: "all", cells: pairs.map((p) => ({ arm: String(p.arm), outcome: p.outcome, medianRatio: p.medianRatio })) }] };
}

/** This function gives the model of A6 with the cost and the shares of the stage. A failed measure adds no cost. */
export function withStage(model: CostModel, report: Pick<PrecisionReport, "model">): CostModel {
  const { bigfloat } = report.model;
  return { cost: bigfloat === null ? model.cost : { ...model.cost, bigfloat }, shares: [...model.shares, ...report.model.shares] };
}

/**
 * This function gives the plan of the selector for each question of the run, from the model of A6 with the stage.
 *
 * @throws {Error} A question of the answers of the stage has no row in the model of the stage.
 */
export function stagePlans(model: CostModel, report: Pick<PrecisionReport, "model" | "stage">): readonly StagePlan[] {
  const both = withStage(model, report);
  const questions = new Map<string, Question>(questionsOf({ cost: model.cost, shares: report.model.shares }).map((q) => [questionName(q), q]));
  return report.stage.map((answers) => {
    const question = questions.get(answers.question);
    if (!question) throw new Error(`The model of the stage has no row of the question ${answers.question}.`);
    return { ...answers, selection: select(question, both) };
  });
}

/** This function tells in plain words if the stage is in a plan of the selector. */
export function stageVerdict(plans: readonly StagePlan[]): string {
  const count = plans.filter((p) => p.selection.plan.includes("bigfloat")).length;
  if (count === 0) return `The stage is in no plan of the ${plans.length} questions, so it stays a choice of the caller.`;
  return `The stage is in the plan of ${count} of the ${plans.length} questions.`;
}
