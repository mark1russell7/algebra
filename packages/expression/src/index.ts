/**
 * Expression documents on coeval: the kinds, a summary of each node, a zod schema and a seeded generator.
 *
 * @packageDocumentation
 */
export * as interval from "./interval.ts";
export type { Interval } from "./interval.ts";
export { costMonoid, freeMonoid, combine, numSummary, varSummary } from "./summary.ts";
export type { ComparisonKind, ExpressionKind, KindName, Monoid, NodeData, Summary } from "./summary.ts";
export { comparisonSchema, documentSchema, expressionSchema, VARIABLE_NAME } from "./schema.ts";
export type { Binary, Comparison, Document, Expression, Nary, Neg, Num, Pow, Root, Var } from "./schema.ts";
export { expressionMachine, expressionWorld, KINDS, SHAPES, SUMMARY, summarize } from "./kinds.ts";
export type { Shape, SummarizeOptions } from "./kinds.ts";
export { DEGENERATE_CONSTANTS, random, randomComparison, randomExpression } from "./generate.ts";
export type { GenerateOptions, InnerKind, Random } from "./generate.ts";
