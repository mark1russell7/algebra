/**
 * The bench of the time claim of A5. It times `@mark1russell7/predicates` against `robust-predicates` on random and
 * near-degenerate inputs. The records and the verdicts come from `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { predicates, robust } from "./arms.ts";
export { BATCH, type Case, casesFor, GROUPS, type Group, groupOf, SEEDS, type Signs } from "./cases.ts";
export { type GroupReport, markdown, type Report, report } from "./report.ts";
