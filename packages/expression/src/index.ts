/**
 * Expression documents on coeval: the kinds, a summary of each node, the float, interval and ball evaluators, a zod
 * schema and a seeded generator.
 *
 * @packageDocumentation
 */
export * as interval from "./interval.ts";
export type { Interval } from "./interval.ts";
export { costMonoid, freeMonoid, combine, numSummary, varSummary } from "./summary.ts";
export type { ComparisonKind, ExpressionKind, KindName, Monoid, NodeData, Summary } from "./summary.ts";
export { comparisonSchema, documentSchema, expressionSchema, VARIABLE_NAME } from "./schema.ts";
export type { Binary, Comparison, Document, Expression, Nary, Neg, Num, Pow, Root, Var } from "./schema.ts";
export {
  BALL,
  compileBall,
  compileFloat,
  compileInterval,
  expressionMachine,
  expressionWorld,
  FLOAT,
  INTERVAL,
  KINDS,
  SHAPES,
  SUMMARY,
  summarize,
} from "./kinds.ts";
export type { BallFunction, CompileFloatOptions, FloatFunction, IntervalFunction, Shape, SummarizeOptions } from "./kinds.ts";
export { floatNode, floatNum, floatRoot, floatVar, rootError, UNIT_ROUNDOFF } from "./float.ts";
export { decideInterval, intervalNode, intervalNum, intervalVar, NO_CLAIM } from "./interval-evaluator.ts";
export type { Enclosure, IntervalCell, IntervalInput, IntervalRun } from "./interval-evaluator.ts";
export { ballNode, ballNum, ballVar, decideBall } from "./ball.ts";
export type { Ball, BallCell, BallInput, BallRun, Truth } from "./ball.ts";
export type { FloatCell, FloatResult, FloatRun } from "./float.ts";
export { DEGENERATE_CONSTANTS, random, randomComparison, randomExpression } from "./generate.ts";
export type { GenerateOptions, InnerKind, Random } from "./generate.ts";
