/**
 * The grid of the explorer. Each cell moves one input point by whole steps of its unit in the last place (ulp). Each
 * cell then gets the signs of one sign expression: the float sign, the sign that the A1 interval fixes and the exact
 * sign. An orientation and an in-circle sign also get the A5 predicate and the stage that decided it. The worker and
 * the page use the same functions.
 *
 * @packageDocumentation
 */
import { interval } from "@mark1russell7/expression";
import { incircle, orient2d } from "@mark1russell7/predicates";
import type { SignResult, Stage } from "@mark1russell7/predicates";
import { boundSign, dyadic, exactValue, floatValue, orientForm, PREDICATES, signForm } from "./census.ts";
import type { Dyadic, Point, PointVars, PredicateName, Sign, SignForm } from "./census.ts";
import type { Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";

/**
 * The sign expression of a grid: an orientation of three points, the in-circle sign of four points, or a named sign
 * of a predicate of the census.
 */
export type FormSpec =
  | { readonly kind: "orient"; readonly name: string; readonly points: readonly [PointVars, PointVars, PointVars] }
  | { readonly kind: "incircle"; readonly name: string; readonly points: readonly [PointVars, PointVars, PointVars, PointVars] }
  | { readonly kind: "sign"; readonly predicate: PredicateName; readonly name: string };

/** The part of the grid that the page shows. The center is a count of ulps from the input point. */
export interface View {
  /** The offset of the center on the x axis, in ulps of the x coordinate. */
  readonly ox: number;
  /** The offset of the center on the y axis, in ulps of the y coordinate. */
  readonly oy: number;
  /** The count of ulps from one cell to the next. It is a power of 2. */
  readonly step: number;
  /** The count of cells on each side. */
  readonly n: number;
}

/** One job of the grid: the input, the sign expression, the moved point and the view. */
export interface GridJob {
  readonly vars: Point;
  readonly form: FormSpec;
  /** The names of the variables of the moved point: its x and its y. */
  readonly move: PointVars;
  readonly view: View;
}

/**
 * The signs of one cell. `bound` is `null` when the interval does not fix the sign. `stage` is the stage of the A5
 * predicate, or `null` for a sign with no A5 predicate. `a5Wrong` is `true` when the A5 sign is not the exact sign.
 */
export interface CellSigns {
  readonly float: Sign;
  readonly exact: Sign;
  readonly bound: Sign | null;
  readonly stage: Stage | null;
  readonly a5Wrong: boolean;
}

/** The values of one cell, for the readout of the page. */
export interface CellDetail extends CellSigns {
  readonly point: Point;
  /** The result of the A5 predicate, or `null` for a sign with no A5 predicate. */
  readonly a5: SignResult | null;
  /** The offsets of the cell from the input point, in ulps. */
  readonly offset: readonly [number, number];
  readonly floatValue: number;
  readonly bounds: readonly [number, number] | null;
  readonly exactValue: Rational;
}

/** The counts of the cells of a grid. */
export interface Counts {
  readonly cells: number;
  /** The cells whose float sign is not the exact sign. */
  readonly floatWrong: number;
  /** The cells whose sign the interval does not fix. */
  readonly undecided: number;
  /** The float-wrong cells whose sign the interval fixes. A count above 0 is a defect of the interval. */
  readonly wrongButDecided: number;
  /** The cells whose exact sign is 0. */
  readonly exactZero: number;
  /** The cells that the float filter of the A5 predicate decides. */
  readonly filter: number;
  /** The cells that go to the exact stage of the A5 predicate. */
  readonly exactStage: number;
  /** The cells whose A5 sign is not the exact sign. A count above 0 is a defect of A5. */
  readonly a5Wrong: number;
  /** The float-wrong cells that the A5 filter decides. A count above 0 is a defect of the filter bound. */
  readonly wrongButFiltered: number;
}

/**
 * This function gives the unit in the last place of a float: the gap from its magnitude to the next float above.
 *
 * @param x - A finite float.
 * @returns The gap. The value 0 gives the smallest subnormal.
 */
export function ulp(x: number): number {
  const a = Math.abs(x);
  return interval.nextUp(a) - a;
}

/**
 * This function gives the offsets of a cell from the input point, in ulps. Row 0 is the top row, so the y offset
 * goes down as the row goes up.
 *
 * @param view - The view.
 * @param i - The column, from 0 to `n - 1`.
 * @param j - The row, from 0 to `n - 1`.
 * @returns The x offset and the y offset.
 */
export function cellOffset(view: View, i: number, j: number): [number, number] {
  const half = Math.floor(view.n / 2);
  return [view.ox + (i - half) * view.step, view.oy + (half - 1 - j) * view.step];
}

/**
 * This function gives the input of a cell. The moved point is the float `p + k * u` on each axis, with `u` the ulp
 * of the coordinate. The test is of that float input, so a rounded sum is still an honest input.
 *
 * @param job - The job.
 * @param i - The column.
 * @param j - The row.
 * @returns The value of each variable at the cell.
 */
export function cellPoint(job: GridJob, i: number, j: number): Point {
  const [xName, yName] = job.move;
  const x = valueOf(job.vars, xName);
  const y = valueOf(job.vars, yName);
  const [kx, ky] = cellOffset(job.view, i, j);
  return { ...job.vars, [xName]: x + kx * ulp(x), [yName]: y + ky * ulp(y) };
}

function valueOf(point: Point, name: string): number {
  const x = point[name];
  if (x === undefined) throw new RangeError(`The input has no variable ${name}.`);
  return x;
}

/**
 * This function gives the compiled sign expression of a spec. A named sign is the same object that the census uses.
 *
 * @param spec - The spec.
 * @returns The compiled sign.
 * @throws {RangeError} The predicate has no sign with the name.
 */
export function buildForm(spec: FormSpec): SignForm {
  if (spec.kind === "orient") return orientForm(spec.name, ...spec.points);
  if (spec.kind === "incircle") return signForm(spec.name, incircleDoc(...spec.points));
  const form = PREDICATES[spec.predicate].signs.find((s) => s.name === spec.name);
  if (form === undefined) throw new RangeError(`The predicate ${spec.predicate} has no sign ${spec.name}.`);
  return form;
}

const v = (name: string): Expression => ({ type: "var", value: name });
const op = (type: "add" | "sub" | "mul", x: Expression, y: Expression): Expression => ({ type, value: [x, y] });

/**
 * This function gives the document of the in-circle determinant of Shewchuk. Its operations are the float operations
 * of `incircle` of A5 in the same order, so the float value of the document is the value that the A5 filter tests.
 *
 * @returns `alift (bdx cdy - cdx bdy) + blift (cdx ady - adx cdy) + clift (adx bdy - bdx ady)`, with `adx = ax - dx`.
 */
export function incircleDoc(a: PointVars, b: PointVars, c: PointVars, d: PointVars): Expression {
  const dif = (p: PointVars, k: 0 | 1): Expression => op("sub", v(p[k]), v(d[k]));
  const [adx, ady, bdx, bdy, cdx, cdy] = [dif(a, 0), dif(a, 1), dif(b, 0), dif(b, 1), dif(c, 0), dif(c, 1)];
  const lift = (x: Expression, y: Expression): Expression => op("add", op("mul", x, x), op("mul", y, y));
  const cross = (p: Expression, q: Expression, r: Expression, t: Expression): Expression => op("sub", op("mul", p, q), op("mul", r, t));
  return op(
    "add",
    op("add", op("mul", lift(adx, ady), cross(bdx, cdy, cdx, bdy)), op("mul", lift(bdx, bdy), cross(cdx, ady, adx, cdy))),
    op("mul", lift(cdx, cdy), cross(adx, bdy, bdx, ady)),
  );
}

/** The A5 predicate of a sign: a function of the input, or `null` for a sign with no A5 predicate. */
export type A5Predicate = ((point: Point) => SignResult) | null;

/**
 * This function gives the A5 predicate of a sign. An orientation `orient(p, q, r)` of the census is
 * `(q - p) x (r - p)`. It calls `orient2d(q, r, p)`, which has the same float operations, so the filter tests the
 * float value of the census.
 *
 * @param spec - The spec of the sign.
 * @param form - The compiled sign.
 * @returns The predicate, or `null`.
 */
export function a5Of(spec: FormSpec, form: SignForm): A5Predicate {
  const at = (point: Point, p: PointVars): [number, number] => [valueOf(point, p[0]), valueOf(point, p[1])];
  if (spec.kind === "incircle") {
    const [a, b, c, d] = spec.points;
    return (point) => incircle(...at(point, a), ...at(point, b), ...at(point, c), ...at(point, d));
  }
  const pts = form.points;
  if (pts === undefined) return null;
  const [p, q, r] = pts;
  return (point) => orient2d(...at(point, q), ...at(point, r), ...at(point, p));
}

/** This function gives the sign of a float. `-0` and `0` give 0. */
export function floatSign(x: number): Sign {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/**
 * This function gives the three signs of a sign expression at one input.
 *
 * @param form - The compiled sign.
 * @param point - The input.
 * @param a5 - The A5 predicate of the sign, or `null`.
 * @returns The float sign, the exact sign, the sign of the A1 interval and the stage of A5.
 */
export function cellSigns(form: SignForm, point: Point, a5: A5Predicate = null): CellSigns {
  const exact = dyadic.sign(exactValue(form.doc, point));
  const r = a5 === null ? null : a5(point);
  return {
    float: floatSign(floatValue(form.doc, point)),
    exact,
    bound: boundSign(form.bounds(point)),
    stage: r === null ? null : r.stage,
    a5Wrong: r !== null && r.sign !== exact,
  };
}

/** This function gives the exact rational of a dyadic number `m * 2^e`. */
export function dyadicToRational(x: Dyadic): Rational {
  return x.e >= 0 ? Q.rational(x.m << BigInt(x.e)) : Q.rational(x.m, 1n << BigInt(-x.e));
}

/**
 * This function gives all the values of one cell, for the readout.
 *
 * @param job - The job.
 * @param form - The compiled sign of the job.
 * @param i - The column.
 * @param j - The row.
 * @returns The input, the offsets, the values, the signs and the result of A5.
 */
export function cellDetail(job: GridJob, form: SignForm, i: number, j: number): CellDetail {
  const point = cellPoint(job, i, j);
  const value = floatValue(form.doc, point);
  const bounds = form.bounds(point);
  const exact = exactValue(form.doc, point);
  const pred = a5Of(job.form, form);
  const a5 = pred === null ? null : pred(point);
  return {
    point,
    a5,
    stage: a5 === null ? null : a5.stage,
    a5Wrong: a5 !== null && a5.sign !== dyadic.sign(exact),
    offset: cellOffset(job.view, i, j),
    floatValue: value,
    bounds,
    exactValue: dyadicToRational(exact),
    float: floatSign(value),
    exact: dyadic.sign(exact),
    bound: boundSign(bounds),
  };
}

/** The code of the sign `null` of the interval. */
const UNDECIDED = 3;

const STAGES: readonly (Stage | null)[] = [null, "filter", "exact"];

/**
 * This function packs the signs of a cell into one byte: `float + 3 * exact + 9 * bound + 36 * stage + 108 * a5Wrong`.
 * Each sign moves to 0, 1 or 2. The value 3 of `bound` is an interval that does not fix the sign. The stage is 0 for
 * no A5 predicate, 1 for the filter and 2 for the exact stage. The largest code is 215.
 */
export function encode(signs: CellSigns): number {
  const b = signs.bound === null ? UNDECIDED : signs.bound + 1;
  return signs.float + 1 + 3 * (signs.exact + 1) + 9 * b + 36 * STAGES.indexOf(signs.stage) + (signs.a5Wrong ? 108 : 0);
}

/** This function unpacks the byte of `encode`. */
export function decode(code: number): CellSigns {
  const b = Math.floor(code / 9) % 4;
  return {
    float: ((code % 3) - 1) as Sign,
    exact: ((Math.floor(code / 3) % 3) - 1) as Sign,
    bound: b === UNDECIDED ? null : ((b - 1) as Sign),
    stage: STAGES[Math.floor(code / 36) % 3] ?? null,
    a5Wrong: code >= 108,
  };
}

/**
 * This function fills the rows `j0` to `j1 - 1` of a grid. The array has one byte for each cell, row by row.
 *
 * @param job - The job.
 * @param form - The compiled sign of the job.
 * @param j0 - The first row.
 * @param j1 - The row after the last row.
 * @param out - The array of the codes of the cells. Its length is `n * (j1 - j0)`, and row `j0` is at index 0.
 */
export function fillRows(job: GridJob, form: SignForm, j0: number, j1: number, out: Uint8Array): void {
  const n = job.view.n;
  const a5 = a5Of(job.form, form);
  for (let j = j0; j < j1; j++) {
    for (let i = 0; i < n; i++) out[(j - j0) * n + i] = encode(cellSigns(form, cellPoint(job, i, j), a5));
  }
}

/** This function counts the cells of a grid by their signs. */
export function tally(codes: Uint8Array): Counts {
  let floatWrong = 0;
  let undecided = 0;
  let wrongButDecided = 0;
  let exactZero = 0;
  let filter = 0;
  let exactStage = 0;
  let a5Wrong = 0;
  let wrongButFiltered = 0;
  for (const code of codes) {
    const s = decode(code);
    const wrong = s.float !== s.exact;
    if (wrong) floatWrong++;
    if (s.bound === null) undecided++;
    else if (wrong) wrongButDecided++;
    if (s.exact === 0) exactZero++;
    if (s.stage === "filter") filter++;
    if (s.stage === "exact") exactStage++;
    if (s.stage === "filter" && wrong) wrongButFiltered++;
    if (s.a5Wrong) a5Wrong++;
  }
  return { cells: codes.length, floatWrong, undecided, wrongButDecided, exactZero, filter, exactStage, a5Wrong, wrongButFiltered };
}

/** A segment in the coordinates of the cells: column and row, with the center of cell `(i, j)` at `(i + 0.5, j + 0.5)`. */
export interface CellSegment {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * This function gives the exact zero line of an orientation over the grid, when the moved point is one of its three
 * points. The line comes from exact rationals, and only the last step to the cell coordinates rounds.
 *
 * @param job - The job.
 * @param form - The compiled sign of the job.
 * @returns The line from the left side to the right side of the grid. The value is `null` for a sign that is not
 *   an orientation, or for a line outside the grid.
 */
export function exactLine(job: GridJob, form: SignForm): CellSegment | null {
  const pts = form.points;
  if (pts === undefined) return null;
  const at = pts.findIndex((p) => p[0] === job.move[0] && p[1] === job.move[1]);
  if (at < 0) return null;
  // A cyclic turn keeps the sign of an orientation, so the moved point is the last point of orient(a, b, m).
  const [a, b] = [pts[(at + 1) % 3] as PointVars, pts[(at + 2) % 3] as PointVars];
  const f = (name: string): Rational => Q.fromFloat(valueOf(job.vars, name));
  const [ax, ay, bx, by, mx, my] = [f(a[0]), f(a[1]), f(b[0]), f(b[1]), f(job.move[0]), f(job.move[1])];
  const ux = Q.fromFloat(ulp(valueOf(job.vars, job.move[0])));
  const uy = Q.fromFloat(ulp(valueOf(job.vars, job.move[1])));
  const dX = Q.sub(bx, ax);
  const dY = Q.sub(by, ay);
  // orient(a, b, m + (kx ux, ky uy)) = e0 + dX uy ky - dY ux kx.
  const e0 = Q.sub(Q.mul(dX, Q.sub(my, ay)), Q.mul(dY, Q.sub(mx, ax)));
  const { n, step, ox, oy } = job.view;
  const half = Math.floor(n / 2);
  // A cell column c has the offset kx = ox + (c - 0.5 - half) step at its center c, so c = (kx - ox) / step + half + 0.5.
  const toCol = (kx: Rational): number => Q.toNumber(Q.div(Q.sub(kx, Q.fromFloat(ox)), Q.fromFloat(step))) + half + 0.5;
  const toRow = (ky: Rational): number => half - 0.5 - Q.toNumber(Q.div(Q.sub(ky, Q.fromFloat(oy)), Q.fromFloat(step)));
  const kxOf = (col: number): Rational => Q.add(Q.fromFloat(ox), Q.mul(Q.fromFloat(col - half - 0.5), Q.fromFloat(step)));
  if (Q.sign(dX) !== 0) {
    // ky = (dY ux kx - e0) / (dX uy).
    const kyOf = (kx: Rational): Rational => Q.div(Q.sub(Q.mul(Q.mul(dY, ux), kx), e0), Q.mul(dX, uy));
    const k0 = kxOf(0);
    const k1 = kxOf(n);
    return { x0: 0, y0: toRow(kyOf(k0)), x1: n, y1: toRow(kyOf(k1)) };
  }
  if (Q.sign(dY) === 0) return null;
  // A vertical line: kx = e0 / (dY ux).
  const col = toCol(Q.div(e0, Q.mul(dY, ux)));
  return { x0: col, y0: 0, x1: col, y1: n };
}
