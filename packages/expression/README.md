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

## The generator

`randomExpression(random(seed))` makes a random expression for a property test. The same seed gives the same expression. About a quarter of the literals are near-degenerate constants, for example `Number.MIN_VALUE` or `0.1`.
