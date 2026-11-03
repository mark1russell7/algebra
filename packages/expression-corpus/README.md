# @algebra/expression-corpus

This private package is the corpus of A12 in `docs/ROADMAP.md`. It gives seeded cases: each case is an expression document and a batch of points. The benches and the property tests of the evaluators use it.

## The families

| Family | The documents | The points |
| --- | --- | --- |
| `small` | Random documents of the A1 generator with each kind, with 30 nodes or fewer | Each variable in `[-4, 4)` |
| `large` | Random documents of the A1 generator with 200 to 2000 nodes | Each variable in `[-4, 4)` |
| `well` | Polynomials in Horner form, of degree 4 to 16, with coefficients in `[0.5, 2)` | `x` in `[0, 2)` |
| `ill` | The expanded form of `(x - r)^n`, with `n` from 4 to 9 | `x = r (1 ± 2^-k)`, with `k` from 8 to 30 |
| `orient-random` | The orientation determinant | The random inputs of `@mark1russell7/predicates` |
| `orient-near` | The orientation determinant | The near-degenerate inputs of `@mark1russell7/predicates` |
| `incircle-random` | The in-circle determinant | The random inputs of `@mark1russell7/predicates` |
| `incircle-near` | The in-circle determinant | The near-degenerate inputs of `@mark1russell7/predicates` |

The random documents use no near-degenerate constants. The near-degenerate cases are the families `ill`, `orient-near` and `incircle-near`.

## Use it

```ts
import { compileFloat } from "@mark1russell7/expression";
import { condition, corpus, corpusCase } from "@algebra/expression-corpus";

const cases = corpus();                       // 8 families, 8 seeds, 64 points in each case
const c = corpusCase("ill", 3, { points: 16 });
const f = compileFloat(c.document);           // the variables of f are c.variables
condition(c.document, c.variables, c.points[0]!);
```

- `corpusCase(family, seed)` gives one case. The seed and the name of the family give the random numbers of the case.
- `corpus(seeds)` gives one case for each family and each seed. The default seeds are 1 to 8.
- `@mark1russell7/rigor-generators` gives the random numbers. The geometric points come from `@mark1russell7/predicates/corpus`.

## The condition number

`condition(doc, variables, point)` gives the condition number of a polynomial document at a point. It is the absolute evaluation over the absolute exact value. The absolute evaluation uses the absolute value of each literal and each variable, and it replaces each `sub` by an `add`. `@mark1russell7/rational` computes the two values exactly.

- A condition of 1 tells that the evaluation has no cancellation.
- A large condition tells that the value is a small difference of large terms. Then the relative error of a float value can be large.
- A document with a division, a root, `min` or `max` has no condition in this package. The function gives `undefined`.

The tests examine these limits on the default corpus:

| Family | The limit |
| --- | --- |
| `well` | Each condition is 1. |
| `ill` | Each condition is `1e9` or more. |
| `orient-random`, `incircle-random` | The median condition is `1e3` or less. |
| `orient-near`, `incircle-near` | The median condition is `1e8` or more. |

## The seed

The tests pin an FNV-1a hash of the JSON of the default corpus. Thus each platform gives the same corpus. A change of a family changes the hash. Change the pinned hash only for a change on purpose, and tell the reason in the commit.
