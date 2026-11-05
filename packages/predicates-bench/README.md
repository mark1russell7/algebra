# @algebra/predicates-bench

This private package is the bench of the time claim of A5 in `docs/ROADMAP.md`. It times the predicates of `@mark1russell7/predicates` against `robust-predicates`.

The prediction `algebra-A5` has two time claims:

- On random inputs, the float filter answers each call. The time verdict of the group `random` is `same`.
- On near-degenerate inputs, the exact dyadic stage answers many calls. The time verdict of the group `near` is `slower`.

## The arms

- Arm `a` is the base: `robust-predicates` 3, the adaptive predicates of Shewchuk.
- Arm `b` is the candidate: `orient2dSign` and `incircleSign` of `@mark1russell7/predicates`. These forms make no object.
- The A/A pair has `robust-predicates` in its two arms. It gives the noise of the machine.
- The sign of `orient2d` of `robust-predicates` is the negative one. `src/arms.ts` changes it, so the two arms give one sign.

## The cases

`src/cases.ts` has 48 cases, 16 in each group. Each case is one batch of 1000 seeded inputs of one predicate and one family of the corpus of `@mark1russell7/predicates`.

| Group | The inputs |
| --- | --- |
| `random` | Random points in a square of the side 1, 2^10 or 2^20 |
| `near` | Points at a few ulps from a line or from a circle |
| `ties` | Repeated points, points on an axis line and exact collinear or cocircular points |

The prediction scores only `random` and `near`. The group `ties` is an extra measure. A test examines that each case gives the same sum of signs in the two arms.

## The method

The method is the method of `@mark1russell7/rigor-bench`, and of the A2 bench in `packages/rational-bench`:

- Each case and each pair has a fresh process (`src/child.ts`).
- Each arm gets its own instance of the module of the cases, so the arms do not share the type feedback of the engine.
- `timeRounds` of `@mark1russell7/rigor-bench` times the rounds. It warms the two arms for one second.
- Then a batch of calls of arm `a` takes at least the target time, 10 ms by default.
- Each round times one batch of each arm. `firstArm` turns the order each round.
- The records are `PairedTime` records. `caseRatios`, `aaBand` and `timeVerdict` give the ratios, the band and the verdict of each group.
- `src/bench.ts` starts a fresh process for each case. rigor has no runner of processes yet, so this runner stays here.

## Start it

The bench operates in CI, not on the local machine. Start the workflow `bench-predicates.yml`:

```sh
gh workflow run bench-predicates.yml -R mark1russell7/algebra --ref main
```

The artifact `a5-bench` has `records-ab.jsonl`, `records-aa.jsonl`, `meta.jsonl`, `machine.txt`, `report.json` and `report.md`. The workflow keeps it for 90 days.

To examine only the format of the records, start a small run: `node src/bench.ts --out <folder> --rounds 3 --ms 1 --cases <2 names>`.

## The results

`results/2026-11-03/` keeps the base, run 41654612772 on `7a14a68`. `results/2026-11-04/` keeps run 41896000324, after the adaptive stage of #74. Each folder has the raw records. An interval is the candidate median over the A/A median. A value under 1 means that `@mark1russell7/predicates` is faster.

| Group | Base | 2026-11-04 | Verdict of 2026-11-04 |
| --- | --- | --- | --- |
| `random` | [1.389, 6.412] | [1.142, 4.023] | Slower |
| `near` | [1.595, 21.941] | [0.931, 1.229] | Cannot decide |
| `ties` | [4.779, 9.618] | [0.577, 0.710] | Faster |

The interval of `random` is wide because the group has two predicates. Each case of `orient2d` has a ratio from 1.10 to 1.18, and each case of `incircle` has a ratio from 3.86 to 4.13.

### The test of the change to the in-circle filter

One product of the in-circle filter had a subnormal result at each call, and such a product is slow on some processors. Commit `35a7968` removes that product. These three folders test the change:

| Folder | Run | Commit | Processor |
| --- | --- | --- | --- |
| `results/2026-11-05-before-9v45/` | 41950165798 | `e2edff9`, before the change | AMD EPYC 9V45 |
| `results/2026-11-05-after-9v45/` | 41950209701 | `9150080`, after the change | AMD EPYC 9V45 |
| `results/2026-11-05-after-7763/` | 41949248942 | After the change | AMD EPYC 7763 |

Only the first two folders compare the same processor. Each value of this table is the median ratio of the eight cases of a predicate and a group.

| Cases | Before, 9V45 | After, 9V45 | After, 7763 |
| --- | --- | --- | --- |
| `incircle/random` | 4.224 | 0.911 | 0.810 |
| `incircle/near` | 0.819 | 0.790 | 0.940 |
| `incircle/ties` | 0.655 | 0.541 | 0.523 |
| `orient2d/random` | 1.191 | 1.187 | 1.103 |
| `orient2d/near` | 1.215 | 1.234 | 1.109 |
| `orient2d/ties` | 0.657 | 0.656 | 0.685 |

| Group | Before, 9V45 | After, 9V45 | After, 7763 |
| --- | --- | --- | --- |
| `random` | [1.193, 4.190], slower | [0.911, 1.187], cannot decide | [0.810, 1.102], cannot decide |
| `near` | [0.820, 1.212], cannot decide | [0.791, 1.231], cannot decide | [0.942, 1.108], cannot decide |
| `ties` | [0.634, 0.680], faster | [0.545, 0.655], faster | [0.523, 0.677], faster |

The change makes `incircle` on random points faster than `robust-predicates` on both processors. The group `random` has no decision, because its two predicates are on the two sides of 1. `orient2d` on random points stays slower, from 1.10 to 1.19 times.

An open result: in the run before the change, `orient2d/random/s6` and `orient2d/random/s8` have ratios of 2.91 and 2.80 in each round. The time of `@mark1russell7/predicates` is 40.6 ms and 36.1 ms, against 15.7 ms in `orient2d/random/s5`. The change does not touch `orient2d`. The other 38 `orient2d/random` cases of the five kept runs have no such ratio. So a process can stay in a slow state from its start. The cause is not known.
