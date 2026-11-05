# @algebra/expression-bench

This private package is the bench of the time claim of A3 in `docs/ROADMAP.md`. The claim: on the corpus of A12, `compileFloat` takes at most 1.5 times the time of a written JavaScript function.

The prediction `algebra-A12` predicts that the claim fails. `compileFloat` also computes the bound of its error at each node, and it starts one closure for each node.

## The arms

- Arm `a` is the base: the written function of each document. `src/source.ts` writes its source. It has one `const` for each node, and it gives the float value only.
- The written function does the float operations of the verb `float` in the same order. Thus the two arms give the same value at each point.
- Arm `b` is the candidate: `compileFloat` of `@mark1russell7/expression`. The arm uses the value of each result.
- The A/A pair has the written function in its two arms. It gives the noise of the machine.
- The bench writes the written functions to `written.mjs` before the run, and each process imports that file. No part of the bench uses `eval` or `new Function`.

## The cases

The cases are the 64 cases of the default corpus of `@algebra/expression-corpus`: 8 families, 8 seeds. Each case is one document and its 64 points. A use of a case gives the sum of the values at its points.

## The method

The method is the method of `@mark1russell7/rigor-bench`, and of the A5 bench in `packages/predicates-bench`:

- Each case and each pair has a fresh process (`src/child.ts`).
- Each arm gets its own instance of the module of the written functions and of the module of the cases.
- Before the timed rounds, each process examines that the two arms give the same value at each point.
- `timeRounds` times the rounds. It warms the two arms for one second.
- Then a batch of calls of arm `a` takes at least the target time, 10 ms by default.
- `limitVerdict` with the limit 1.5 gives the verdict of all the cases, and of the cases of each family.

## The pairs

A ratio is the time of arm `b` over the time of arm `a`. `PAIRS` of `src/cases.ts` names the pairs:

| Pair | Arm `a` | Arm `b` |
| --- | --- | --- |
| `ab` | The written function | `compileFloat` |
| `at` | The written function | `compileTape` |
| `ft` | `compileClosures` | `compileTape` |
| `wf` | The written function with a bound | `compileFloat` |
| `wt` | The written function with a bound | `compileTape` |

`compileFloat` chooses the closures or the tape by the size of the document. The pairs `ab` and `wf` time that choice. The pair `ft` times the two forms by name, and each of its processes also records the median time of a compile of each form.

The pair `aa` has one written function in the two arms. It gives the A/A band, and it always operates. The written function gives no bound, but `compileFloat` and `compileTape` compute one. The written function with a bound does the same work, so its pairs compare the same result. The default is `ft,wt`. Run 41716693461 took 113 minutes for one pair and `aa`. Thus a run of two pairs and `aa` takes approximately 170 minutes.

## Start it

The bench operates in CI, not on the local machine. Start the workflow `bench-expression.yml`:

```sh
gh workflow run bench-expression.yml -R mark1russell7/algebra --ref main
```

The artifact `a12-bench` has `records-<pair>.jsonl`, `meta.jsonl`, `written.mjs`, `machine.txt`, `report.json` and `report.md`. The workflow keeps it for 90 days.

## The kept run

The folder `results/2026-11-03/` keeps run 41716693461, without `written.mjs`, because the artifact ends after 90 days. The bench writes that file again from the corpus.

The time claim of A3 fails. The time of `compileFloat` over the time of the written function has a median of 65.6, and the claim is 1.5. Each of the 64 cases is above the limit. The median of a family goes from 16.5 for `small` to 1306 for `large`. The A/A band is [0.996, 1.004].

The folder `results/2026-11-04/` keeps run 41895886738, the pairs `ft` and `wt`, also without `written.mjs`. This run used an AMD EPYC machine, and the run of 2026-11-03 used an Intel machine.

The tape is faster than the closures of `compileFloat`: the median ratio is 0.765 over the 64 cases. The ratio depends on the size of the document:

| Nodes | Cases | Median ratio |
| --- | --- | --- |
| 1 to 7 | 7 | 2.104, from 0.997 to 4.731 |
| 8 to 14 | 0 | The corpus has no case of this size. |
| 15 to 53 | 33 | 0.766, with one case at 1.267 (`orient-near/s3`) |
| 119 | 16 | 0.365 |
| 320 or more | 8 | 0.844 |

The closures keep their advantage only on the smallest documents. The tape does not meet the claim of A3 alone. The time of the tape over the written function with a bound has a median of 3.882. In that pair, 21 of 64 cases are above the limit 5. The bound was most of the ratio 65.6, because the written function of that run gave no bound.

The threshold of 7 nodes comes from these records, so these records do not test it. Two more runs test it on new seeds.

The folders `results/2026-11-04-seeds-9-24/` and `results/2026-11-04-seeds-25-72/` keep runs 41912567142 and 41912596070, also without `written.mjs`. The first has each family on an AMD EPYC 9V74. The second has only `small` on an AMD EPYC 7763. Together they give 176 new cases:

| Nodes | Cases | Faster cases | Median ratio |
| --- | --- | --- | --- |
| 1 to 7 | 38 | 2 | 3.278, from 0.912 to 7.074 |
| 8 to 14 | 15 | 7 | 1.024, from 0.778 to 1.344 |
| 15 to 30 | 58 | 57 | 0.779, with one case at 1.122 (`small/s60`, 25 nodes) |
| Above 30 | 65 | 65 | 0.394, from 0.296 to 0.907 |

The two ends agree with the first run. The closures win at 7 nodes or fewer, and the tape wins at 15 nodes or more. From 8 to 14 nodes, the result is a tie, so 7 nodes is not a sharp threshold.

This table compares the rule "the tape above T nodes, and else the closures" on the same 176 cases. A wrong case is a case where the other arm is faster. The geometric mean and the worst ratio compare the chosen arm with the closures.

| T | Wrong cases | Geometric mean | Worst ratio |
| --- | --- | --- | --- |
| 0 | 45 | 0.852 | 7.07 |
| 7 | 11 | 0.702 | 1.34 |
| 10 | 6 | 0.699 | 1.12 |
| 12 | 9 | 0.700 | 1.12 |
| 14 | 10 | 0.701 | 1.12 |
| 16 | 45 | 0.735 | 1.12 |
| 30 | 66 | 0.761 | 1.00 |

These records select T, so they do not test it. The bench also does not measure the cost of a compile. `compileFloat` uses the tape above 10 nodes, and a run on other seeds tests this choice.

The folders `results/2026-11-05-seeds-73-88/` and `results/2026-11-05-seeds-89-136/` keep that test, runs 41948999649 and 41949047378 on `e2edff9`, without `written.mjs`. The first has each family on an AMD EPYC 7763. The second has only `small` on an AMD EPYC 9V74. These 176 cases selected nothing.

| Measure | Limit | All 176 cases | Seeds 73 to 88 | Seeds 89 to 136 |
| --- | --- | --- | --- | --- |
| Wrong cases | At most 10 percent | 7, 3.98 percent | 1 of 128 | 6 of 48, 12.5 percent |
| Geometric mean of the chosen arm over the closures | At most 0.8 | 0.708 | 0.641 | 0.924 |
| Worst ratio above 10 nodes | At most 1.5 | 1.147 | 0.998 | 1.147 |
| Median compile time of the tape over the closures | At most 2 | 1.031 | 1.005 | 1.061 |

Each limit holds on all 176 cases, as the prediction asked. The share of wrong cases in `small` alone is above the limit, because `small` has the sizes near the line. From 8 to 14 nodes, 5 of 18 cases are wrong and the median ratio is near 1, so these choices cost little. A compile time comes from a warm process after the timed rounds, so it is not the cost of a first compile.

| Nodes | Cases | Faster cases | Median ratio |
| --- | --- | --- | --- |
| 1 to 7 | 36 | 2 | 3.335 |
| 8 to 10 | 7 | 2 | 1.069 |
| 11 to 14 | 11 | 8 | 0.993 |
| 15 to 30 | 54 | 54 | 0.802 |
| Above 30 | 68 | 68 | 0.458 |

The inputs `seeds` and `families` of the workflow select the cases, for example `seeds=25-72` and `families=small`. The report groups the pair `ft` by the count of the nodes.

To examine only the format of the records, start a small run: `node src/bench.ts --out <folder> --rounds 3 --ms 1 --cases <2 names>`.
