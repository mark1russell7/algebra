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

## The static bound

The verb `static` gives one enclosure and one error bound for all points of a box. It closes the static items of A3 and A4. A call makes one walk over the tree and uses no point. The summary of a document holds no box, so the caller gives it.

```ts
import { compileStatic, staticBound } from "@mark1russell7/expression";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 0.1 }] } as const;
const r = staticBound(doc, { bounds: { x: [0, 1] } });
if (r.ok) {
  const { enclosure, error } = r.value;
  // enclosure contains x + 0.1 at each point of the box.
  // |value of compileFloat - (x + 0.1)| <= error at each point of the box.
}
const f = compileStatic(doc); // The same bound for a new box: f.value.evaluate([[0, 1]]).
```

- `enclosure` is the result of the verb `interval` for the box. A value of `null` or `"no claim"` has the same meaning.
- A divisor that holds zero gives `"no claim"`. An even root of a value that can be negative gives it too.
- The point zero as a divisor gives `null`. An even root of a negative interval gives `null` too. Each of these is a true claim.
- `error` bounds the error of the float program of `compileFloat`. The rule of each node is the rule of the verb `float`, with the size of the enclosure in place of the float value.
- A float divisor or radicand that can leave its domain gives the error `Infinity`. A float program that can overflow gives it too.
- A root of index 3 or more gives a true enclosure and the error `Infinity`. `Math.pow` has no stated accuracy, and the walk has no float root to read.
- A comparison has the error `0` when the float truth value is the exact truth value at each point. Else its error is `1`.
- A variable without bounds in `staticBound` has the whole line.

The bound is correct but wide when the box loses a dependency. The box has one interval for each variable, and the walk does not see that two parts are the same variable. On `[1, 2]`, `x - x` has the real error 0 and the running bound `2.2e-308`, but the static bound is `1.1e-16` and the enclosure is `[-1, 1]`.

The test of the corpus prints the table below. "Worst" is the static bound over the largest running bound of the points of the box. "Each" is the median over each point. "Enclosure" is the width of the enclosure over the range of the float values at the points.

| Family | Box of the points: worst | Box of the points: each | Box of the points: enclosure | Narrow box: worst | Narrow box: enclosure |
| --- | --- | --- | --- | --- | --- |
| `small` | 1.00 | 2.10 | 1.00 | 1.00 | 1.00 |
| `large` | no finite bound | no finite bound | no finite bound | no finite bound | no finite bound |
| `well` | 1.00 | 75.3 | 1.00 | 1.00 | 1.00 |
| `ill` | 1.01 | 1.03 | 1.67e14 | 1.00 | 3.75e10 |
| `orient-random` | 2.57 | 20.3 | 3.37 | 1.00 | 1.84 |
| `orient-near` | 2.55 | 32.3 | 3.30 | 1.00 | 1.88 |
| `incircle-random` | 10.3 | 298 | 86.5 | 1.00 | 10.3 |
| `incircle-near` | 11.6 | 460 | 81.7 | 1.00 | 9.16 |

Each value is a median over the cases of the family. A narrow box has a radius of `2^-20` of each value. A box of one point has a median ratio of 1.0000000000000002 on the generator. The family `ill` shows dependency: its expanded form cancels, so the enclosure is much wider than the range.

No case of `large` has a finite bound, and most cases of `small` have none. A root of index 3 or more, a pole or a wide enclosure gives this result. The test does not count each cause.

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

## The generator

`randomExpression(random(seed))` makes a random expression for a property test. The same seed gives the same expression. Approximately a quarter of the literals are near-degenerate constants, for example `Number.MIN_VALUE` or `0.1`.
