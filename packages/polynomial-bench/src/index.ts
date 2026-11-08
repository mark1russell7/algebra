/**
 * The bench of A8. It measures the cost of a normal form against the verb `exact`, and the cost of a solution. It also
 * gives the share of the cases with a claim at each tier of limits. The records and the verdicts come from `@mark1russell7/rigor-bench`.
 *
 * @packageDocumentation
 */
export { type ArmName, armsOf, type DifferentPair, PAIRS, type PairName, pairsOf, rewriteOf, runOf } from "./arms.ts";
export { type BenchCase, benchCase, caseNames, familyOf, GENERATED, isRootFamily, POINTS, type Shape } from "./cases.ts";
export { type ClaimRecord, claimRecords, type Tier, TIERS, type Verb } from "./claims.ts";
export { type BreakEven, checkReads, type ClaimShare, crossing, line, markdown, type Meta, type PairVerdict, type Report, report } from "./report.ts";
