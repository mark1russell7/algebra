/**
 * Exact geometric predicates for float inputs: the orientation, the in-circle test and the intersection of two
 * segments. A float filter with a stated error bound answers first. The exact sign over dyadic numbers answers the rest.
 * Each result names the stage that decided it. The shifted forms take points that move by a translation, with no rounding.
 * The ring test gives the exact location of a point against polygon rings, and the edge test examines one edge.
 *
 * @packageDocumentation
 */
export * as dyadic from "./dyadic.ts";
export type { Dyadic } from "./dyadic.ts";
export { UNDERFLOW_TERM, UNIT_ROUNDOFF } from "./sign.ts";
export type { Sign, SignResult, Stage } from "./sign.ts";
export { ORIENT_BOUND, orient2d, orient2dExact, orient2dSign } from "./orient.ts";
export { INCIRCLE_BOUND, INCIRCLE_UNDERFLOW_TERM, incircle, incircleExact, incircleSign } from "./incircle.ts";
export { classifySegments } from "./segment.ts";
export { classifySegmentsShifted, compareShifted, ORIENT_SHIFTED_BOUND, orient2dShifted, orient2dShiftedSign } from "./shifted.ts";
export type { SegmentIntersection, SegmentRelation } from "./segment.ts";
export { locateInRings, rayEdge } from "./ring.ts";
export type { PointLocation, PolygonRing, RayEdge } from "./ring.ts";
