# Roadmap

This file is the plan of algebra. The Status page of the site reads it, and the tracker of the project mirrors it.

Each item writes its prediction before its code: the claims, how each claim is measured, its base and its noise.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| A1 | Expression documents | done 2026-11-02 (#8) | The package `@mark1russell7/expression`. The coeval kinds of an expression: numbers, variables, the field operations, powers, roots, `min`, `max` and comparisons. Each node keeps a summary monoid: free variables, degree, bounds and cost. A zod schema and a generator of random expressions for property tests. |
| A2 | Exact rationals | not started | Rationals over `bigint`, always in lowest terms. The start is the rationals of `@mark1russell7/quantity` in systems: they move here, and quantity imports them. Property tests of the field laws. Prediction: within 2× of the time of the current rationals of quantity on its own tests. |
| A3 | The float evaluator | not started | An expression compiles once to a JavaScript function of its variables, with no `eval` at run time. It also gives a bound of its rounding error from the summary of each node. Prediction: within 1.5× of a hand-written function on the corpus of A12. |
| A4 | Interval and ball arithmetic | not started | Intervals with outward rounding (one step of `nextafter` on each bound), and balls (a midpoint and a radius). The property: the interval contains the exact value of A2 at each point of the corpus. |
| A5 | Exact geometric predicates | not started | Orientation, in-circle and segment intersection. A float filter with a stated error bound answers first, and the exact evaluator answers the rest. A bench against `robust-predicates` on random and near-degenerate inputs. The first users are packing and highways. |
| A6 | The cost and error model | not started | Each evaluator measures its cost and its error on the corpus. A selector takes a question and a tolerance, and selects the cheapest evaluator that meets the tolerance. It also stitches them: float first, exact only where the filter fails. The selector is itself measured against each fixed choice. |
| A7 | Arbitrary precision | later | Floats with a precision that the caller selects, and correct rounding of the basic operations. |
| A8 | The symbolic evaluator | later | A normal form for polynomials and rational functions, simplification, differentiation and the solution of linear and polynomial equations. |
| A9 | Structures and constructions | later | Monoid, group, ring, field, order and lattice as instances with law tests. Products, quotients, polynomial rings and field extensions. These instances are the first input of the type graph. |
| A10 | vex uses the float evaluator | later | The compiler of vex compiles its formulas through A3, and its domains use the structures of A9. |
| A11 | The site | not started | A live page for each evaluator: type an expression, see each result, its error bound and its cost. The Status page reads this file. |
| A12 | The corpus and the CI bench | not started | A generator of expressions: well-conditioned and ill-conditioned, small and large, with near-degenerate geometric inputs. CI runs the bench. Each result keeps its raw records, the losers too. |
| A13 | The base of A5 | in progress | The real inputs of packing and highways go through the orientation sign of the A1 bounds. The measure is the count of pairs whose sign the float bound cannot fix, each one confirmed by the exact value. A count of 0 ranks A5 lower. The package `@mark1russell7/predicate-census` is the census. It waits for the corpora of highways and packing. |
