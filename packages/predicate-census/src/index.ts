/**
 * A census of the real inputs of the geometric predicates of highways and packing. It counts the inputs whose sign
 * the A1 bounds cannot fix, and the inputs whose float answer is wrong. This is the base of A5.
 *
 * @packageDocumentation
 */
export * as dyadic from "./dyadic.ts";
export type { Dyadic } from "./dyadic.ts";
export { boundSign, exactValue, floatValue, orient, orientForm, signForm, structuralZero } from "./expressions.ts";
export type { Point, PointExpr, PointVars, Sign, SignForm } from "./expressions.ts";
export {
  boxPairLine,
  COUNT_FIELDS,
  countLine,
  parseLine,
  pointSideLine,
  SHARED_END_FIELD,
  segmentBoxLine,
  segmentPairLine,
  segmentRectLine,
} from "./input.ts";
export type {
  Box,
  BoxPairLine,
  CountKind,
  CountLine,
  FloatAnswer,
  Line,
  LineBase,
  PointSideLine,
  Rect,
  SegmentBoxLine,
  SegmentPairLine,
  SegmentRectLine,
  Vec,
} from "./input.ts";
export {
  boxPair,
  boxPairPoint,
  pointSide,
  pointSidePoint,
  PREDICATES,
  segmentBox,
  segmentBoxPoint,
  segmentPair,
  segmentPairPoint,
  segmentRect,
  segmentRectPoint,
} from "./predicates.ts";
export type { Answer, Predicate, PredicateName } from "./predicates.ts";
export { classify, NEAR_COLLINEAR, nearLine, sharedVertex, Tally } from "./census.ts";
export type {
  CaseSummary,
  Census,
  Classified,
  Group,
  InputRecord,
  NearCheck,
  Rollup,
  SharedEndCounts,
  SignRecord,
  UnknownRecord,
} from "./census.ts";
export { ASSUMPTIONS, censusOfFiles, FAR_FILTER, findFiles } from "./report.ts";
export type { FarCheck, InputFile, Report, Totals } from "./report.ts";
