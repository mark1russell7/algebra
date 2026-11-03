# @mark1russell7/expression

This package holds the expression documents of algebra (roadmap item A1). An expression is a coeval document. Each evaluator of a later item adds a verb to its kinds. The documents do not change.

## The kinds

| Kind | Value | Meaning |
| --- | --- | --- |
| `num` | a finite number, not `-0` | The exact binary value of the float |
| `var` | a name | A variable |
| `add`, `mul`, `min`, `max` | a list of two parts or more | The sum, the product, the smallest, the largest |
| `sub`, `div` | a list of two parts | The difference, the quotient |
| `neg` | one part | The negation |
| `pow` | `{ base, exp }`, with a whole `exp` | A whole power. The power zero gives one |
| `root` | `{ radicand, index }`, with a whole `index` of 2 or more | The real root |
| `lt`, `le`, `eq` | a list of two expressions | A comparison |

Each child is an envelope `{ type, value }`. The schema `documentSchema` refuses bare values.

## The summary

The verb `summary` gives four values for each node:

- `free`: the free variables. The union of sorted lists is the monoid.
- `degree`: an upper bound of the polynomial degree, or `null` for a node that is not a polynomial.
- `bounds`: an interval that contains the exact real value. Each operation rounds outward, so the interval is the error bound.
- `cost`: the count of the nodes of each kind. The sum of the counts is the monoid.

```ts
import { summarize } from "@mark1russell7/expression";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 0.1 }] } as const;
const result = summarize(doc, { bounds: { x: [0, 1] } });
// result.value.bounds contains x + 0.1 for each x in [0, 1].
```

## The float evaluator

The verb `float` compiles a document one time into a tree of closures (roadmap item A3). Each call gives a float value and a bound of its error. The code has no `eval` and no `new Function`.

```ts
import { compileFloat } from "@mark1russell7/expression";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 0.1 }] } as const;
const f = compileFloat(doc);
if (f.ok) {
  const { value, error } = f.value.evaluate([0.2]);
  // |value - (x + 0.1)| <= error, with the exact real value of x + 0.1.
}
```

The bound is a running forward bound with the unit roundoff `u = 2^-53`:

- Each rounded operation adds `u * |v|` for its result `v`, and a small term for underflow.
- The error of each input goes through the operation by its rule. A product adds `|a| eb + |b| ea + ea eb`.
- Each node makes its float bound larger by the factor `1 + 2^-40`, so the float sum is not less than the real sum.
- A quotient by a value whose bound holds zero gives the bound `Infinity`. An even root of a value whose bound holds a negative value does too.
- A root of index 3 or more takes its bound from the outward powers of `interval`, not from the accuracy of `Math.pow`.
- A comparison gives `1` or `0`. Its bound is `0` when the bounds of the two sides decide it, and `1` when they do not.

A finite bound is a claim. The expression has a real value, and the float value is at most the bound from it. The bound `Infinity` makes no claim.

## The interval evaluator

The verb `interval` compiles a document one time, as the verb `float` does (roadmap item A4). Each variable is a number or an interval `[low, high]`. Each call gives an interval that contains the exact value at each point of the inputs.

```ts
import { compileInterval, NO_CLAIM } from "@mark1russell7/expression";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 0.1 }] } as const;
const f = compileInterval(doc);
if (f.ok) {
  const r = f.value.evaluate([[0.2, 0.3]]);
  // r contains x + 0.1 for each x in [0.2, 0.3]. r can also be null or NO_CLAIM.
}
```

- Each operation is an operation of `interval`. A sum, a product, a quotient and a square root move one float step outward on each side, when they are not exact.
- The error terms of `TwoSum` and `TwoProduct` tell if a sum or a product is exact.
- A root of index 3 or more moves each bound until the outward power shows its side.
- `null` is a claim: no point of the inputs gives a real value, for example a quotient by the point zero.
- `"no claim"` (`NO_CLAIM`) is the undecided case. A divisor that holds zero gives it. An even root of a value that can be negative and a variable that is not finite give it too.
- A comparison gives `[1, 1]`, `[0, 0]` or `[0, 1]`. `decideInterval` gives `true`, `false` or `"undecided"`.

## The ball evaluator

The verb `ball` gives a midpoint and a radius (roadmap item A4). Each variable is a number or a ball `{ mid, rad }`. The rules are the "midrad" arithmetic of Rump and of Arb.

```ts
import { compileBall } from "@mark1russell7/expression";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 0.1 }] } as const;
const f = compileBall(doc);
if (f.ok) {
  const { mid, rad } = f.value.evaluate([0.2]);
  // |mid - (x + 0.1)| <= rad, with the exact real value of x + 0.1.
}
```

- The midpoint is the float value of the verb `float`: the same operations in the same order.
- The radius adds the radius of the parts and the exact error of the rounding of the midpoint. Each operation of the radius rounds upward.
- An exact operation has the radius zero.
- A divisor whose ball holds zero gives the radius `Infinity`, which makes no claim. An even root of a ball that holds a negative value does too.
- A comparison has the radius `0` when the balls decide it, and `1` when they do not. `decideBall` gives the truth value.

The source of `ball.ts` has the proof sketch of each rule. The property tests compare the interval, the ball and the bound of A3 with the exact rationals of `@mark1russell7/rational`. They also print the median width of each one.

## The exact evaluator

The verb `exact` gives the exact value as a rational of `@mark1russell7/rational` (roadmap item A6). Its error is zero. Each operation is on `bigint`, so it costs more than the other verbs.

```ts
import { compileExact } from "@mark1russell7/expression";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 0.1 }] } as const;
const f = compileExact(doc);
if (f.ok) f.value.evaluate([0.2]); // the rational of the float 0.2 plus the rational of the float 0.1
```

- A quotient by zero and a negative power of zero give `null`: the point has no real value.
- An even root of a negative value gives `null` too.
- A root of a radicand other than `0`, `1` and `-1` gives `"no claim"`, because its value is not always rational. A variable that is not finite gives `"no claim"` too.

## The arbitrary precision evaluator

The verb `bigfloat` gives an interval with `BigFloat` ends of `@algebra/bigfloat` (roadmap item A7). Each call selects its precision in bits, so a caller can repeat a call at a higher precision with no new compilation.

```ts
import { compileBigfloat } from "@mark1russell7/expression";

const doc = { type: "root", value: { radicand: { type: "num", value: 2 }, index: 2 } } as const;
const f = compileBigfloat(doc);
if (f.ok) f.value.evaluate([], 256); // { low, high, error }: the error is the width, 2^-255
```

- Each operation rounds correctly. The low end rounds down and the high end rounds up.
- The field `error` is the width `high - low`, rounded up. It bounds the distance from each value of the interval to the exact value.
- An exact operation gives a point, so a document of exact operations has the error zero.
- A variable can have more bits than a double: its value can be a `BigFloat` or a rational. An interval goes outward from a rational at the precision of the call. A literal `num` of a document stays a double, because a document does not change.
- `null` and `"no claim"` have the rules of the verb `interval`. An exponent past `MAX_EXPONENT` of `@algebra/bigfloat` gives `"no claim"` too.
- A comparison gives the point 1, the point 0, or `[0, 1]` when the intervals do not decide it. `decideBigfloat` gives the truth value.

At 53 bits or more, each end is at or inside the end of the verb `interval`. The property test examines this at 256 bits on the corpus.

## The generator

`randomExpression(random(seed))` makes a random expression for a property test. The same seed gives the same expression. Approximately a quarter of the literals are near-degenerate constants, for example `Number.MIN_VALUE` or `0.1`.
