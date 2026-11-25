/**
 * The check of a certificate. It uses only exact arithmetic on the program and the result, and it does not trust the solver.
 *
 * @packageDocumentation
 */
import { type Rational, equals, mul, sign, sub, toString } from "@mark1russell7/rational";
import type { LinearProgram, LinearProgramResult, Relation } from "./program.ts";
import { dot, type Vector } from "./vector.ts";

/** The verdict of `checkCertificate`. The list `failures` names each condition that the certificate does not meet. */
export interface CertificateCheck {
  readonly valid: boolean;
  readonly failures: readonly string[];
}

/** This function tells if the sign of a value obeys a relation to 0. */
function holds(s: -1 | 0 | 1, relation: Relation): boolean {
  return relation === "=" ? s === 0 : relation === "<=" ? s <= 0 : s >= 0;
}

/** This function gives the column sums `y A`: entry `j` is the sum over the rows of `y_i a_ij`. */
function columnSums(program: LinearProgram, y: Vector): Rational[] {
  return program.objective.map((_, j) => dot(program.constraints.map((c) => c.coefficients[j]!), y));
}

/**
 * This function adds a failure for each constraint row that `x` breaks, and for each negative entry of `x`.
 *
 * @internal
 */
export function checkFeasible(program: LinearProgram, x: Vector, failures: string[]): void {
  if (x.length !== program.objective.length) {
    failures.push(`the point has ${x.length} entries, and the program has ${program.objective.length} variables`);
    return;
  }
  x.forEach((v, j) => {
    if (sign(v) < 0) failures.push(`x[${j}] = ${toString(v)} is negative`);
  });
  program.constraints.forEach((c, i) => {
    const lhs = dot(c.coefficients, x);
    if (!holds(sign(sub(lhs, c.rhs)), c.relation)) {
      failures.push(`row ${i}: ${toString(lhs)} ${c.relation} ${toString(c.rhs)} is false`);
    }
  });
}

/**
 * This function adds a failure for each multiplier with the wrong sign. With `s = 1`, a `<=` row needs a multiplier of 0 or
 * more, and a `>=` row a multiplier of 0 or less. The value `s = -1` swaps the two signs. An `=` row takes each sign.
 */
function checkMultiplierSigns(program: LinearProgram, y: Vector, s: 1 | -1, name: string, failures: string[]): void {
  program.constraints.forEach((c, i) => {
    const signed = sign(y[i]!) * s;
    if ((c.relation === "<=" && signed < 0) || (c.relation === ">=" && signed > 0)) {
      failures.push(`${name}[${i}] = ${toString(y[i]!)} has the wrong sign for a ${c.relation} row`);
    }
  });
}

function checkOptimal(program: LinearProgram, x: Vector, value: Rational, y: Vector, failures: string[]): void {
  const m = program.constraints.length;
  if (y.length !== m) failures.push(`the dual has ${y.length} entries, and the program has ${m} rows`);
  checkFeasible(program, x, failures);
  if (y.length !== m || x.length !== program.objective.length) return;
  const s = program.sense === "max" ? 1 : -1;
  checkMultiplierSigns(program, y, s, "dual", failures);
  const sums = columnSums(program, y);
  sums.forEach((sum, j) => {
    const slack = sub(sum, program.objective[j]!);
    if (sign(slack) * s < 0) failures.push(`the dual constraint of column ${j} is false: (yA)[${j}] - c[${j}] = ${toString(slack)}`);
    if (sign(mul(x[j]!, slack)) !== 0) failures.push(`complementary slackness fails at column ${j}`);
  });
  program.constraints.forEach((c, i) => {
    if (sign(mul(y[i]!, sub(dot(c.coefficients, x), c.rhs))) !== 0) failures.push(`complementary slackness fails at row ${i}`);
  });
  const primal = dot(program.objective, x);
  const dual = dot(
    program.constraints.map((c) => c.rhs),
    y,
  );
  if (!equals(primal, value)) failures.push(`the value ${toString(value)} is not c x = ${toString(primal)}`);
  if (!equals(primal, dual)) failures.push(`strong duality fails: c x = ${toString(primal)} and b y = ${toString(dual)}`);
}

function checkInfeasible(program: LinearProgram, y: Vector, failures: string[]): void {
  const m = program.constraints.length;
  if (y.length !== m) {
    failures.push(`the ray has ${y.length} entries, and the program has ${m} rows`);
    return;
  }
  checkMultiplierSigns(program, y, 1, "ray", failures);
  columnSums(program, y).forEach((sum, j) => {
    if (sign(sum) < 0) failures.push(`(yA)[${j}] = ${toString(sum)} is negative`);
  });
  const by = dot(
    program.constraints.map((c) => c.rhs),
    y,
  );
  if (sign(by) >= 0) failures.push(`b y = ${toString(by)} is not negative`);
}

function checkUnbounded(program: LinearProgram, x: Vector, d: Vector, failures: string[]): void {
  checkFeasible(program, x, failures);
  if (d.length !== program.objective.length) {
    failures.push(`the direction has ${d.length} entries, and the program has ${program.objective.length} variables`);
    return;
  }
  d.forEach((v, j) => {
    if (sign(v) < 0) failures.push(`direction[${j}] = ${toString(v)} is negative`);
  });
  program.constraints.forEach((c, i) => {
    const ad = dot(c.coefficients, d);
    if (!holds(sign(ad), c.relation)) failures.push(`row ${i}: the direction gives ${toString(ad)}, so it leaves the row`);
  });
  const gain = dot(program.objective, d);
  const s = program.sense === "max" ? 1 : -1;
  if (sign(gain) * s <= 0) failures.push(`the direction does not improve the objective: c d = ${toString(gain)}`);
}

/**
 * This function examines the certificate of a result with exact arithmetic. It does not trust the solver.
 *
 * - `optimal`: the point is feasible, the dual is feasible, `c x = b y` and complementary slackness holds. For a maximization,
 *   the dual obeys `y A >= c`, `y_i >= 0` on a `<=` row and `y_i <= 0` on a `>=` row. A minimization swaps each of these signs.
 * - `infeasible`: the ray obeys `y A >= 0`, `b y < 0`, `y_i >= 0` on a `<=` row and `y_i <= 0` on a `>=` row. Then no `x >= 0`
 *   meets the rows, because `0 <= y A x <= y b < 0`.
 * - `unbounded`: the point is feasible, the direction is not negative, each row keeps its relation along it, and the
 *   direction improves the objective.
 */
export function checkCertificate(program: LinearProgram, result: LinearProgramResult): CertificateCheck {
  const failures: string[] = [];
  if (program.constraints.some((c) => c.coefficients.length !== program.objective.length)) {
    failures.push("a constraint row has a length that is not the count of variables");
  } else if (result.status === "optimal") {
    checkOptimal(program, result.x, result.value, result.dual, failures);
  } else if (result.status === "infeasible") {
    checkInfeasible(program, result.ray, failures);
  } else {
    checkUnbounded(program, result.x, result.direction, failures);
  }
  return { valid: failures.length === 0, failures };
}
