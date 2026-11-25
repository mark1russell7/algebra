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

## Integer programs

An `IntegerProgram` is a linear program with a list `integer` of variable indices. Each of these variables takes integer values only. The other variables stay continuous.

`solveIntegerProgram(program, options)` uses branch and bound on the exact simplex. The search goes depth first. It branches on the fractional integer variable with the smallest index, and it takes the child `x_j <= k` first. A node is a leaf when its relaxation has no point or has no better optimum than the best integer point.

```ts
import { checkIntegerCertificate, linearProgram, solveIntegerProgram } from "@mark1russell7/linear";

const program = {
  ...linearProgram({
    sense: "max",
    objective: [5, 4],
    constraints: [
      { coefficients: [6, 4], relation: "<=", rhs: 24 },
      { coefficients: [1, 2], relation: "<=", rhs: 6 },
    ],
  }),
  integer: [0, 1],
};
const result = solveIntegerProgram(program);
// result is optimal: x = (4, 0), value 20. The relaxation gives x = (3, 3/2), value 21.
checkIntegerCertificate(program, result).valid; // true
```

| Status | Certificate | The conditions that `checkIntegerCertificate` examines |
| --- | --- | --- |
| `optimal` | The point `x`, its value and the tree | `x` is a feasible integer point with the value `c x`. The tree covers each integer point, and the value of each leaf is not better. |
| `infeasible` | The tree | The tree covers each integer point, and each leaf has a Farkas ray. |
| `unbounded` | An integer point `x` and a direction | The conditions of `checkCertificate`. Also, each integer variable of the point and of the direction is an integer. |
| `limit` | The best point, if any, a bound and the tree | The point is a feasible integer point. Each closed leaf and the parent of each open node have a value that is not better than the bound. |

The tree covers each integer point when each branched node has the two children `x_j <= k` and `x_j >= k + 1`. Each leaf has the certificate of its relaxation.

An unbounded relaxation starts a search for one integer point with the objective 0. The rows are rational, so a program with an integer point has the unbounded directions of its relaxation. The direction times the common denominator of its entries is an integer direction.

The search can go on with no end, for example on the line `2x - 2y = 1`. The option `nodeLimit` stops it, and the default is 10000 relaxations. The result `limit` then gives the best point that the search found and a proved bound of the optimum.

## The tests

- Each result of the simplex on 3 seeded families of small programs goes through `checkCertificate`. The families are random programs, programs with equality rows, and degenerate programs with many zero right sides.
- An enumeration of each vertex and each extreme ray of each small program gives the status and the optimal value. The simplex agrees with it on each case.
- Changed certificates fail the check: a new value, a moved point, a moved dual, a negated ray and a negated direction.
- The cycling examples of Beale and of Chvátal end under the rule of Bland. The test also shows that the rule of the largest coefficient meets an earlier basis again on them.
- Property tests on random matrices examine `rank`, `nullSpace` and `solve`.
- Each result of `solveIntegerProgram` on 3 seeded families goes through `checkIntegerCertificate`. The families are integer programs in a box, mixed programs in a box and programs with no box.
- In a box, an enumeration of each integer point gives the status and the optimal value. The enumeration uses the vertex enumeration for the continuous variables, not the simplex. The solver agrees with it on each case.
- The optimum of the relaxation, rounded down, misses the integer optimum on some programs in a box. This is the base.

The property tests use `fast-check` with a fixed seed. The variable `PROPERTY_RUNS` sets the count of cases of each property, and the default is 300.
