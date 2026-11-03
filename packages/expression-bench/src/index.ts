/**
 * The bench of the time claim of A3 on the corpus of A12. It times `compileFloat` of `@mark1russell7/expression`
 * against a written JavaScript function of each document. The records and the verdicts come from
 * `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { type Case, caseOf, compiled, corpusCaseOf, type Evaluate, familyOf } from "./cases.ts";
export { LIMIT, markdown, type Report, report, type Verdict } from "./report.ts";
export { type Written, writtenBody, writtenModule } from "./source.ts";
