# @algebra/polynomial

This private package is A8 in `docs/ROADMAP.md`, the symbolic evaluator. It gives the normal form of a polynomial and of a rational function in several variables with exact rational coefficients, from an expression document. It also solves linear systems and polynomial equations in one variable.

The package adds the verbs `polynomial` and `rational` to the kinds of `@mark1russell7/expression`. The documents do not change, and the other verbs stay.

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

Two parts that differ by a constant have one order at each point. Thus `min(x, x + 1)` is `x`, and `x < x + 1` is `1`. The verb `rational` gives a claim for more of these nodes.

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

## Rational functions

The verb `rational` gives the normal form of a quotient of two polynomials. `rationalForm` gives the form, and `simplifyRational` gives a document of the form.

```ts
import { rationalForm, simplifyRational } from "@algebra/polynomial";

const x = { type: "var", value: "x" } as const;
const doc = { type: "div", value: [x, x] } as const;
rationalForm(doc); // ok: the kind rational, the key "1", the domain key "x", the error 0
simplifyRational(doc); // ok: a document of 1 + 0 / x
```

The form has three polynomials, and `functions` has the operations on them.

| Field | Claim |
| --- | --- |
| `numerator` | The numerator has no common factor with the denominator, other than a constant. |
| `denominator` | The denominator has the leading coefficient 1. |
| `domain` | The real zeros of this polynomial are exactly the points where the document has no value. It has the leading coefficient 1 and no repeated factor. |

The stated answer for a zero denominator is the field `domain`. A cancelled factor stays there. Thus the form of `x / x` is `1` with the domain `x`. It has no value at 0, as the verb `exact` tells.

- `rationalForm` gives the kind `rational`, `no value` or `no claim`, with the errors `0`, `0` and `Infinity`.
- The kind `no value` means that the document has no real value at any point, for example `x / (x - x)`.
- Two documents have an equal `key` exactly when they are equal as rational functions.
- Two documents with an equal `key` and an equal `domainKey` are the same partial function.
- Two different domain keys can have the same real zeros, for example `x^2 + 1` and `1`. The domain is exact, but it is not canonical over the real numbers.
- `simplifyRational` keeps a cancelled factor as a term with the literal 0, so the document keeps its points with no value.

The verb `rational` gives no claim for these nodes:

- A root of a radicand that is not a constant.
- A `min`, a `max` or a comparison of two parts that differ by more than a constant.
- A node past a limit, or a node with a part that gives no claim.

`gcd` is the subresultant algorithm of Brown and Traub, over a main variable. `gcd(0, 0)` is 0. Each other gcd has integer coefficients with a gcd of 1, and a positive lead. `divide` gives an exact quotient, or `undefined` when the divisor does not divide. `radical` removes each repeated factor, and `squareFree` gives the factors of each multiplicity by the algorithm of Yun.

`functions.differentiate` gives the partial derivative of a rational function in lowest terms. The derivative keeps the domain of the function.

## The solution of equations

`solveEquation` solves one document in one variable. An `eq` document asks for equal parts. Each other expression asks for a zero. It gives three kinds of result, and each result states its error.

| Kind | Claim | Error |
| --- | --- | --- |
| `roots` | The list holds each real solution one time, in increasing order. The list can be empty. | The largest width of an interval, or `0` |
| `all` | Each real number is a solution, except the numbers of `excluded`, where the equation has no value. | The largest width of an interval of `excluded`, or `0` |
| `no claim` | The method cannot tell. The field `reason` tells why. | `Infinity` |

A root has one of two kinds. Each root has its multiplicity.

- The kind `exact` holds a rational root, with the error 0.
- The kind `interval` holds an irrational root. The root is the one root in the open interval from `lower` to `upper`, with rational ends. The error is the width, and the default tolerance `TOLERANCE` is `2^-64`.

The proof has three steps.

1. The polynomial is the numerator of the rational form. A square-free decomposition gives the factors of each multiplicity.
2. A chain of Sturm counts the roots of a factor in an interval from a bound of Cauchy. Bisection separates the roots.
3. A rational root is a multiple of `1 / |lead|`. An interval narrower than this value holds at most one candidate, and exact substitution tests that candidate. Thus this step proves that each root of the kind `interval` is irrational.

A zero of `domain` is not a solution. `(x^2 - 1) / (x - 1) = 0` has the one root `-1`.

`solveLinear` solves a list of equations in named variables by the elimination of Gauss and Jordan over the rationals. It gives the kind `unique` with the values, `none`, `family` with one solution and the directions of the null space, or `no claim`. The error of a claim is 0.

## The limits of the method

- A node of `gcd`, of a sum of quotients and of a product of quotients has the limits of the section "The limits". A form past a limit gives no claim, also when a small gcd exists.
- The gcd has no modular method. A step of the sequence can hold `STEP_BITS` times `maxBits` bits, and the sequence can be long for dense polynomials in many variables.
- A solution has the limits `SOLVE_LIMITS`: the degree 256, and `2^24` products of two integers for one solution. The count of products does not count bits, so the time of one product grows with the coefficients.
- A solution past a limit gives no claim, and no part of the list of roots.
- A solution gives only real roots. A root of degree 5 or more has an interval, not a closed form.
- An equation with more than one variable gives no claim.
- `solveLinear` takes rational coefficients. A coefficient with a variable, or a domain that is not a constant, gives no claim.
- A literal is the exact value of its float, so `0.1 * x = 0.3` has the root of those two floats.
- A tolerance must be more than 0.

## The bench

The package `packages/polynomial-bench` and the workflow `bench-polynomial.yml` measure the cost of the forms and of a solution. They give the break-even count of points. They also give the share of the cases with a claim at each tier of limits.
