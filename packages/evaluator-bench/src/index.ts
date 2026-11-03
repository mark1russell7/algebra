/**
 * The bench of A6 on the corpus of A12. It times the stitched plan of `@algebra/evaluator-select` against each fixed
 * stage, and keeps the error of each answer against the exact value. The records and the verdicts come from
 * `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { answerOf, ARMS, type ArmName, corpusCaseOf, familyOf, planOf, QUESTIONS, questionName, questionOf, runOf } from "./arms.ts";
export { contains, type ErrorRecord, errorRecords, shares, stitchedFails } from "./errors.ts";
export { type ArmErrors, markdown, type Meta, type PairVerdict, type Report, report } from "./report.ts";
