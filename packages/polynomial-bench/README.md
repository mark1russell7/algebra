# @algebra/polynomial-bench

This private package is the bench of A8 in `docs/ROADMAP.md`. It measures the normal forms and the solutions of `@algebra/polynomial` against the verb `exact`.

The workflow `bench-polynomial.yml` starts the bench in CI. Do not start a full run locally. The workflow keeps the raw records 90 days.

## The cases

- The polynomial families of the corpus of A12, with 8 seeds each.
- The families `expand`, `quotient` and `sum`, with a stated count of variables, degree and terms. A family `quotient` has a planted common factor.
- The families `rational-roots`, `mixed-roots` and `dense-roots`, with a stated degree up to 64.

## The pairs

A use of an arm starts from the document. A ratio is the time of arm `b` over the time of arm `a`.

| Pair | Arm `a` | Arm `b` | Question |
| --- | --- | --- | --- |
| `verbs` | `normalForm` | `rationalForm` | The cost of the gcd and the domain on a document with no quotient. |
| `points-1` | `compileExact` and 1 evaluation | `rationalForm` and 1 evaluation | The cost at 1 point. |
| `points-64` | `compileExact` and 64 evaluations | `rationalForm` and 64 evaluations | The cost at 64 points. |
| `equal` | A compare of two documents at 64 points | A compare of the two keys | The cost of a proof of equality. |
| `solve` | `solveEquation` to `2^-16` | `solveEquation` to `2^-64` | The cost of 48 more bits of each interval. |
| `aa` | The longest arm of the family | The same arm | The noise of the machine. |

The times at 1 point and at 64 points give a straight line for each arm. The two lines give the break-even count of points of each family.

## The claim records

Before the timed processes, the bench writes one record for each case, verb and tier of limits to `claims.jsonl`. A record keeps the kind, the terms, the degree, the count of roots and the time of one call. The records keep the losers too.

The bench examines each claim. It compares a form with `compileExact` at 8 points, and it examines each root by exact substitution. The report gives the count of checks that disagree. Each one is a bug.

The tiers are `products/256`, `products/16`, `bits/8` and `default`. The bench does not count products, so a tier is a limit that a case meets or does not meet.

A case with no form or no roots at the default limits gets no timed pair. The report names it.

## The method

The method is the method of `@mark1russell7/rigor-bench` and of `packages/evaluator-bench`:

- Each case and each pair has a fresh process (`src/child.ts`).
- Each arm gets its own instance of the module of the arms.
- `timeRounds` times the rounds. It warms the two arms for one second.
- `timeVerdict` gives the verdict of each pair, for all its cases and for the cases of each family.

The time of a claim record is one sample. It is a fact of the record, not a verdict.

## A run

```sh
gh workflow run bench-polynomial.yml -R mark1russell7/algebra --ref main
```
