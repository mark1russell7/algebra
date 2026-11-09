# @algebra/bigfloat-bench

This private package is the bench of A7 in `docs/ROADMAP.md`. It measures the cost of the verb `bigfloat` at each precision against the verbs `exact` and `interval`, on the corpus of A12. It also measures the stage `bigfloat` of `@algebra/evaluator-select`, so the selector can get a measured cost.

## The pairs

Each pair has one case in one fresh process, with `timeRounds` of `@mark1russell7/rigor-bench`.

- The pairs `<precision>-exact` and `<precision>-interval` compare the verb `bigfloat` at 64, 128, 256, 512, 1024, 2048 and 4096 bits.
- The pairs `stage-exact` and `stage-interval` compare the stage with a limit of 4096 bits. The question is the question of the family in A6.
- The pair `aa` has the verb `bigfloat` at 256 bits in the two arms. It is the A/A pair of each verdict.

Arm `a` is always the arm with the verb `bigfloat`. A ratio is the time of the baseline over the time of arm `a`. Thus a ratio below 1 tells that the baseline is faster. The reason is the batch: `timeRounds` sets its size from arm `a`, and a slow arm in `b` makes each batch slow.

## The run

The workflow `bench-bigfloat.yml` starts `src/bench.ts` in CI. It starts only on a dispatch, because a run takes hours. The run does the A/A pair first, then the stage, and the highest precisions last. It writes a new report after each pair. Thus a run that stops keeps a report of its finished pairs.

The artifact `a7-bench` has these files:

- `records-<pair>.jsonl`: the raw `PairedTime` records of each pair.
- `meta.jsonl`: the facts of each process.
- `errors.jsonl`: one record of the stage for each case, point and question, the losers too.
- `model.json`: the facts for a cost model: the limit, the cost of the stage, and the share of the points that it answers.
- `report.json` and `report.md`: the verdicts, the cost of each arm, and the answers of the stage.
- `machine.txt`: the facts of the runner.

## The read plan

This plan tells which rows of a run decide A7. It comes before the first run, so the result does not set the rule.

1. Read the field `wrong` of each row of `stage`. Each wrong answer is a bug. If one row has a wrong answer, A7 stays open, and the run gives no cost.
2. Read the outcome of each pair. An outcome of `cannot decide` gives no claim. A pair with fewer than 5 cases gives no verdict.
3. Read the rows `<precision>-exact` and `<precision>-interval` for each family. The lowest precision with the outcome `faster` is the precision where the baseline becomes faster than the verb `bigfloat`. The roadmap states this precision for each family.
4. Read the rows `stage-exact` and `stage-interval`, and the field `model`. Put `model.bigfloat` and `model.shares` into the cost model of A6. Then start `select` for each question of the error records.
5. Find each question where `select` gives a plan with the stage. If `stage-exact` is not `faster` in its families, add the stage to its default plan.
6. If `select` gives no plan with the stage, the stage stays out of `STAGES`. Then A7 closes with the stage as a choice of the caller.

After steps 5 and 6, the raw records go to `results/<date>/`. The site gets a page of the cost at each precision.

## The results

`results/2026-11-09/` keeps the records of the first start, run 42677738090 on `5b063d8`, on an AMD EPYC 7763. It has each file of the artifact, and `errors.jsonl` is compressed with gzip.

The read plan gives these results:

1. The field `wrong` is 0 in each row of `stage`.
2. The 7 pairs `<precision>-exact` of the family `ill` are `cannot decide`. The warning of the check names them. They give no claim.
3. The verb `interval` is faster than the verb `bigfloat` at 64 bits in each family. The verb `exact` is faster at 64 bits in the families `small`, `large`, `orient-random`, `orient-near` and `incircle-random`.
4. The verb `exact` is not faster at any precision in the families `well` and `incircle-near`. In `well`, the verb `bigfloat` is faster (2.32 to 3.06).
5. The cost of one node and one point: `interval` 84.76 ns, `exact` 792.8 ns, the verb `bigfloat` 1769 to 1929 ns, and the stage 2460 ns.
6. With the cost of the stage and its shares, `select` gives no plan with the stage for the 5 questions of the run. So the stage stays out of `STAGES`, and it is a choice of the caller.

| Question | Answered by the stage | Plan of `select` |
| --- | --- | --- |
| `sign` | 4096 of 4096 | `float`, `interval`, `exact` |
| `abs 1e-9` | 4096 of 4096 | `float`, `interval`, `exact` |
| `rel 1e-12` | 4096 of 4096 | `float`, `interval`, `exact` |
| `rel 0` | 3884 of 4096 | `interval`, `exact` |
| `rel 1e-30` | 4096 of 4096 | `exact` |

The plans come from the costs and the shares of `packages/evaluator-bench/results/2026-11-03/model.json`, with the cost and the shares of the stage of this run. The two runs measure `interval` and `exact` at almost the same cost.

### Two findings

- At 103 of the 4096 points of each question, in the families `small` and `large`, `exact` gives no claim. The stage answers each of these points for `sign`, `abs 1e-9` and `rel 1e-12`, and 19 of them for `rel 0`. The bench has no exact value to check these answers. A plan of `select` always ends with `exact`, so no plan gets these answers.
- For `rel 1e-30`, `select` takes only the rows of the largest bound that is not more than the tolerance. Only the stage has a row at 1e-30, so the other stages get the share 0. The plan is then `exact` alone, with the expected cost 858.9. The rows of A6 alone give `interval`, then `exact`, with the expected cost 750.5.

## The limits of the method

- The cost of the stage holds only for the limit and the questions of the run.
- A cost of the stage does not separate its tries. The error records give the precision of each answer.
- On a pair with a very slow arm `a`, one batch has few uses. Then arm `b` has a short batch with more noise from the clock. The verdict of such a case has less weight than its ratio suggests.
- The verb `exact` can be slower than arm `a` on a deep case. Then each batch takes longer, so the run time is only an estimate.
- The two arms have one instance each of the module of the arms, but they share `@mark1russell7/expression` and `@algebra/bigfloat`.
