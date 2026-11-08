/**
 * The bench of the time claim of A2. It times the new rationals of `@mark1russell7/rational` against the old rationals
 * of `@mark1russell7/quantity`, on the rational steps of the tests of quantity. The records and the verdict come from
 * `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { type Case, type Rational, type Rationals, casesFor } from "./cases.ts";
export { checkReads, type Report, type ReportOptions, markdown, report } from "./report.ts";
