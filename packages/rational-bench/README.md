# @algebra/rational-bench

This private package is the bench of the time claim of A2 in `docs/ROADMAP.md`. The claim: the new rationals of `@mark1russell7/rational` take at most 2 times the time of the old rationals of `@mark1russell7/quantity`, on the tests of quantity.

## The arms

- Arm `a` is the base: the old rationals. `src/old-rational.ts` is a copy of `packages/quantity/src/rational.ts` of `mark1russell7/systems` at the commit `3179488`. Only its comments are new.
- Arm `b` is the candidate: `@mark1russell7/rational` of this repository.
- The A/A pair has the old rationals in its two arms. It gives the noise of the machine.

## The cases

`src/cases.ts` has 32 cases. Each case does the rational steps of one operation of the tests of quantity, with the same inputs. The operations are the conversions, `add`, `sum`, `mean`, `compare`, `toNanoseconds` and `scale`. A test examines that each case gives the value of the test of quantity in each arm.

## The method

The method is the method of `@mark1russell7/rigor-bench`:

- Each case and each pair has a fresh process (`src/child.ts`).
- Each arm gets its own instance of the module of the cases, so the arms do not share the type feedback of the engine.
- `timeRounds` of `@mark1russell7/rigor-bench` times the rounds. It warms the two arms for one second.
- Then a batch of calls of arm `a` takes at least the target time, 10 ms by default.
- Each round times one batch of each arm. `firstArm` turns the order each round.
- The records are `PairedTime` records. `caseRatios`, `aaBand` and `timeVerdict` give the ratios, the band and the verdict.
- `limitVerdict` with the limit 2 gives the outcome of the claim. `caseIntervals` gives the interval of each case.
- The claim holds when, for each case, the high end of the interval times the high end of the A/A band is at most 2.
- `src/bench.ts` starts a fresh process for each case. rigor has no runner of processes yet, so this runner stays here.

## Start it

The bench operates in CI, not on the local machine. Start the workflow `bench.yml`:

```sh
node ~/git/fleet/scripts/fleet.mjs dispatch mark1russell7/algebra bench.yml "<reason>" --ref main --role algebra
```

The artifact `a2-bench` has `records-ab.jsonl`, `records-aa.jsonl`, `meta.jsonl`, `machine.txt`, `report.json` and `report.md`. The workflow keeps it for 90 days.

To examine only the format of the records, start a small run: `node src/bench.ts --out <folder> --rounds 3 --ms 1 --cases <5 names>`.
