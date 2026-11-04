/**
 * The bench of A7 on the corpus of A12. It times the verb `bigfloat` at each precision and the stage that raises the
 * precision, against the verbs `exact` and `interval`. It keeps the error of each answer of the stage against the exact
 * value. The records and the verdicts come from `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { AA, AA_PRECISION, type ArmName, type Baseline, BASELINES, LIMIT, type Pair, pairNames, pairOf, PRECISIONS, runOf } from "./arms.ts";
export { STAGE_QUESTIONS, type StageRecord, stageRecords, stageShares } from "./errors.ts";
export { type ArmCost, markdown, type PairVerdict, type Report, report, type StageErrors, type StageModel } from "./report.ts";
