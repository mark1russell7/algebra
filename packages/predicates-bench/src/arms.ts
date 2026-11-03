/**
 * The two arms of the bench. Arm `a` is the base: `robust-predicates`. Arm `b` is the candidate:
 * `@mark1russell7/predicates`. The two arms give the sign in one convention, so a case gives the same sum in each arm.
 *
 * @packageDocumentation
 */
import { incircleSign, orient2dSign } from "@mark1russell7/predicates";
import { incircle as rpIncircle, orient2d as rpOrient2d } from "robust-predicates";
import type { Signs } from "./cases.ts";

/** The arm of `robust-predicates`. Its orientation sign is the negative one, so the arm changes it. */
export const robust: Signs = {
  orient: (ax, ay, bx, by, cx, cy) => {
    const d = rpOrient2d(ax, ay, bx, by, cx, cy);
    return d < 0 ? 1 : d > 0 ? -1 : 0;
  },
  incircle: (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d = rpIncircle(ax, ay, bx, by, cx, cy, dx, dy);
    return d > 0 ? 1 : d < 0 ? -1 : 0;
  },
};

/** The arm of `@mark1russell7/predicates`: the sign forms, which make no object. */
export const predicates: Signs = { orient: orient2dSign, incircle: incircleSign };
