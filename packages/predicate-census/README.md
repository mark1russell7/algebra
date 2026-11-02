# @mark1russell7/predicate-census

This package is the census of roadmap item A13, the base of A5. Packing and highways have no proved float failure of their geometric predicates. The census measures that base on their real inputs.

For each case and each function, the census counts three values:

- `total`: the inputs. A line with the field `n` counts as `n` inputs.
- `undecided`: the inputs with a sign that the A1 bound cannot fix. Such a bound is not entirely positive, not entirely negative and not exactly `[0, 0]`.
- `floatWrong`: the inputs whose float answer is not the exact answer. The exact answer comes from dyadic numbers over `bigint`.

The report keeps a raw record of each undecided or wrong input. The record has the input, the bound and the exact sign of each sign, and the float answer. The exact value of each sign must be inside its bound. The census counts each break of this rule in `boundViolations`.

## The input lines

Each `.jsonl` file has one JSON object on each line. The shape of the line selects the predicate. The field `fn` names the group.

| Shape | Predicate | Signs |
| --- | --- | --- |
| `a`, `b`, `c`, `d` as `[x, y]` | The proper crossing of the open segments `ab` and `cd`. A shared end, a touch or a collinear overlap is not a crossing. | `orient(a,b,c)`, `orient(a,b,d)`, `orient(c,d,a)`, `orient(c,d,b)` |
| `a`, `b` as `[x, y]`, and `box` as `{x, y, w, h}` | The segment `ab` passes through the open inside of the box. | `w`, `h`, the four separations on the axes `x` and `y`, and the orientation of each corner against `ab` |
| `a`, `b` as `{x, y, w, h}`, and an optional `eps` | The margin on each axis minus `eps` is larger than zero. The margin is `min(ax + aw, bx + bw) - max(ax, bx)`. | `marginX - eps`, `marginY - eps` |
| `case` and `totalSegmentPairs`, `totalBoxTests` or `totalPairs` | A count line. It gives the far inputs that have no line. | None |

Each line has a field `case` and an optional `floatAnswer`. A line without `floatAnswer` gets the float answer of the census, from the same sign rule with plain float values. A corner of a box, for example `x + w`, is an exact sum, not a float sum.

A truncated case has a count line with `"truncated": true`. The fields of that line whose names start with `near` give the near inputs that have no line. The report puts these inputs in `unseen`, not in `decided`. A line that has no known shape goes into a group with the predicate `unknown`.

## The far assumption

The census counts the far inputs of a count line as decided. It does not see them. The report examines this assumption in `farCheck`. A case passes when the largest bound width of its seen inputs is less than `1e-9`, the filter of the senders.

## The command

```sh
pnpm --filter @mark1russell7/predicate-census census corpus/highways --out report.json
```

The command reads each `.jsonl` file of the given files and folders. It writes the report as JSON to the standard output, or to the file of `--out`. The report has the commit of algebra and the `sha256` hash of each input file.

## The corpus

- `corpus/synthetic`: near-degenerate inputs with known answers. Each line has an `id` and its expected result in `expect`. The tests examine the census on these lines.
- `corpus/highways` and `corpus/packing`: the real inputs. The sessions of highways and packing send them.

## The tests

`pnpm --filter @mark1russell7/predicate-census test` starts the tests. The property tests use 1000 cases. Set `PROPERTY_RUNS` to change the count.
