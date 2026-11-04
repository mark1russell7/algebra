/**
 * A census of the real inputs of the geometric predicates of highways and packing. It counts the inputs whose sign
 * the A1 bounds cannot fix, and the inputs whose float answer is wrong. This is the base of A5.
 *
 * @packageDocumentation
 */
export { dyadic } from "@mark1russell7/predicates";
export type { Dyadic } from "@mark1russell7/predicates";
export { boundSign, exactValue, floatValue, orient, orientForm, signForm, structuralZero } from "./expressions.ts";
export type { Point, PointExpr, PointVars, Sign, SignForm } from "./expressions.ts";
export {
  boxPairLine,
  containerLine,
  COUNT_FIELDS,
  countLine,
  edgePairLine,
  PACKING_UNMODELED,
  packingCountLine,
  parseLine,
  pointSideLine,
  nearestLine,
  SHARED_END_FIELD,
  segmentBoxLine,
  segmentPairLine,
  segmentRectLine,
  stripLine,
} from "./input.ts";
export type {
  Box,
  BoxPairLine,
  ContainerLine,
  CountKind,
  CountLine,
  EdgeBox,
  EdgePairLine,
  FloatAnswer,
  Line,
  LineBase,
  PackingCountLine,
  PackingLineBase,
  PointSideLine,
  NearestLine,
  Rect,
  SegmentBoxLine,
  SegmentPairLine,
  SegmentRectLine,
  StripLine,
  Vec,
} from "./input.ts";
export {
  boxPair,
  boxPairPoint,
  CALL_SITE_RULES,
  checkRuleSources,
  containerPoint,
  containerPredicate,
  edgePair,
  edgePairPoint,
  nearest,
  nearestFirstHigher,
  nearestPoint,
  pointSide,
  pointSidePoint,
  pointSideTieLow,
  predicateOfRule,
  PREDICATES,
  segmentBox,
  segmentBoxPoint,
  segmentPair,
  segmentPairClosed,
  segmentPairPoint,
  segmentRect,
  segmentRectPoint,
  strip,
  stripPoint,
} from "./predicates.ts";
export type { Answer, CallSiteRule, DumpRule, Predicate, PredicateName, RuleSource, RuleSourceCheck } from "./predicates.ts";
export { classify, NEAR_COLLINEAR, nearLine, PACKING_PREDICATES, sharedVertex, Tally } from "./census.ts";
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
  TallyOptions,
  UnknownRecord,
} from "./census.ts";
export { ASSUMPTIONS, censusOfFiles, FAR_FILTER, findFiles } from "./report.ts";
export type { FarCheck, InputFile, Report, Totals } from "./report.ts";
