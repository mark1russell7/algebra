# @mark1russell7/interval

This package is the home of the float error bounds of algebra (roadmap item A21). It has intervals with outward rounding, balls with a midpoint and a radius, and the float steps and error terms that they use. Each operation contains the exact result of the operation on each point of its inputs.

The package has no runtime dependencies. It is in the layer numbers, so each layer above it can use it. Later bounds of arbitrary precision also go here.

## The functions

| Name | Result | Error |
| --- | --- | --- |
| `nextUp(x)`, `nextDown(x)` | The next float above or below `x` | Exact |
| `sumError(a, b, s)` | The error `e` of `s = fl(a + b)`, with `a + b = s + e` (`TwoSum`) | Exact, or `NaN` when `s` is not finite |
| `productError(a, b, p)` | The error `e` of `p = fl(a * b)`, with `a * b = p + e` (`TwoProduct`) | Exact, or `NaN` near overflow and underflow |
| `quotientIsExact(a, b, q)` | `true` when `q` is the exact quotient `a / b` | Exact |
| `addUp`, `mulUp`, `divUp`, `subDown` | A sum, product or quotient of nonnegative floats rounded upward, and a difference rounded downward | One float step at most |
| `floatRoot(r, k)` | The float root of index `k`, with an odd root of a negative value | The square root is correctly rounded |
| `interval` | The intervals: `add`, `sub`, `mul`, `div`, `neg`, `pow`, `root`, `min`, `max`, `lt`, `le`, `eq` | Outward, one float step on each end at most |
| `ball` | The balls: `ball`, `add`, `sub`, `mul`, `div`, `neg`, `pow`, `root`, `min`, `max`, `lt`, `le`, `eq`, `toInterval`, `fromInterval` | A finite radius is a claim |

An interval is `readonly [low, high]`, or `null` for the empty interval. An infinite end is no bound on its side.

A ball is `{ mid, rad }`. A finite radius is a claim: the exact result is at most `rad` from `mid`. The radius `Infinity` makes no claim. The radius functions `sumRadius`, `productRadius`, `quotientRadius`, `extremeRadius` and `rootRadius` make no object. An evaluator that keeps the midpoint and the radius in two numbers uses them.

```ts
import { ball, interval } from "@mark1russell7/interval";

interval.add([0.1, 0.1], [0.2, 0.2]); // [0.3, 0.3000000000000001]: one step each side of the float sum
ball.mul(ball.ball(3, 0.5), ball.ball(2)); // { mid: 6, rad: 1 }
```

## The law tests

- `src/enclosure.test.ts` has a fast-check property for each operation. The property compares the result with the exact rationals of `@mark1russell7/rational` at the ends and the midpoint of each input.
- Planted operations with a bound one float step too narrow fail the same properties.
- `src/width.test.ts` is the width gate. A fixed family of inputs from `@mark1russell7/rigor-generators` goes through 6 chains of operations, for intervals and for balls.
- The gate keeps the median and the largest width of each chain, in float steps, in `test/width-record.json`.
- A larger width fails the gate. A smaller width also fails, until the record changes with it. So the gate holds each gain.
- Planted operations with a bound one step wider fail the gate.
- To write a new record, set `INTERVAL_WIDTH_RECORD=update` and start the width test. Commit the record with the change that moves a width.
