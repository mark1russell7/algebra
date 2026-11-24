/**
 * Lexicographic objectives: a list of objectives, each optimized in turn while the earlier optima stay as equalities.
 *
 * @packageDocumentation
 */
import type { Rational } from "@mark1russell7/rational";
import type { Constraint, LinearProgram, LinearProgramResult, Sense } from "./program.ts";
import { solveLinearProgram } from "./simplex.ts";
import type { Vector } from "./vector.ts";

/** One objective of a lexicographic program. */
export interface Objective {
  readonly sense: Sense;
  readonly coefficients: Vector;
}

/** One stage of a lexicographic solve: its program, with the earlier optima as equality rows, and its result with a certificate. */
export interface LexicographicStage {
  readonly program: LinearProgram;
  readonly result: LinearProgramResult;
}

/**
 * The result of `solveLexicographic`. The status `optimal` gives the last point and the optimum of each objective. The status
 * `infeasible` or `unbounded` comes from the last stage, and its result has the certificate. `checkCertificate` examines each
 * stage with its program.
 */
export type LexicographicResult =
  | { readonly status: "optimal"; readonly x: Vector; readonly values: readonly Rational[]; readonly stages: readonly LexicographicStage[] }
  | { readonly status: "infeasible" | "unbounded"; readonly stages: readonly LexicographicStage[] };

/**
 * This function optimizes the objectives in their order, subject to the constraint rows and `x >= 0`. Stage `k` holds the
 * optimum of each earlier objective as an equality row. The function stops at the first stage with no optimum.
 * Only the first stage can be infeasible. A later stage can be unbounded after optimal stages, because its objective is new.
 *
 * @throws {RangeError} The list of objectives is empty, or a row has a length that is not the length of the first objective.
 */
export function solveLexicographic(constraints: readonly Constraint[], objectives: readonly Objective[]): LexicographicResult {
  if (objectives.length === 0) throw new RangeError("linear: a lexicographic program needs one objective or more");
  const stages: LexicographicStage[] = [];
  const rows: Constraint[] = [...constraints];
  const values: Rational[] = [];
  let x: Vector = [];
  for (const objective of objectives) {
    const program: LinearProgram = { sense: objective.sense, objective: objective.coefficients, constraints: [...rows] };
    const result = solveLinearProgram(program);
    stages.push({ program, result });
    if (result.status !== "optimal") return { status: result.status, stages };
    x = result.x;
    values.push(result.value);
    rows.push({ coefficients: objective.coefficients, relation: "=", rhs: result.value });
  }
  return { status: "optimal", x, values, stages };
}
