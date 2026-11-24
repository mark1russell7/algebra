# @mark1russell7/linear

This package holds exact linear algebra and exact linear programs (roadmap item A30). Each value is a rational of `@mark1russell7/rational`, so each result is exact. Each result of a linear program has a certificate, and `checkCertificate` examines it without trust in the solver.

## Vectors and matrices

A `Vector` is a list of rationals. A `Matrix` is a list of rows, and each row has the same length.

| Function | Result |
| --- | --- |
| `toRational(v)` | The rational of a number, a `bigint`, a decimal text or a quotient text, for example `"3/4"` |
| `vector(values)`, `matrix(rows)` | A vector or a matrix of rationals from inputs that `toRational` reads |
| `dot(a, b)`, `multiply(m, x)`, `transpose(m)` | The dot product, the product of a matrix and a vector, and the transpose |
| `rref(m)` | The reduced row echelon form and the column of each pivot |
| `rank(m)` | The count of pivots |
| `nullSpace(m)` | A basis of the vectors `v` with `m v = 0`: one vector for each column with no pivot |
| `solve(a, b)` | A solution `x` and a basis of the null space, or a certificate `y` with `y a = 0` and `y b = 1` |

The matrix of `solve` can be square or not, and its rank can be below its size. Each function that reads a matrix with no rows takes the count of columns as an argument.

## Linear programs

A `LinearProgram` has a sense (`"max"` or `"min"`), an objective vector `c` and a list of constraint rows. Each row has coefficients, a relation (`"<="`, `">="` or `"="`) and a right side. Each variable has the lower bound 0.

A free variable `v` is the difference of two variables `p - q`. Copy each coefficient of `v` to `p`, and put its negative on `q`.

```ts
import { checkCertificate, linearProgram, solveLinearProgram } from "@mark1russell7/linear";

const program = linearProgram({
  sense: "max",
  objective: [3, 5],
  constraints: [
    { coefficients: [1, 0], relation: "<=", rhs: 4 },
    { coefficients: [0, 2], relation: "<=", rhs: 12 },
    { coefficients: [3, 2], relation: "<=", rhs: 18 },
  ],
});
const result = solveLinearProgram(program);
// result is optimal: x = (2, 6), value 36, dual (0, 3/2, 1).
checkCertificate(program, result).valid; // true
```

`solveLinearProgram` uses an exact two-phase simplex. The rule of Bland selects each pivot, so the method ends on each program, the degenerate programs too. Phase 1 finds a feasible basis or a Farkas ray. Phase 2 optimizes the objective.

## The certificates

| Status | Certificate | The conditions that `checkCertificate` examines |
| --- | --- | --- |
| `optimal` | The point `x`, its value and a dual vector `dual` with one entry for each row | `x` is feasible, the dual is feasible, `c x = b y`, and complementary slackness holds on each row and each column |
| `infeasible` | A Farkas ray `ray` with one entry for each row | `y A >= 0`, `b y < 0`, `y_i >= 0` on a `<=` row and `y_i <= 0` on a `>=` row |
| `unbounded` | A feasible point `x` and a direction `direction` | `x` is feasible, the direction is not negative, each row keeps its relation along the direction, and `c d` improves the objective |

The dual of a maximization obeys `y A >= c`, with `y_i >= 0` on a `<=` row and `y_i <= 0` on a `>=` row. The dual of a minimization swaps each of these signs. An `=` row takes a dual of each sign.

A Farkas ray proves that no point is feasible: for each `x >= 0` that meets the rows, `0 <= y A x <= y b < 0`, and that is false.

## Lexicographic objectives

`solveLexicographic(constraints, objectives)` optimizes each objective in its order. Stage `k` keeps the optimum of each earlier objective as an equality row. The result gives each stage with its program and its result, so `checkCertificate` examines each stage. The status `optimal` also gives the last point and the optimum of each objective. A stage with no optimum stops the solve, and its result has the certificate.

Only the first stage can be infeasible, because each later stage keeps the optimal point of the stage before it. A later stage can be unbounded after optimal stages, because its objective is new.

## The tests

- Each result of the simplex on 3 seeded families of small programs goes through `checkCertificate`. The families are random programs, programs with equality rows, and degenerate programs with many zero right sides.
- An enumeration of each vertex and each extreme ray of each small program gives the status and the optimal value. The simplex agrees with it on each case.
- Changed certificates fail the check: a new value, a moved point, a moved dual, a negated ray and a negated direction.
- The cycling examples of Beale and of Chvátal end under the rule of Bland. The test also shows that the rule of the largest coefficient meets an earlier basis again on them.
- Property tests on random matrices examine `rank`, `nullSpace` and `solve`.

The property tests use `fast-check` with a fixed seed. The variable `PROPERTY_RUNS` sets the count of cases of each property, and the default is 300.
