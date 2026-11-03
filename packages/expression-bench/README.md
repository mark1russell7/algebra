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

## Start it

The bench operates in CI, not on the local machine. Start the workflow `bench-expression.yml`:

```sh
node ~/git/fleet/scripts/fleet.mjs dispatch mark1russell7/algebra bench-expression.yml "<reason>" --ref main --role algebra --heavy
```

The artifact `a12-bench` has `records-ab.jsonl`, `records-aa.jsonl`, `meta.jsonl`, `written.mjs`, `machine.txt`, `report.json` and `report.md`. The workflow keeps it for 90 days.

To examine only the format of the records, start a small run: `node src/bench.ts --out <folder> --rounds 3 --ms 1 --cases <2 names>`.
