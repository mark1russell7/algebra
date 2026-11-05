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

## The limits of the method

- The cost of the stage holds only for the limit and the questions of the run.
- A cost of the stage does not separate its tries. The error records give the precision of each answer.
- On a pair with a very slow arm `a`, one batch has few uses. Then arm `b` has a short batch with more noise from the clock. The verdict of such a case has less weight than its ratio suggests.
- The verb `exact` can be slower than arm `a` on a deep case. Then each batch takes longer, so the run time is only an estimate.
- The two arms have one instance each of the module of the arms, but they share `@mark1russell7/expression` and `@algebra/bigfloat`.
