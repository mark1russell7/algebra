# @algebra/evaluator-bench

This private package is the bench of A6 in `docs/ROADMAP.md`. It measures the cost and the error of each evaluator on the corpus of A12. It also measures the stitched plan of `@algebra/evaluator-select` against each fixed choice.

The prediction `algebra-A6` predicts two results. The stitched plan is faster than the fixed exact choice over all the cases. Each stitched answer meets its question, with 0 failures.

## The arms

- A fixed arm is one stage: `float`, `ball`, `interval` or `exact`. It gives its answer also when the answer does not meet the question.
- The arm `stitched` is the default plan: float, ball, interval and exact. It stops at the first stage that answers.
- Each pair has a fixed arm in arm `a` and the stitched arm in arm `b`. The A/A pair has the stitched arm in its two arms. It gives the noise of the machine.
- A timed use of a case answers one question at each of its 64 points. The geometric families ask for the sign. The other families ask for a value within the relative tolerance `1e-12`.

## The error records

Before the timed processes, the bench answers four questions at each point of each case with each arm. The questions are the sign, the absolute tolerance `1e-9`, and the relative tolerances `1e-12` and `0`. Each record keeps the stage of the answer, its error bound, its real error against `compileExact`, and if it contains the exact value. The records keep the losers too.

## The method

The method is the method of `@mark1russell7/rigor-bench`, and of `packages/expression-bench`:

- Each case and each pair has a fresh process (`src/child.ts`).
- Each arm gets its own instance of the module of the arms.
- `timeRounds` times the rounds. It warms the two arms for one second.
- `timeVerdict` with the rule `difference` gives the verdict of each pair, for all the cases and for the cases of each family.
- The cost of a stage is the median time of one call of its fixed arm, for one node and one point, in nanoseconds.
- The share of a stage is the part of the error records of its fixed arm that meet each question.
- The cost model of the run is the costs and the shares. The report gives the plan that `select` gives for each question from it.

## Start it

The bench operates in CI, not on the local machine. Start the workflow `bench-select.yml`:

```sh
node ~/git/fleet/scripts/fleet.mjs dispatch mark1russell7/algebra bench-select.yml "<reason>" --ref main --role algebra --heavy
```

The artifact `a6-bench` has `records-<pair>.jsonl` for each pair, `errors.jsonl`, `model.json`, `meta.jsonl`, `machine.txt`, `report.json` and `report.md`. The workflow keeps it for 90 days.

To examine only the format of the records, start a small run: `node src/bench.ts --out <folder> --rounds 2 --ms 1 --cases well/s1,small/s2`.
