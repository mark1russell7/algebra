# The layers of the math repository

This file is the proposal of item A16. On 2026-11-21, the repository `algebra` gets the name `math`. The repository then has 8 layers. Each package keeps its npm name, its API and its version line.

## The rule

- Each package is in one layer.
- A runtime import goes to a package in the same layer or in a lower layer. A runtime import is an entry of `dependencies` or `peerDependencies`.
- The runtime imports in one layer make no cycle.
- A test import is an entry of `devDependencies`. It can go to a higher layer. The graph of all the imports makes no cycle.
- A published package does not import a private package at run time.
- The check of the boundaries examines the rule in CI. The second step of A16 adds the layers to the `forbidden` rules of `.dependency-cruiser.ts`.

## The layers

The lowest layer is first.

| Layer | Contents | Packages on 2026-11-09 | Packages from 2026-11-21 | Later items |
| --- | --- | --- | --- | --- |
| 1 numbers | Exact numbers and bounded numbers: rationals, floats with a selected precision, amounts with units. | `@mark1russell7/rational`, `@algebra/bigfloat` | `@mark1russell7/quantity`, from systems | A21: intervals and balls |
| 2 random | Seeded random numbers, seeds from names, draws and input families. | none | `@mark1russell7/rigor-generators`, from rigor | none |
| 3 structures | Monoid, group, ring, field, order and lattice as data, with law tests. | `@algebra/structures` | `@mark1russell7/structures`, the home of the structures for each repository | A25: the core interfaces |
| 4 probability | Distributions as structures, with law tests. | none | none | A23: distributions |
| 5 statistics | Quantiles, means, tests, bootstrap intervals and calibration. | none | `@mark1russell7/rigor-statistics`, from rigor | A20: summaries as monoids. A22: results with error bounds. |
| 6 expressions | Expression documents, the evaluators and the cost and error model. | `@mark1russell7/expression`, `@algebra/polynomial`, `@algebra/evaluator-select` | none | none |
| 7 geometry checks | Exact geometric predicates and the census of their real inputs. | `@mark1russell7/predicates`, `@mark1russell7/predicate-census` | none | none |
| 8 tools | The corpus, the benches and the site. These packages are private. | `@algebra/expression-corpus`, the 6 bench packages, `@algebra/site` | none | none |

## Why this order

The order of the strategist is numbers, structures, expressions, geometry checks, probability and statistics. This proposal changes the order in 3 places. The imports of today are the reason.

- Random is a layer of its own, below structures. `@algebra/structures` draws the values of its law tests with `Random` of rigor-generators. `@mark1russell7/expression` draws its random expressions with `mulberry32`. In the order of the strategist, these imports go up.
- Probability and statistics are below expressions. Then the cost and error model of `@algebra/evaluator-select` can use statistics at run time, for example the median of a cost. Statistics does not use expressions.
- Intervals and balls are in `@mark1russell7/expression` at this time. Statistics with error bounds (A22) needs them. So A21 moves them to the layer numbers first.

## The runtime imports of today

Each runtime import between the packages goes to the same layer or to a lower layer. The table has the 3 packages that come on 2026-11-21.

| Package | Layer | Runtime imports in the repository |
| --- | --- | --- |
| `@mark1russell7/rational` | 1 | none |
| `@algebra/bigfloat` | 1 | rational (1) |
| `@mark1russell7/quantity` | 1 | rational (1) |
| `@mark1russell7/rigor-generators` | 2 | none |
| `@algebra/structures` | 3 | rational (1), rigor-generators (2) |
| `@mark1russell7/rigor-statistics` | 5 | rigor-generators (2) |
| `@mark1russell7/expression` | 6 | rational (1), bigfloat (1), rigor-generators (2) |
| `@algebra/polynomial` | 6 | rational (1), expression (6) |
| `@algebra/evaluator-select` | 6 | rational (1), bigfloat (1), expression (6) |
| `@mark1russell7/predicates` | 7 | none |
| `@mark1russell7/predicate-census` | 7 | expression (6), predicates (7) |
| `@algebra/expression-corpus` | 8 | rational (1), rigor-generators (2), expression (6), predicates (7) |
| The 6 bench packages and `@algebra/site` | 8 | packages of the layers 1 to 8 |

Five test imports go up. `@mark1russell7/rational` and `@algebra/bigfloat` use rigor-generators in their tests. `@algebra/evaluator-select` uses the corpus and the predicates. `@algebra/polynomial` uses the corpus.

## The moves of 2026-11-21

Three packages come into the repository. Each move keeps the git history of its folder.

1. `git filter-repo` keeps only the folder of the package in a copy of the old repository. The folder becomes `packages/<name>`.
2. A merge with `--allow-unrelated-histories` brings that history into `main`.
3. The package keeps its npm name, its entries and its build. Its `repository` names `mark1russell7/math` and its new folder.
4. The version is the next PATCH. The change to the repository does not change the API.

The order is rigor-generators, then rigor-statistics, then quantity. Rigor-statistics imports rigor-generators.

The source of quantity can move before the milestones. Its pull request waits until 2026-11-21. The milestones of the layout work use rigor-statistics and rigor-generators until 2026-11-19. So their pull request is made again from `main` of rigor on 2026-11-20.

## The gate of a move

The tool of item A17 examines each moved package. The move is good only when each line is true.

- The build files are byte-equal to the files of the last release from the old repository. Only `package.json` is different.
- The API report is equal to the report of the old repository.
- The tests have the same names and the same results. The test report without its times is byte-equal.
- The report of a kept bench run, made again from its raw records, is byte-equal. This line is for rigor-statistics.
- The `repository` field and the provenance of the release name `mark1russell7/math`.

After the gate, the old folder goes, with no copy. The role systems removes quantity. The strategist removes the folders of rigor and changes the npm trust.

## The items

| ID | Item | Start | Done by |
| --- | --- | --- | --- |
| A16 | This proposal, then the check of the layers in `.dependency-cruiser.ts` | 2026-11-09 | 2026-11-12 |
| A17 | The gate tool of a move | 2026-11-10 | 2026-11-14 |
| A18 | Quantity moves from systems: the pull request is ready, and its merge is on 2026-11-21 | 2026-11-12 | 2026-11-21 |
| A19 | Rigor-statistics and rigor-generators move from rigor: a trial first, the real pull request on 2026-11-20 | 2026-11-13 | 2026-11-21 |
| A20 | Statistics summaries as monoids: mean, variance and a quantile sketch | 2026-11-22 | 2026-11-28 |
| A21 | Intervals and balls move to the layer numbers | 2026-11-22 | 2026-11-28 |
| A22 | Statistics results with error bounds | 2026-11-29 | 2026-12-05 |
| A23 | Distributions as structures, with law tests | 2026-12-06 | 2026-12-12 |
| A24 | R5 of rigor: input families with dimensions, ranges and a distribution for each dimension, and stratified, Latin hypercube and Saltelli designs | 2026-11-09 | 2026-11-16 |
| A25 | The core of `@mark1russell7/structures`: plain interfaces, standard instances, helpers and law checks. The first release is on 2026-11-21. | 2026-11-13 | 2026-11-21 |
| A26 | `@mark1russell7/expression` uses the monoid of the core | 2026-11-22 | 2026-11-28 |
