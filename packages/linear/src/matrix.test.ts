import { type Rational, equals, rational, sign, ZERO } from "@mark1russell7/rational";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS } from "./brute.test-helper.ts";
import { columnsOf, dot, type Matrix, matrix, multiply, nullSpace, rank, rref, solve, toRational, transpose, vector } from "./index.ts";

const isZero = (v: readonly Rational[]): boolean => v.every((x) => sign(x) === 0);
const same = (a: readonly Rational[], b: readonly Rational[]): boolean => a.length === b.length && a.every((x, i) => equals(x, b[i]!));

/** An arbitrary matrix of 1 to 4 rows and 1 to 4 columns with small entries. Many entries are 0, so many ranks are low. */
const matrices: fc.Arbitrary<Matrix> = fc
  .tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }))
  .chain(([m, n]) =>
    fc.array(
      fc.array(
        fc.oneof(fc.constant(0), fc.integer({ min: -3, max: 3 })).map((k) => rational(BigInt(k))),
        { minLength: n, maxLength: n },
      ),
      { minLength: m, maxLength: m },
    ),
  );

describe("the inputs", () => {
  it("reads numbers, bigints, decimals and quotients exactly", () => {
    expect(toRational("3/4")).toEqual(rational(3n, 4n));
    expect(toRational("0.25")).toEqual(rational(1n, 4n));
    expect(toRational(0.1)).toEqual(rational(1n, 10n));
    expect(toRational(-7n)).toEqual(rational(-7n));
    expect(() => toRational(Number.NaN)).toThrow(RangeError);
    expect(() => toRational("1/0")).toThrow(RangeError);
  });

  it("refuses rows of different lengths", () => {
    expect(() => matrix([[1, 2], [3]])).toThrow(RangeError);
    expect(() => dot(vector([1]), vector([1, 2]))).toThrow(RangeError);
    expect(columnsOf([])).toBe(0);
  });
});

describe("solve, rank and the null space on known systems", () => {
  it("solves a square system with one solution", () => {
    const r = solve(matrix([[2, 1], [1, 3]]), vector([3, 5]));
    expect(r.status).toBe("solved");
    if (r.status !== "solved") return;
    expect(r.x).toEqual(vector(["4/5", "7/5"]));
    expect(r.nullSpace).toEqual([]);
  });

  it("gives a solution and a null space for a singular system", () => {
    const a = matrix([[1, 2, 3], [2, 4, 6]]);
    const r = solve(a, vector([1, 2]));
    expect(r.status).toBe("solved");
    if (r.status !== "solved") return;
    expect(multiply(a, r.x)).toEqual(vector([1, 2]));
    expect(r.nullSpace).toHaveLength(2);
    expect(rank(a)).toBe(1);
  });

  it("gives a certificate for a system with no solution", () => {
    const a = matrix([[1, 1], [2, 2]]);
    const b = vector([1, 3]);
    const r = solve(a, b);
    expect(r.status).toBe("inconsistent");
    if (r.status !== "inconsistent") return;
    expect(isZero(multiply(transpose(a), r.certificate))).toBe(true);
    expect(dot(r.certificate, b)).toEqual(rational(1n));
  });

  it("gives the reduced row echelon form", () => {
    const e = rref(matrix([[0, 2, 4], [1, 1, 1]]));
    expect(e.pivots).toEqual([0, 1]);
    expect(e.matrix).toEqual(matrix([[1, 0, -1], [0, 1, 2]]));
  });

  it("handles a matrix with no rows", () => {
    expect(rank([])).toBe(0);
    expect(nullSpace([], 2)).toHaveLength(2);
    expect(solve([], [], 2)).toEqual({ status: "solved", x: [ZERO, ZERO], nullSpace: nullSpace([], 2) });
  });
});

describe("the laws of exact elimination", () => {
  it("gives the same rank to a matrix and its transpose", () => {
    fc.assert(
      fc.property(matrices, (a) => rank(a) === rank(transpose(a))),
      RUNS,
    );
  });

  it("gives a null space of n - rank independent vectors with a zero product", () => {
    fc.assert(
      fc.property(matrices, (a) => {
        const n = columnsOf(a);
        const basis = nullSpace(a);
        if (basis.length !== n - rank(a)) return false;
        if (basis.length > 0 && rank(basis) !== basis.length) return false;
        return basis.every((v) => isZero(multiply(a, v)));
      }),
      RUNS,
    );
  });

  it("gives an exact solution or a certificate of no solution", () => {
    let solved = 0;
    let inconsistent = 0;
    fc.assert(
      fc.property(
        matrices.chain((a) =>
          fc.tuple(
            fc.constant(a),
            fc.array(fc.integer({ min: -3, max: 3 }).map((k) => rational(BigInt(k))), { minLength: a.length, maxLength: a.length }),
            fc.array(fc.integer({ min: -3, max: 3 }).map((k) => rational(BigInt(k))), { minLength: columnsOf(a), maxLength: columnsOf(a) }),
            fc.boolean(),
          ),
        ),
        ([a, free, x0, consistent]) => {
          // Half of the right sides are a x0, so they have a solution.
          const b = consistent ? multiply(a, x0) : free;
          const r = solve(a, b);
          if (r.status === "solved") {
            solved++;
            return same(multiply(a, r.x), b) && r.nullSpace.every((v) => isZero(multiply(a, v)));
          }
          inconsistent++;
          return !consistent && isZero(multiply(transpose(a), r.certificate)) && equals(dot(r.certificate, b), rational(1n));
        },
      ),
      RUNS,
    );
    expect(solved).toBeGreaterThan(0);
    expect(inconsistent).toBeGreaterThan(0);
  });
});
