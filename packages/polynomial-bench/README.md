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

## The read plan

This plan tells which rows of a run decide A8. It comes before the first run, so the result does not set the rule.

1. Read the field `wrong`. Each check that disagrees is a bug. If `wrong` is more than 0, A8 stays open until a fix and a new start of the workflow.
2. Read the field `skipped`. The roadmap names each family with a skipped case as a limit of the verbs at the default limits.
3. Read the outcome of each pair and each family. An outcome of `cannot decide` gives no claim.
4. Read the field `points` of each row of `breakEven`. The roadmap states the break-even count of points for each family.
5. If a family has the value `null`, the form does not pay for evaluation in that family. The roadmap then states that the verb is for equality and simplification there.
6. Read the pair `equal`. If the compare of the keys is `faster`, the roadmap states that a proof of equality by the key costs less than 64 points.
7. Read the pair `solve`. Its median ratio is the cost of 48 more bits of each interval. The roadmap states it.

After these steps, the raw records go to `results/<date>/`, and A8 closes.

## The results

`results/2026-11-09/` keeps the records of the first start, run 42677775596 on `5b063d8`, on an AMD EPYC 9V74. The folder has the raw records, the claim records and the report.

| Pair | Verdict | Median ratio |
| --- | --- | --- |
| `verbs` | slower | 2.370 |
| `points-1` | slower | 2.466 |
| `points-64` | slower | 1.833 |
| `equal` | faster | 0.1402 |
| `solve` | slower | 1.197 |

The read plan gives these results:

1. The field `wrong` is 0 of 9602 checks.
2. The field `skipped` names one case, `sum-v1-d3-t3/s1`. Its document has no value at any point, so it is not a limit of the verbs.
3. Five cells are `cannot decide`. The warning of the check names them. They give no claim.
4. The medians give a break-even count of points in 5 of 14 families: `ill` 22, `expand-v2-d4-t4` 36, `quotient-v1-d4-t3` 22, `quotient-v2-d3-t4` 56 and `quotient-v3-d3-t6` 387.
5. The other 9 families have no crossing. There, the verb is for equality and simplification.
6. The compare of the keys is faster. A proof of equality by the key costs 0.14 of a compare at 64 points.
7. 48 more bits of each interval of `solve` cost 1.20 times the time.

At 64 points, only `quotient-v1-d4-t3` is faster with the form (0.71). The families `ill`, `expand-v2-d4-t4` and `quotient-v2-d3-t4` are `cannot decide` there. So their gain at 64 points is in the noise. The count 387 is past the 64 points that the bench measures.

The tier `products/256` of `solve` gives no claim for 8 of 8 cases of `mixed-roots-d24` and 7 of 8 cases of `dense-roots-d64`. The default limits give the roots of each case.

## A run

```sh
gh workflow run bench-polynomial.yml -R mark1russell7/algebra --ref main
```
