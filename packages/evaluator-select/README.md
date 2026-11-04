# @algebra/evaluator-select

This private package is the cost and error model of A6 in `docs/ROADMAP.md`. It asks a question to an expression at a point, and it uses the cheapest evaluator that answers the question.

## The questions

- A value question asks for a float value within a tolerance of the exact value `x`. The tolerance is `{ absolute: a }` or `{ relative: r }`.
- A sign question asks for the sign of `x`. A comparison gives `1` for true and `0` for false, so its sign is its truth value.
- A tolerance of `0` asks for the exact value.

## The stitched evaluator

`stitch(document, question)` compiles the document one time for each stage of a plan. The default plan is `float`, `ball`, `interval` and `exact`. Each call tries the stages in order, and stops at the first stage that answers the question. Thus the exact stage operates only where each float filter before it fails.

```ts
import { stitch } from "@algebra/evaluator-select";

const doc = { type: "add", value: [{ type: "var", value: "x" }, { type: "num", value: 1 }] } as const;
const s = stitch(doc, { kind: "value", tolerance: { relative: 0 } });
s.answer([2]);   // the stage float: the value 3 with the error 0
s.answer([0.1]); // the stage exact: 0.1 + 1 rounds, so only the rational has the error 0
```

Each answer names its stage and states its error:

- `value` and `error`: the float value and the bound of `|value - x|`.
- `low` and `high`: an interval that contains `x`.
- `exact`: the rational, only from the stage `exact`. Its error is zero.
- `met`: `true` when the answer meets the question. When no stage meets it, the answer is the claim with the smallest error.
- The kind `no value` tells that the point has no real value. The kind `no claim` tells nothing.

The stage `exact` answers each value question of a document without roots. A root of a radicand other than `0`, `1` and `-1` gives no exact claim, so a document with roots can stay without an answer.

## The selector

`select(question, model)` gives the plan with the least expected cost for a question. The cost model has the cost of each stage and the share of the points that each stage answers. The model takes the answered points of a stage as a part of the answered points of each later stage. The stage `exact` is always last.

This package has no default cost model. The cost model comes from the records of the bench of A6, on the corpus of A12.

## The stage `bigfloat`

The stage `bigfloat` operates the verb `bigfloat` of `@mark1russell7/expression`, and it doubles the precision until the answer meets the question. It is not in the default plan, because a selector needs a measured cost. Give the stage in a plan, and give the limit in bits:

```ts
const s = stitch(document, { kind: "value", tolerance: { relative: 1e-30 } }, { plan: ["bigfloat", "exact"], precision: { limit: 4096 } });
```

- The precision starts at 64 bits, or at `start`, and it doubles up to the limit. The last try is at the limit.
- Past the limit, the stage gives no answer. It does not give its last interval. Its claim has the kind `no claim`.
- The field `big` of a claim has the ends of the interval as `BigFloat` values, and the precision of the answer. The field `error` states the error of the double `value`, so a double cannot state an accuracy below its own gap. Read `big` for that accuracy.
- The test of a tolerance uses `big`, so the test is exact.
- `raise(f, values, question, ladder)` operates the stage on a compiled function. It takes inputs with more bits than a double: a `BigFloat` or a rational. The function `answer` of `stitch` takes doubles, because the other verbs take doubles.
- `select` uses the stage only when the model has a measured `cost.bigfloat`. `planCost` refuses a plan with the stage and no measured cost. The bench `@algebra/bigfloat-bench` gives the measure.
- An exact zero with irrational parts does not have a sign at any precision. Then the stage gives no answer at each limit.

## The tests

The property tests examine each answer of the stitched evaluator at each point of the default corpus of `@algebra/expression-corpus`. The four questions are the sign, the absolute tolerance `1e-9`, and the relative tolerances `1e-12` and `0`. Each answer contains the exact value of `compileExact` and meets its question. The stitched sign of the geometric families is the sign of `orient2d` and `incircle` of `@mark1russell7/predicates`.
