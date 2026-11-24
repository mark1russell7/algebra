/**
 * Exact vectors and matrices over the rationals of `@mark1russell7/rational`.
 *
 * @packageDocumentation
 */
import { type Rational, add, div, fromDecimal, fromNumber, mul, rational, ZERO } from "@mark1russell7/rational";

/** A vector of exact rationals. */
export type Vector = readonly Rational[];

/** A matrix of exact rationals as a list of rows. Each row has the same length. */
export type Matrix = readonly Vector[];

/** A value that `toRational` reads: a rational, a `bigint`, a JavaScript number, or a text, for example `"3/4"` or `"0.25"`. */
export type RationalInput = Rational | bigint | number | string;

/**
 * This function gives the exact rational of an input. A number gives the decimal that JavaScript prints for it. A text is a
 * decimal or a quotient of two decimals.
 *
 * @throws {RangeError} The input is not a finite value, or the text has a zero divisor.
 */
export function toRational(value: RationalInput): Rational {
  if (typeof value === "bigint") return rational(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`linear: ${value} is not a finite number`);
    return fromNumber(value);
  }
  if (typeof value === "string") {
    const slash = value.indexOf("/");
    if (slash < 0) return fromDecimal(value.trim());
    return div(fromDecimal(value.slice(0, slash).trim()), fromDecimal(value.slice(slash + 1).trim()));
  }
  return value;
}

/** This function gives a vector of exact rationals from a list of inputs. */
export function vector(values: readonly RationalInput[]): Vector {
  return values.map(toRational);
}

/**
 * This function gives a matrix of exact rationals from a list of rows.
 *
 * @throws {RangeError} The rows do not have the same length.
 */
export function matrix(rows: readonly (readonly RationalInput[])[]): Matrix {
  const result = rows.map(vector);
  columnsOf(result);
  return result;
}

/**
 * This function gives the count of columns of a matrix. A matrix with no rows has 0 columns.
 *
 * @throws {RangeError} The rows do not have the same length.
 */
export function columnsOf(m: Matrix): number {
  const n = m[0]?.length ?? 0;
  for (const row of m) {
    if (row.length !== n) throw new RangeError(`linear: a row has ${row.length} entries, and the first row has ${n}`);
  }
  return n;
}

/**
 * This function gives the dot product of two vectors.
 *
 * @throws {RangeError} The vectors do not have the same length.
 */
export function dot(a: Vector, b: Vector): Rational {
  if (a.length !== b.length) throw new RangeError(`linear: the vectors have ${a.length} and ${b.length} entries`);
  let sum = ZERO;
  for (let i = 0; i < a.length; i++) sum = add(sum, mul(a[i]!, b[i]!));
  return sum;
}

/**
 * This function gives the product of a matrix and a vector.
 *
 * @throws {RangeError} The length of the vector is not the count of columns.
 */
export function multiply(m: Matrix, x: Vector): Vector {
  return m.map((row) => dot(row, x));
}

/** This function gives the transpose of a matrix. The argument `columns` gives the row count of the result for a matrix with no rows. */
export function transpose(m: Matrix, columns: number = columnsOf(m)): Matrix {
  const result: Rational[][] = [];
  for (let j = 0; j < columns; j++) result.push(m.map((row) => row[j]!));
  return result;
}
