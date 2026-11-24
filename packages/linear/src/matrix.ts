/**
 * Exact elimination: the reduced row echelon form, the rank, a basis of the null space and the solution of a system.
 *
 * @packageDocumentation
 */
import { type Rational, inverse, mul, neg, ONE, sign, sub, ZERO } from "@mark1russell7/rational";
import { type Matrix, type Vector, columnsOf } from "./vector.ts";

/** The reduced row echelon form of a matrix and the column of each pivot, in order. */
export interface RowEchelon {
  readonly matrix: Matrix;
  readonly pivots: readonly number[];
}

/**
 * This function applies Gauss-Jordan elimination to the rows in place. It takes pivots only in the columns below `limit`.
 * It gives the column of each pivot. The row of pivot `k` is row `k`.
 */
function eliminate(rows: Rational[][], limit: number): number[] {
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < limit && r < rows.length; c++) {
    let p = r;
    while (p < rows.length && sign(rows[p]![c]!) === 0) p++;
    if (p === rows.length) continue;
    const swap = rows[r]!;
    rows[r] = rows[p]!;
    rows[p] = swap;
    const scale = inverse(rows[r]![c]!);
    const pivotRow = rows[r]!.map((v) => mul(v, scale));
    rows[r] = pivotRow;
    for (let i = 0; i < rows.length; i++) {
      const f = rows[i]![c]!;
      if (i === r || sign(f) === 0) continue;
      rows[i] = rows[i]!.map((v, j) => sub(v, mul(f, pivotRow[j]!)));
    }
    pivots.push(c);
    r++;
  }
  return pivots;
}

/**
 * This function gives the reduced row echelon form of a matrix, with exact arithmetic.
 *
 * @throws {RangeError} The rows do not have the same length.
 */
export function rref(m: Matrix): RowEchelon {
  const n = columnsOf(m);
  const rows = m.map((row) => [...row]);
  const pivots = eliminate(rows, n);
  return { matrix: rows, pivots };
}

/** This function gives the rank of a matrix: the count of pivots of its reduced row echelon form. */
export function rank(m: Matrix): number {
  return rref(m).pivots.length;
}

/**
 * This function gives a basis of the null space of a matrix: the vectors `v` with `m v = 0`. The basis has one vector for each
 * column with no pivot. That vector has 1 at its column and 0 at each other column with no pivot. The argument `columns`
 * gives the count of columns for a matrix with no rows.
 */
export function nullSpace(m: Matrix, columns: number = columnsOf(m)): Matrix {
  const { matrix: r, pivots } = rref(m);
  const basis: Vector[] = [];
  for (let free = 0; free < columns; free++) {
    if (pivots.includes(free)) continue;
    const v: Rational[] = new Array<Rational>(columns).fill(ZERO);
    v[free] = ONE;
    pivots.forEach((p, k) => {
      v[p] = neg(r[k]![free]!);
    });
    basis.push(v);
  }
  return basis;
}

/**
 * The result of `solve`. A system with a solution gives one solution `x` and a basis of the null space. Each solution is `x` plus a
 * combination of the basis. A system with no solution gives a certificate `y` with `y A = 0` and `y b = 1`.
 */
export type SolveResult =
  | { readonly status: "solved"; readonly x: Vector; readonly nullSpace: Matrix }
  | { readonly status: "inconsistent"; readonly certificate: Vector };

/**
 * This function solves the system `a x = b` exactly. The matrix can be square or not, and it can have a rank below its size.
 * The solution `x` has 0 at each column with no pivot.
 *
 * @throws {RangeError} The rows do not have the same length, or `b` has a length that is not the row count.
 */
export function solve(a: Matrix, b: Vector, columns: number = columnsOf(a)): SolveResult {
  const m = a.length;
  if (b.length !== m) throw new RangeError(`linear: the matrix has ${m} rows, and the right side has ${b.length} entries`);
  // The augmented rows [a | b | I]. The identity part records the row operations, so a row `[0 | 1 | y]` gives the certificate.
  const rows = a.map((row, i) => [...row, b[i]!, ...Array.from({ length: m }, (_, k) => (k === i ? ONE : ZERO))]);
  const pivots = eliminate(rows, columns + 1);
  const last = pivots.length - 1;
  if (last >= 0 && pivots[last] === columns) {
    return { status: "inconsistent", certificate: rows[last]!.slice(columns + 1) };
  }
  const x: Rational[] = new Array<Rational>(columns).fill(ZERO);
  pivots.forEach((p, k) => {
    x[p] = rows[k]![columns]!;
  });
  return { status: "solved", x, nullSpace: nullSpace(a, columns) };
}
