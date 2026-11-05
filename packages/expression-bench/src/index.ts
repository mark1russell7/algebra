/**
 * The bench of the time claim of A3 on the corpus of A12. It times `compileFloat` of `@mark1russell7/expression`
 * against a written JavaScript function of each document. The records and the verdicts come from
 * `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { type ArmKind, type Case, caseOf, closed, COMPILE_ROUNDS, compiled, compileTimes, type CompileTimes, corpusCaseOf, type Evaluate, familyOf, type PairName, PAIRS, seedsOf, taped } from "./cases.ts";
export { BOUND_LIMIT, type CompileFacts, compileMarkdown, compileRatio, LIMIT, markdown, type Report, report, SIZE_GROUPS, sizeMarkdown, type SizeRow, type Speed, speed, speedBySize, speedMarkdown, type Verdict } from "./report.ts";
export { boundBody, type Written, writtenBody, writtenModule } from "./source.ts";
