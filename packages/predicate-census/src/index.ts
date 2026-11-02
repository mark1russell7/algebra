/**
 * A census of the real inputs of the geometric predicates of highways and packing. It counts the inputs whose sign
 * the A1 bounds cannot fix, and the inputs whose float answer is wrong. This is the base of A5.
 *
 * @packageDocumentation
 */
export * as dyadic from "./dyadic.ts";
export type { Dyadic } from "./dyadic.ts";
export { boundSign, exactValue, floatValue, orient, signForm } from "./expressions.ts";
export type { Point, PointExpr, Sign, SignForm } from "./expressions.ts";
export { boxPairLine, countLine, FAR_FIELDS, parseLine, segmentBoxLine, segmentPairLine, unseenNear } from "./input.ts";
export type { Box, BoxPairLine, CountLine, Line, LineBase, SegmentBoxLine, SegmentPairLine, Vec } from "./input.ts";
export { boxPair, boxPairPoint, PREDICATES, segmentBox, segmentBoxPoint, segmentPair, segmentPairPoint } from "./predicates.ts";
export type { Predicate, PredicateName } from "./predicates.ts";
export { classify, Tally } from "./census.ts";
export type { CaseSummary, Census, Classified, Group, InputRecord, SignRecord, UnknownRecord } from "./census.ts";
export { ASSUMPTIONS, censusOfFiles, FAR_FILTER, findFiles } from "./report.ts";
export type { FarCheck, InputFile, Report } from "./report.ts";
