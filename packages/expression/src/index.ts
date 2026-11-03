/**
 * Expression documents on coeval: the kinds, a summary of each node, the float evaluator, a zod schema and a seeded
 * generator.
 *
 * @packageDocumentation
 */
export * as interval from "./interval.ts";
export type { Interval } from "./interval.ts";
export { costMonoid, freeMonoid, combine, numSummary, varSummary } from "./summary.ts";
export type { ComparisonKind, ExpressionKind, KindName, Monoid, NodeData, Summary } from "./summary.ts";
export { comparisonSchema, documentSchema, expressionSchema, VARIABLE_NAME } from "./schema.ts";
export type { Binary, Comparison, Document, Expression, Nary, Neg, Num, Pow, Root, Var } from "./schema.ts";
export { compileFloat, expressionMachine, expressionWorld, FLOAT, KINDS, SHAPES, SUMMARY, summarize } from "./kinds.ts";
export type { CompileFloatOptions, FloatFunction, Shape, SummarizeOptions } from "./kinds.ts";
export { floatNode, floatNum, floatVar, UNIT_ROUNDOFF } from "./float.ts";
export type { FloatCell, FloatResult, FloatRun } from "./float.ts";
export { DEGENERATE_CONSTANTS, random, randomComparison, randomExpression } from "./generate.ts";
export type { GenerateOptions, InnerKind, Random } from "./generate.ts";
