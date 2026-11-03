/**
 * Expression documents on coeval: the kinds, a summary of each node, the float, interval, ball and exact evaluators,
 * a zod schema and a seeded generator.
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
  compileExact,
  compileFloat,
  compileInterval,
  compileTape,
  expressionMachine,
  expressionWorld,
  EXACT,
  FLOAT,
  INTERVAL,
  KINDS,
  SHAPES,
  SUMMARY,
  summarize,
  TAPE,
} from "./kinds.ts";
export type { BallFunction, CompileFloatOptions, ExactFunction, FloatFunction, IntervalFunction, Shape, SummarizeOptions } from "./kinds.ts";
export { floatNode, floatNum, floatRoot, floatVar, rootError, UNIT_ROUNDOFF } from "./float.ts";
export { decideInterval, intervalNode, intervalNum, intervalVar, NO_CLAIM } from "./interval-evaluator.ts";
export type { Enclosure, IntervalCell, IntervalInput, IntervalRun } from "./interval-evaluator.ts";
export { ballNode, ballNum, ballVar, decideBall } from "./ball.ts";
export { EXACT_BITS, exactNode, exactNum, exactVar } from "./exact.ts";
export type { ExactCell, ExactResult, ExactRun } from "./exact.ts";
export type { Ball, BallCell, BallInput, BallRun, Truth } from "./ball.ts";
export type { FloatCell, FloatResult, FloatRun } from "./float.ts";
export { DEGENERATE_CONSTANTS, random, randomComparison, randomExpression } from "./generate.ts";
export type { GenerateOptions, InnerKind, Random } from "./generate.ts";
