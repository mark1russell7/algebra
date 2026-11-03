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

## The generator

`randomExpression(random(seed))` makes a random expression for a property test. The same seed gives the same expression. Approximately a quarter of the literals are near-degenerate constants, for example `Number.MIN_VALUE` or `0.1`.
