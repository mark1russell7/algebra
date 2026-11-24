/**
 * Linear programs as data, and their results with certificates.
 *
 * @packageDocumentation
 */
import type { Rational } from "@mark1russell7/rational";
import { type RationalInput, type Vector, toRational, vector } from "./vector.ts";

/** The direction of an objective: `"max"` to maximize it, `"min"` to minimize it. */
export type Sense = "max" | "min";

/** The relation of a constraint row to its right side. */
export type Relation = "<=" | ">=" | "=";

/** One constraint row: `coefficients · x` has the relation `relation` to `rhs`. */
export interface Constraint {
  readonly coefficients: Vector;
  readonly relation: Relation;
  readonly rhs: Rational;
}

/**
 * A linear program: optimize `objective · x` subject to the constraint rows and `x >= 0`. Each variable has the lower bound 0.
 * A free variable `v` is the difference of two variables `p - q`. Copy each coefficient of `v` to `p`. Put its negative on `q`.
 */
export interface LinearProgram {
  readonly sense: Sense;
  readonly objective: Vector;
  readonly constraints: readonly Constraint[];
}

/**
 * The result of a linear program, with its certificate.
 *
 * - `optimal`: the point `x`, its value `objective · x`, and a dual vector `dual` with one entry for each constraint row.
 * - `infeasible`: a Farkas ray `ray` with one entry for each constraint row. `checkCertificate` tells its conditions.
 * - `unbounded`: a feasible point `x` and a direction `direction`. Each point `x + t direction` with `t >= 0` is feasible, and
 *   the objective improves without limit along it.
 */
export type LinearProgramResult =
  | { readonly status: "optimal"; readonly x: Vector; readonly value: Rational; readonly dual: Vector }
  | { readonly status: "infeasible"; readonly ray: Vector }
  | { readonly status: "unbounded"; readonly x: Vector; readonly direction: Vector };

/** One constraint row of `linearProgram`, with inputs that `toRational` reads. */
export interface ConstraintInput {
  readonly coefficients: readonly RationalInput[];
  readonly relation: Relation;
  readonly rhs: RationalInput;
}

/** A linear program with inputs that `toRational` reads. */
export interface LinearProgramInput {
  readonly sense: Sense;
  readonly objective: readonly RationalInput[];
  readonly constraints: readonly ConstraintInput[];
}

/**
 * This function makes a linear program from inputs that `toRational` reads, and examines its shape.
 *
 * @throws {RangeError} A constraint row has a length that is not the length of the objective.
 */
export function linearProgram(input: LinearProgramInput): LinearProgram {
  const program: LinearProgram = {
    sense: input.sense,
    objective: vector(input.objective),
    constraints: input.constraints.map((c) => ({ coefficients: vector(c.coefficients), relation: c.relation, rhs: toRational(c.rhs) })),
  };
  checkShape(program);
  return program;
}

/**
 * This function examines the shape of a program: each constraint row has one coefficient for each variable.
 *
 * @throws {RangeError} A constraint row has a length that is not the length of the objective.
 */
export function checkShape(program: LinearProgram): void {
  const n = program.objective.length;
  program.constraints.forEach((c, i) => {
    if (c.coefficients.length !== n) {
      throw new RangeError(`linear: constraint ${i} has ${c.coefficients.length} coefficients, and the objective has ${n}`);
    }
  });
}
