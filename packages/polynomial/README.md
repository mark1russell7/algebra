# @algebra/polynomial

This private package is the first part of A8 in `docs/ROADMAP.md`, the symbolic evaluator. It gives the normal form of a polynomial in several variables with exact rational coefficients, from an expression document.

The package adds the verb `polynomial` to the kinds of `@mark1russell7/expression`. The documents do not change, and the other verbs stay.

```ts
import { normalForm, simplify } from "@algebra/polynomial";

const x = { type: "var", value: "x" } as const;
const y = { type: "var", value: "y" } as const;
const doc = { type: "mul", value: [{ type: "add", value: [x, y] }, { type: "sub", value: [x, y] }] } as const;
normalForm(doc); // ok: the kind polynomial, the key "x^2 - y^2", the error 0
simplify(doc); // ok: a document of x^2 - y^2
```

## The claim

A result of the kind `polynomial` is an exact equality of polynomial functions. The document and the polynomial have the same exact value at each real point. The error is zero.

`normalForm` gives one of three results, as the verb `exact` does:

| Kind | Claim | Error |
| --- | --- | --- |
| `polynomial` | The document equals this polynomial at each real point. | `0` |
| `no value` | The document has no real value at any point, for example `x / (x - x)`. | `0` |
| `no claim` | The verb cannot tell. | `Infinity` |

## The canonical form

Two documents that are equal as polynomials give an equal normal form, when both give a claim. Two different polynomials give different keys.

- The variables of a term are in the order of the code units of their names.
- The terms are in the graded lexicographic order.
- No term has a zero coefficient.
- A coefficient is a rational in lowest terms. A literal is the exact value of its float, so `0.1` is not `1/10`.

The key is one canonical text, for example `x^2 + 2*x*y - 3/2*y + 1`. The key of the zero polynomial is `0`. `simplify` gives a document of the normal form. A second `simplify` gives the same document. `differentiate` gives a partial derivative of a polynomial.

## What gives no claim

Only a total function has a normal form. Each of these nodes gives no claim, and the verb does not guess.

- A quotient with a divisor that is not a constant. Thus `x / x` gives no claim, because it has no value at 0.
- A negative power of a base that is not a constant.
- A root of a radicand that is not a constant, or a root of a constant that is not rational.
- A `min` or a `max` with two parts that differ by more than a constant.
- A comparison of two parts that differ by more than a constant.
- A node with a part that gives no claim. Thus `0 * (1 / x)` gives no claim.

Two parts that differ by a constant have one order at each point. Thus `min(x, x + 1)` is `x`, and `x < x + 1` is `1`. The later parts of A8 add rational functions, and they can give a claim for more of these nodes.

## The limits

Expansion can grow fast, so each node has limits. A node past a limit gives no claim, and `LIMITS` has the default values.

| Limit | Default | The field of `Limits` |
| --- | --- | --- |
| The terms of a node, and the monomials of a product before cancellation | `TERM_LIMIT`, 4096 | `maxTerms` |
| The total degree of a node, the exponent of `pow` and the index of `root` | `DEGREE_LIMIT`, 4096 | `maxDegree` |
| The bits of a numerator and of a denominator | `EXACT_BITS`, 4096 | `maxBits` |
| The products of two terms in one node | `PRODUCT_LIMIT`, 2^20 | `maxProducts` |

A limit applies to each node. Thus one form of a polynomial can give a claim, and another form can give no claim. A result of no claim tells nothing about the equality of two documents.

## The tests

The oracle is the verb `exact`. The normal form and its simplified document have the value of the original document at seeded floats. The same is true at rational points that no float holds, and at each point of the polynomial families of `@algebra/expression-corpus`. The seeded rewrites of a document change the order, the groups, the expansion and the `sub` forms, and the key stays. The variable `PROPERTY_RUNS` sets the count of documents of each property.

## What a bench needs

This package has no bench yet. A bench of the normal form needs these parts:

- The harness of `bench-select.yml`: a fresh process for each case, the order turned each round, and A/A pairs.
- The cases of the polynomial families of the corpus, and families with a stated count of terms, degree and variables.
- The time of `normalForm`, the time of a key compare, and the count of terms and of products.
- The cost of `compileExact` at many points of one document, against the cost of one normal form and its evaluation. That compare gives the break-even count of points.
- The share of the corpus that gives a claim at each limit, with the losers kept.
