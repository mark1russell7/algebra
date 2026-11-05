# @mark1russell7/predicates

This package holds the exact geometric predicates of algebra (roadmap item A5). Each predicate takes float inputs and gives the exact sign. A float filter with a stated error bound answers first. An adaptive stage over float expansions answers most of the rest. The exact sign over dyadic numbers answers the last inputs. Each result names the stage that decided it.

The first users are packing and highways. The census of A13 found no float sign that a user sees and that exact signs fix. The float-wrong inputs of the census were ties at a tolerance and touches. Thus this package gives correct ties and touches, with a cheap common case.

The package has no runtime dependencies. The entry `@mark1russell7/predicates/corpus` is for the tests and the benches of this workspace. It is not in the npm package.

## The functions

| Function | Result | Error |
| --- | --- | --- |
| `orient2d(ax, ay, bx, by, cx, cy)` | The sign of the orientation of `a`, `b` and `c`, and the stage | Exact |
| `orient2dSign(...)` | The same sign without the stage, for a hot loop | Exact |
| `orient2dExact(...)` | The sign of the exact stage, with no filter | Exact |
| `incircle(ax, ay, bx, by, cx, cy, dx, dy)` | The sign of the in-circle test of `d`, and the stage | Exact |
| `incircleSign(...)`, `incircleExact(...)` | The same sign without the stage, and the exact stage alone | Exact |
| `classifySegments(ax, ay, bx, by, cx, cy, dx, dy)` | The relation of the closed segments `ab` and `cd`, the collinear flag and the stage | Exact |
| `dyadic` | The dyadic numbers `m * 2^e` over `bigint`: `fromFloat`, `add`, `sub`, `mul`, `sign`, `compare` | Exact |

The inputs must be finite. Each function refuses `NaN` and an infinite value with a `RangeError`.

## The signs

- `orient2d` gives 1 when `a`, `b` and `c` turn counterclockwise in axes with `y` up. It gives -1 for a clockwise turn, and 0 when the points are on one line. This is the sign of Shewchuk.
- `incircle` gives 1 when `d` is inside the circle through `a`, `b` and `c`, and these points turn counterclockwise. A clockwise turn changes the sign. The value 0 tells that the four points are on one circle or one line.
- `robust-predicates` on npm gives the negative orientation sign, for axes with `y` down. Its in-circle sign is the same as the sign of this package.

## The relations of two segments

| Relation | Meaning |
| --- | --- |
| `disjoint` | The segments have no common point. |
| `cross` | The segments have one common point, inside each segment. |
| `touch` | The segments have exactly one common point, and it is an end. A shared end is a touch. |
| `overlap` | The segments are on one line, and their common part is longer than 0. |

The flag `collinear` is `true` when the four points are on one line. Then the order of the floats along the line gives the relation. A proper crossing, as `geom.segmentsCross` of highways, is the relation `cross`. A closed crossing is each relation except `disjoint`.

## The filters

| Predicate | The filter decides when | Bound |
| --- | --- | --- |
| `orient2d` | `abs(det) > ORIENT_BOUND * abs(left + right) + UNDERFLOW_TERM` | `ORIENT_BOUND = (3 + 32u) u` |
| `incircle` | `abs(det) > INCIRCLE_BOUND * permanent + INCIRCLE_UNDERFLOW_TERM * (alift + blift + clift + 1)` | `INCIRCLE_BOUND = (10 + 128u) u` |

The value `u` is `2^-53`, `UNDERFLOW_TERM` is `2^-1069`, and `INCIRCLE_UNDERFLOW_TERM` is `2^-1022`. The in-circle filter multiplies its term at each call, and a product with a subnormal result is slow on some processors. So its factor is the smallest normal float. The bounds are the bounds of Shewchuk (1997) with a larger second term. The term for underflow is new: Shewchuk assumes that no operation underflows. The TSDoc of each bound has the proof sketch.

The filter of `orient2d` also decides an exact 0. When a factor of each product is a difference of two equal floats, the sign is 0. Two equal points `a` and `b` also give 0.

## The adaptive stage

An input that the filter does not decide goes to the adaptive stage, from the method of Shewchuk (1997). Each step costs more than the last step. The stage has its own arithmetic in `src/expansion.ts`, and its answers are exact. A result of this stage has the stage `exact`.

| Predicate | Stage B | Stage C | Last stage |
| --- | --- | --- | --- |
| `orient2d` | The exact expansion of the float differences, with `ORIENT_STAGE_B = (2 + 64u) u` | The first-order terms of the tails, with `ORIENT_STAGE_C = 64u^2` and `RESULT_BOUND = 20u` | The full expansion, with no bound |
| `incircle` | The exact expansion of the float differences, with `INCIRCLE_STAGE_B = (4 + 128u) u` | The first-order terms of the tails, with `INCIRCLE_STAGE_C = 128u^2` and `RESULT_BOUND = 20u` | The exact sign over dyadic numbers |

When all tails are 0, the expansion of stage B is the exact value. These bounds are larger than the bounds of Shewchuk because their proof uses a simpler estimate. The TSDoc of each bound has the proof.

The stage accepts only inputs that are 0 or that have a magnitude from `2^-150` to `2^150`. So no operation underflows with an error or overflows. Other inputs get the exact sign over dyadic numbers.

The file `src/adaptive.test.ts` compares the stage with the exact stage on near-degenerate inputs and on ties. It also compares each measured error with its bound.

## The tests

The property tests compare each predicate with the exact rationals of `@mark1russell7/rational` on a seeded corpus:

- random points at the scales 1, `2^10` and `2^20`,
- whole numbers on a small grid, with many ties,
- near-degenerate points: ulp steps around a line or a circle,
- exact ties: repeated points, axis lines, corners of a box,
- tiny and huge scales, down to the subnormal floats and up to the overflow of a product,
- the 42 real float-wrong records of the A13 census.

On the same corpus without the tiny and huge scales, the signs agree with `robust-predicates`. On the tiny and huge scales, `robust-predicates` gives wrong signs, because its float stage underflows or overflows.

```ts
import { orient2d, classifySegments } from "@mark1russell7/predicates";

orient2d(0, 0, 1, 0, 0, 1);                 // { sign: 1, stage: "filter" }
orient2d(0, 0, 1, 1, 2, 2);                 // { sign: 0, stage: "exact" }
classifySegments(0, 0, 2, 0, 2, 0, 3, 3); // { relation: "touch", collinear: false, stage: "filter" }
```
