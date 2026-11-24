/**
 * The exact two-phase simplex. The rule of Bland selects each pivot, so the method ends on each program.
 *
 * @packageDocumentation
 */
import { type Rational, compare, div, inverse, mul, neg, ONE, sign, sub, ZERO } from "@mark1russell7/rational";
import { solve } from "./matrix.ts";
import { checkShape, type LinearProgram, type LinearProgramResult, type Relation } from "./program.ts";
import { dot } from "./vector.ts";

/**
 * The rule that selects the entering column. `"bland"` takes the column with the smallest index that improves the objective.
 * `"largest"` takes the column with the largest reduced cost, with the smallest index on a tie. The rule `"largest"` can cycle
 * on a degenerate program, and the tests use it only to show that cycle.
 *
 * @internal
 */
export type PivotRule = "bland" | "largest";

/** The program in equality form: `rows z = rhs`, `z >= 0`, with `rhs >= 0`. */
interface StandardForm {
  /** The original columns, then one slack or surplus column for each inequality row, then one artificial column for each row that needs one. */
  readonly rows: readonly (readonly Rational[])[];
  readonly rhs: readonly Rational[];
  /** The rows that the form multiplies by -1, so that their right side is not negative. */
  readonly flipped: readonly boolean[];
  /** The first basis: the slack column of a `<=` row, or the artificial column of the row. */
  readonly basis: readonly number[];
  /** The count of columns that are not artificial. */
  readonly structural: number;
}

/** The working tableau: the rows in the form of the current basis. */
interface Tableau {
  readonly rows: Rational[][];
  readonly rhs: Rational[];
  readonly basis: number[];
}

const FLIP: Readonly<Record<Relation, Relation>> = { "<=": ">=", ">=": "<=", "=": "=" };

function standardForm(program: LinearProgram): StandardForm {
  const n = program.objective.length;
  const rels = program.constraints.map((c) => (sign(c.rhs) < 0 ? FLIP[c.relation] : c.relation));
  const slacks = rels.filter((r) => r !== "=").length;
  const artificials = rels.filter((r) => r !== "<=").length;
  const structural = n + slacks;
  const total = structural + artificials;
  const rows: Rational[][] = [];
  const rhs: Rational[] = [];
  const flipped: boolean[] = [];
  const basis: number[] = [];
  let slack = n;
  let artificial = structural;
  program.constraints.forEach((c, i) => {
    const flip = sign(c.rhs) < 0;
    const row: Rational[] = new Array<Rational>(total).fill(ZERO);
    c.coefficients.forEach((v, j) => {
      row[j] = flip ? neg(v) : v;
    });
    const rel = rels[i]!;
    if (rel === "<=") {
      row[slack] = ONE;
      basis.push(slack++);
    } else {
      if (rel === ">=") row[slack++] = neg(ONE);
      row[artificial] = ONE;
      basis.push(artificial++);
    }
    rows.push(row);
    rhs.push(flip ? neg(c.rhs) : c.rhs);
    flipped.push(flip);
  });
  return { rows, rhs, flipped, basis, structural };
}

function pivot(t: Tableau, p: number, q: number): void {
  const scale = inverse(t.rows[p]![q]!);
  const pivotRow = t.rows[p]!.map((v) => mul(v, scale));
  const pivotRhs = mul(t.rhs[p]!, scale);
  t.rows[p] = pivotRow;
  t.rhs[p] = pivotRhs;
  for (let i = 0; i < t.rows.length; i++) {
    const f = t.rows[i]![q]!;
    if (i === p || sign(f) === 0) continue;
    t.rows[i] = t.rows[i]!.map((v, j) => sub(v, mul(f, pivotRow[j]!)));
    t.rhs[i] = sub(t.rhs[i]!, mul(f, pivotRhs));
  }
  t.basis[p] = q;
}

/** This function gives the reduced cost `c_j - c_B B^-1 A_j` of each column, for a maximization. */
function reducedCosts(t: Tableau, cost: readonly Rational[]): Rational[] {
  const r = [...cost];
  t.rows.forEach((row, i) => {
    const cb = cost[t.basis[i]!]!;
    if (sign(cb) === 0) return;
    for (let j = 0; j < r.length; j++) r[j] = sub(r[j]!, mul(cb, row[j]!));
  });
  return r;
}

type Phase = { readonly kind: "optimal" } | { readonly kind: "unbounded"; readonly column: number } | { readonly kind: "cycle" };

const basisKey = (basis: readonly number[]): string => [...basis].sort((a, b) => a - b).join(",");

/** This function maximizes `cost · z` from the current basis. Only the columns below `allowed` can enter. */
function runPhase(t: Tableau, cost: readonly Rational[], allowed: number, rule: PivotRule, count: { pivots: number }): Phase {
  const seen = new Set<string>([basisKey(t.basis)]);
  for (;;) {
    const r = reducedCosts(t, cost);
    let q = -1;
    for (let j = 0; j < allowed; j++) {
      if (sign(r[j]!) <= 0) continue;
      if (rule === "bland") {
        q = j;
        break;
      }
      if (q < 0 || compare(r[j]!, r[q]!) > 0) q = j;
    }
    if (q < 0) return { kind: "optimal" };
    let p = -1;
    let best = ZERO;
    t.rows.forEach((row, i) => {
      const a = row[q]!;
      if (sign(a) <= 0) return;
      const ratio = div(t.rhs[i]!, a);
      const order = p < 0 ? -1 : compare(ratio, best);
      if (order < 0 || (order === 0 && t.basis[i]! < t.basis[p]!)) {
        p = i;
        best = ratio;
      }
    });
    if (p < 0) return { kind: "unbounded", column: q };
    pivot(t, p, q);
    count.pivots++;
    // A deterministic rule that meets a basis again repeats its cycle forever. The rule of Bland does not meet a basis again.
    const key = basisKey(t.basis);
    if (seen.has(key)) return { kind: "cycle" };
    seen.add(key);
  }
}

/** This function gives the dual of the basis in the rows of the program: the solution of `B^T y = c_B`, with the flips undone. */
function dualOf(form: StandardForm, basis: readonly number[], cost: readonly Rational[]): Rational[] {
  if (basis.length === 0) return [];
  const bt = basis.map((col) => form.rows.map((row) => row[col]!));
  const solved = solve(bt, basis.map((col) => cost[col]!));
  if (solved.status !== "solved") throw new Error("linear: internal error, the basis is singular");
  return solved.x.map((y, i) => (form.flipped[i] ? neg(y) : y));
}

/** This function gives the first `n` entries of the basic solution of the tableau. */
function pointOf(t: Tableau, n: number): Rational[] {
  const x: Rational[] = new Array<Rational>(n).fill(ZERO);
  t.basis.forEach((col, i) => {
    if (col < n) x[col] = t.rhs[i]!;
  });
  return x;
}

/**
 * The run of the simplex with a pivot rule: the result, or a cycle, and the count of pivots.
 *
 * @internal
 */
export type SimplexRun =
  | { readonly cycled: false; readonly result: LinearProgramResult; readonly pivots: number }
  | { readonly cycled: true; readonly pivots: number };

/**
 * This function solves a program with a pivot rule. The public `solveLinearProgram` uses the rule of Bland.
 *
 * @internal
 */
export function runSimplex(program: LinearProgram, rule: PivotRule): SimplexRun {
  checkShape(program);
  const n = program.objective.length;
  const form = standardForm(program);
  const total = form.rows[0]?.length ?? n;
  const t: Tableau = { rows: form.rows.map((row) => [...row]), rhs: [...form.rhs], basis: [...form.basis] };
  const count = { pivots: 0 };

  // Phase 1: maximize the negative sum of the artificial columns.
  if (total > form.structural) {
    const cost = Array.from({ length: total }, (_, j) => (j >= form.structural ? neg(ONE) : ZERO));
    const phase = runPhase(t, cost, total, rule, count);
    if (phase.kind === "cycle") return { cycled: true, pivots: count.pivots };
    let value = ZERO;
    t.basis.forEach((col, i) => {
      value = sub(value, col >= form.structural ? t.rhs[i]! : ZERO);
    });
    if (sign(value) < 0) {
      return { cycled: false, result: { status: "infeasible", ray: dualOf(form, t.basis, cost) }, pivots: count.pivots };
    }
    // Each artificial column in the basis has the value 0. Move it out on a column that is not artificial, if the row has one.
    t.basis.forEach((col, i) => {
      if (col < form.structural) return;
      const j = t.rows[i]!.findIndex((v, k) => k < form.structural && sign(v) !== 0);
      if (j >= 0) pivot(t, i, j);
    });
  }

  // Phase 2: the objective, as a maximization. An artificial column cannot enter, and a row that keeps one is redundant.
  const max = program.sense === "max";
  const cost = Array.from({ length: total }, (_, j) => (j < n ? (max ? program.objective[j]! : neg(program.objective[j]!)) : ZERO));
  const phase = runPhase(t, cost, form.structural, rule, count);
  if (phase.kind === "cycle") return { cycled: true, pivots: count.pivots };
  const x = pointOf(t, n);
  if (phase.kind === "unbounded") {
    const q = phase.column;
    const direction: Rational[] = new Array<Rational>(n).fill(ZERO);
    if (q < n) direction[q] = ONE;
    t.basis.forEach((col, i) => {
      if (col < n) direction[col] = neg(t.rows[i]![q]!);
    });
    return { cycled: false, result: { status: "unbounded", x, direction }, pivots: count.pivots };
  }
  const dual = dualOf(form, t.basis, cost);
  return {
    cycled: false,
    result: { status: "optimal", x, value: dot(program.objective, x), dual: max ? dual : dual.map(neg) },
    pivots: count.pivots,
  };
}

/**
 * This function solves a linear program exactly with the two-phase simplex and the rule of Bland. The result has a certificate
 * that `checkCertificate` examines.
 *
 * @throws {RangeError} A constraint row has a length that is not the length of the objective.
 */
export function solveLinearProgram(program: LinearProgram): LinearProgramResult {
  const run = runSimplex(program, "bland");
  if (run.cycled) throw new Error("linear: internal error, the rule of Bland met a basis again");
  return run.result;
}

