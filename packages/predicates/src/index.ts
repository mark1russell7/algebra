/**
 * Exact geometric predicates for float inputs: the orientation, the in-circle test and the intersection of two
 * segments. A float filter with a stated error bound answers first. The exact sign over dyadic numbers answers the rest.
 * Each result names the stage that decided it.
 *
 * @packageDocumentation
 */
export * as dyadic from "./dyadic.ts";
export type { Dyadic } from "./dyadic.ts";
export { UNDERFLOW_TERM, UNIT_ROUNDOFF } from "./sign.ts";
export type { Sign, SignResult, Stage } from "./sign.ts";
export { ORIENT_BOUND, orient2d, orient2dExact, orient2dSign } from "./orient.ts";
export { INCIRCLE_BOUND, incircle, incircleExact, incircleSign } from "./incircle.ts";
export { segmentIntersection } from "./segment.ts";
export type { SegmentIntersection, SegmentRelation } from "./segment.ts";
