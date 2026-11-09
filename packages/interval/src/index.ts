/**
 * Float error bounds, with no imports. The namespace `interval` has the outward-rounded intervals, and the namespace
 * `ball` has the midpoint-radius balls. The steps of a float, the error-free transforms of a sum and a product, and
 * the directed rounding are also at the top level.
 *
 * @packageDocumentation
 */
export * as ball from "./ball.ts";
export type { Ball } from "./ball.ts";
export * as interval from "./interval.ts";
export { nextDown, nextUp, productError, quotientIsExact, sumError, WHOLE } from "./interval.ts";
export type { Interval } from "./interval.ts";
export { addUp, divUp, floatRoot, mulUp, subDown } from "./rounding.ts";
