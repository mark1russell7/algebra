# @mark1russell7/predicate-census

This package is the census of roadmap item A13, the base of A5. Packing and highways have no proved float failure of their geometric predicates. The census measures that base on their real inputs.

For each case and each function, the census counts these values:

- `total`: the inputs. A line with the field `n` counts as `n` inputs.
- `undecided`: the inputs with a sign that the A1 bound cannot fix. Such a bound is not entirely positive, not entirely negative and not exactly `[0, 0]`.
- `undecidedFiltered`: the undecided inputs with the structural filter. The filter gives the sign 0 to an orientation with two equal points.
- `floatWrong`: the inputs whose float answer is not the exact answer. The exact answer comes from dyadic numbers over `bigint`.
- `floatWrongNearCollinear`: the float-wrong segment pairs with an end point near the line of the other segment.
- `unseen`: the near tests of a truncated case that have no line.

The report keeps a raw record of each undecided or wrong input. The record has the input, the bound and the exact sign of each sign that the rule asked, and the float answer. The exact value of each sign must be inside its bound. The census counts each break of this rule in `boundViolations`.

## The rules and their signs

Each predicate is a rule that asks the signs of expressions. The census applies the rule with the exact signs, with the bound signs and with the filtered signs. An input is undecided when the rule asks a sign that the bound does not fix.

- A segment pair follows `geom.segmentsCross` of highways. The rule asks `orient(a,b,c)`, `orient(a,b,d)`, `orient(c,d,a)` and `orient(c,d,b)`.
- A segment-box test follows `geom.segmentHitsRect` of highways. This rule clips the segment to the box (Liang-Barsky). The clipped part must be longer than `eps`.
- A point-side test gives the sign of `orient(a,b,p)`.
- A near tie of a nearest-centre test follows `nearestCentre` of highways. The rule asks the sign of the difference of the two squared distances. An exact tie goes to the lower index.
- A box pair overlaps when the margin minus `eps` is larger than zero on each axis.

The segment-box rule has no division. The sign of `dx` or `dy` and the sign of `diff(i,j)` compare two values of the clip parameter `t`. The sign of `len(i,j)` compares the squared length of the clipped part with `eps^2`. Without `eps`, `eps` is zero.

## The input lines

Each `.jsonl` file has one JSON object on each line. The shape of the line selects the predicate. The field `fn` names the group.

| Shape | Predicate |
| --- | --- |
| `a`, `b`, `c`, `d` as `[x, y]`, and an optional `sharedEnd` | A segment pair. |
| `a`, `b` as `[x, y]`, `box` as `{x, y, w, h}`, and an optional `eps` | A segment-box test. The far corner is `x + w`, `y + h`, as an exact sum. |
| `a`, `b` as `[x, y]`, `rect` as `[x0, y0, x1, y1]`, and an optional `eps` | A segment-box test with the given corners. |
| `p`, `a`, `b` as `[x, y]` | A point-side test. Its `floatAnswer` is `-1`, `0`, `1` or a truth value. |
| `p`, `c1`, `c2` as `[x, y]`, and the indices `i1`, `i2` | A near tie of a nearest-centre test. Its `floatAnswer` is `i1` or `i2`. |
| `a`, `b` as `{x, y, w, h}`, and an optional `eps` | A box pair. |
| `case` and a total field | A count line. |

Each line has a field `case` and an optional `floatAnswer`. A line without `floatAnswer` gets the float answer of the census, from the same rule with plain float values. The census does not compare a truth value with the sign of a point-side test. It counts such an input in `floatUncompared`.

A segment pair with `"sharedEnd": true` has an end point that is equal in both segments. The census keeps these inputs in their own groups. The report gives their counts with and without the structural filter.

## The count lines

A count line gives the counts of one case. Each total counts all tests of its kind, the near tests too. The near field counts the near tests, and the sender writes a line for each of them.

| Kind | Total | Near |
| --- | --- | --- |
| Segment pairs | `totalSegmentPairs` | `nearSegmentPairs`, and `nearSharedEnd` for the shared ends |
| Segment-box tests | `totalBoxTests` | `nearBoxTests` |
| Box pairs | `totalPairs` | `nearPairs` |
| Point-side tests | `totalPointSideTests` | `nearPointSideTests` |
| Nearest-centre tests | `totalNearestTests` | `nearNearestTests` |

The far tests are `total - near`. Without a near field, `near` is the weight of the lines. The maps `tests` and `near` give the same counts for each function.

A truncated case has a count line with `"truncated": true`. Its unseen tests are `near - seen`, where `seen` is the weight of the lines. The report puts these tests in `unseen`, not in `decided`. `nearCheck` compares each near field with the weight of the lines. In a case that is not truncated, the two values must be equal.

## The packing form

The command `predicates` of packing writes this form. The section "A predicate dump" of `docs/BENCH.md` of packing tells it. A near line of packing has the fields `times` and `near`. The census reads `times` as the weight `n`.

| `fn` | Inputs | Predicate |
| --- | --- | --- |
| `overlap` | `a`, `b` as `{l, t, r, b}`, `tolerance`, and an optional `gap` | `boxPair`: the margin `min(r) - max(l)` of each axis must be larger than `tolerance`. |
| `container` | `box` as `{l, t, r, b}`, `x`, `y`, `w`, `h`, `inset`, `tolerance`, `fixedW`, `fixedH` | `container`: the box goes out of a fixed side by more than `tolerance`. |
| `edgeRange` | `ax`, `ay`, `bx`, `by`, `y0`, `y1` | `strip`: the segment has a part in the open strip from `y0` to `y1`. |
| `xAt`, `samePlacements` | | No rule. These lines are `unknown`, with the reason of `PACKING_UNMODELED`. |

The census reads each box as packing gives it, because a width `r - l` is a rounded value. The box `a` of a pair with `gap` already has the gap on each side.

Packing computes the margin as a float difference, and then compares it with `tolerance`. The sign of a float difference is exact. Thus the float sign of `fl(margin) - tolerance` is the answer of packing. The exact answer compares the exact margin with the float `tolerance`. The container test is the same: the float sign of `edge - side` has the float sums of the side, in the order of packing.

The rule of `overlap` asks the margin of `y` only when the margin of `x` is larger than `tolerance`, as the `&&` of packing does. The container test asks only the fixed sides. A fixed side with the size `null` is an infinite size, so that line is `unknown`.

After the near lines of a case, one case line gives `totals`, `near`, `touch` and `lines` for each function. A touch input has only values of exactly 0 near. Its float sign is exact, so it has no line. For each function, the far inputs are `total - near - touch`. The census counts the touch inputs and the far inputs as decided and not float-wrong. The report gives the touch inputs in `touch`.

`nearCheck` compares `near` of each function with the weight of its lines, and `lines` with the count of the lines. `nearReasons` gives the weight of the lines of each function and each near reason, for example `x:zero` or `y:tolerance`.

## The classes of a float-wrong test

The report gives each float-wrong test a class in `floatWrongClasses`. The field `floatWrongSites` gives the weight of each class, function and call site.

| Class | The test | The meaning |
| --- | --- | --- |
| 1 | A float sign differs from an exact sign that the bound fixes. | A value other than 0 is a defect of the bound. |
| 2 | A sign is near zero. | Rounding decides the answer of a tie. |
| 3 | A class 2 segment pair in a crossing measure of the bench. | The rule of the measure decides a touch. |
| 4 | Each sign is clear and correct, but the answer of the sender differs. | The rule of the sender differs from the rule of the census. |

The count of class 1 is not a test of the senders, because a correct bound gives 0. Read class 4 for a difference of the rules. The field `classInputs` keeps the first inputs of the classes 1 and 4.

## The far assumption

The census counts the far tests as decided. It does not see them. The report examines this assumption in `farCheck`. A case passes when the largest bound width of its seen inputs is less than `1e-9`, the filter of the senders.

## The command

```sh
pnpm --filter @mark1russell7/predicate-census census corpus/highways --out report.json
```

The command reads each `.jsonl` file of the given files and folders. It writes the report as JSON to the standard output, or to the file of `--out`. The report has the commit of algebra and the `sha256` hash of each input file. `byPredicate` and `byFn` give the counts over all cases.

With `--out report.json`, the command writes each record as one line of `report.records.jsonl` and each unknown line to `report.unknown.jsonl`. Then `report.json` has only the counts. The command reads each input file in chunks, so a dump of several GB is not a problem.

## The corpus

- `corpus/synthetic`: near-degenerate inputs with known answers. Each line has an `id` and its expected result in `expect`. The tests examine the census on these lines.
- `corpus/highways` and `corpus/packing`: the real inputs. The sessions of highways and packing send them.
- `corpus/packing/smoke-v1-sample.jsonl`: five complete cases of the smoke-v1 dump of packing at the commit `d718b54`. The tests examine the counts and the exact answers of these lines.

## The results

`results/2026-11-05-highways/` keeps census run 41943849500 of the highways dump run 41647717024, at `b7196ba`. It keeps the report, the time log and the float-wrong records of each set. The complete records are too large for the repository. They stay in the artifact of the run for 90 days.

| Set | Tests | Undecided | Float-wrong | Class 1 | Class 2 | Class 3 | Class 4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `exact-v1` | 206,265,687 | 315,842 | 8 | 0 | 0 | 3 | 5 |
| `exact-v1-bounds` | 2,597,972,328 | 3,303,590 | 121 | 0 | 2 | 59 | 60 |
| `fixtures` | 156,763,576,730 | 4,338,238 | 94 | 0 | 0 | 12 | 82 |
| `fixtures-large` | 3,234,175,115 | 33,781 | 104 | 0 | 2 | 0 | 102 |
| `screen-v1` | 1,539,279,577 | 1,371,492 | 602 | 0 | 226 | 354 | 22 |
| `screen-v2` | 6,573,015,403 | 4,977,287 | 13,749 | 0 | 13,202 | 468 | 79 |
| `screen-v3` | 12,317,181,901 | 10,032,303 | 21,187 | 0 | 20,383 | 639 | 165 |
| All | 183,231,466,741 | 24,372,533 | 35,865 | 0 | 33,815 | 1,535 | 515 |

The classes:

- Class 1 is a float sign that differs from an exact sign that the bound fixes. Each set has 0.
- Class 2 has a sign near zero, so rounding decides the answer. The site `physics.outOf` has 31,253 of these tests, in `screen-v2` and `screen-v3` only. So the share of class 2 is not the same in each set: `fixtures` has 0 of 94.
- Class 3 is a class 2 segment pair in a crossing measure of the bench.
- Class 4 has clear signs and correct float signs, but the answer of the sender differs from the rule. Each of its 315 records is an exact tie. The part in the box has a length of exactly `eps`, and rounding of `(t1 - t0) * len` makes it larger. A test examines this claim on the kept records.

The sums count a board again if two sets have it. The report has `dirty: true` because the workflow put the tree of highways in the work folder. The workflow excludes that tree at this time.

The census prints a warning for the copies of the rules of `physics.outOf` and `mesh.crossing`. These copies are out of date, but `copyUses` is empty in each report, because each line of this dump has its own rule.

`results/2026-11-04-packing/` keeps census run 41897600161 of the packing dump run 41716950631: 19,752,878,890 tests, with 0 undecided and 0 float-wrong.

## The tests

`pnpm --filter @mark1russell7/predicate-census test` starts the tests. The property tests use 1000 cases. Set `PROPERTY_RUNS` to change the count.
