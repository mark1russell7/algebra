/**
 * Expression documents on coeval: the kinds, a summary of each node and a zod schema. The package also has a seeded
 * generator, and the float, interval, ball, exact and bigfloat evaluators.
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
  BIGFLOAT,
  compileBall,
  compileBigfloat,
  compileExact,
  compileFloat,
  compileInterval,
  compileStatic,
  expressionMachine,
  expressionWorld,
  EXACT,
  FLOAT,
  INTERVAL,
  KINDS,
  SHAPES,
  STATIC,
  staticBound,
  SUMMARY,
  summarize,
} from "./kinds.ts";
export type { BallFunction, BigfloatClaim, BigfloatFunction, BigfloatResult, CompileFloatOptions, ExactFunction, FloatFunction, IntervalFunction, Shape, SummarizeOptions } from "./kinds.ts";
export { floatNode, floatNum, floatRoot, floatVar, rootError, UNIT_ROUNDOFF } from "./float.ts";
export { decideInterval, intervalNode, intervalNum, intervalVar, NO_CLAIM } from "./interval-evaluator.ts";
export type { Enclosure, IntervalCell, IntervalInput, IntervalRun } from "./interval-evaluator.ts";
export { ballNode, ballNum, ballVar, decideBall } from "./ball.ts";
export { bigfloatNode, bigfloatNum, bigfloatVar, decideBigfloat } from "./bigfloat-evaluator.ts";
export type { BigEnclosure, BigfloatCell, BigfloatRun, BigInput, BigInterval } from "./bigfloat-evaluator.ts";
export { EXACT_BITS, exactNode, exactNum, exactVar } from "./exact.ts";
export type { ExactCell, ExactResult, ExactRun } from "./exact.ts";
export { staticNode, staticNum, staticVar } from "./static-bound.ts";
export type { StaticBound, StaticCell, StaticRun } from "./static-bound.ts";
export type { StaticFunction } from "./kinds.ts";
export type { Ball, BallCell, BallInput, BallRun, Truth } from "./ball.ts";
export type { FloatCell, FloatResult, FloatRun } from "./float.ts";
export { DEGENERATE_CONSTANTS, random, randomComparison, randomExpression } from "./generate.ts";
export type { GenerateOptions, InnerKind, Random } from "./generate.ts";
