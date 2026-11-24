import { add, equals, neg, ONE, sign } from "@mark1russell7/rational";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bruteForce, programs, RUNS } from "./brute.test-helper.ts";
import { checkCertificate, type LinearProgram, type LinearProgramResult, solveLinearProgram } from "./index.ts";

/** This function tells if the simplex and the oracle agree on the status and on the optimal value. */
function agrees(program: LinearProgram, result: LinearProgramResult): boolean {
  const oracle = bruteForce(program);
  if (oracle.status !== result.status) return false;
  return oracle.status !== "optimal" || (result.status === "optimal" && equals(oracle.value, result.value));
}

/**
 * This function gives changed certificates that are false by proof. A new value, or a moved point with `c_j != 0`, breaks
 * `value = c x`. A moved dual entry with `b_i != 0` breaks `c x = b y`. A negated ray gives `b y > 0`. A negated direction
 * makes the objective worse.
 */
function mutants(program: LinearProgram, result: LinearProgramResult): LinearProgramResult[] {
  if (result.status === "optimal") {
    const out: LinearProgramResult[] = [{ ...result, value: add(result.value, ONE) }];
    const j = program.objective.findIndex((c) => sign(c) !== 0);
    if (j >= 0) out.push({ ...result, x: result.x.map((v, k) => (k === j ? add(v, ONE) : v)) });
    const i = program.constraints.findIndex((c) => sign(c.rhs) !== 0);
    if (i >= 0) out.push({ ...result, dual: result.dual.map((v, k) => (k === i ? add(v, ONE) : v)) });
    return out;
  }
  if (result.status === "infeasible") return [{ ...result, ray: result.ray.map(neg) }];
  return [{ ...result, direction: result.direction.map(neg) }];
}

const families = [
  ["small random programs", programs()],
  ["programs with equality rows", programs({ equalities: true })],
  ["degenerate programs", programs({ degenerate: true, equalities: true })],
] as const;

describe.each(families)("the simplex on %s", (_name, family) => {
  it("gives a certificate that checkCertificate accepts, and the status and value of the vertex enumeration", () => {
    const seen = { optimal: 0, infeasible: 0, unbounded: 0 };
    fc.assert(
      fc.property(family, (program) => {
        const result = solveLinearProgram(program);
        seen[result.status]++;
        const check = checkCertificate(program, result);
        if (!check.valid) throw new Error(check.failures.join("; "));
        return agrees(program, result);
      }),
      RUNS,
    );
    expect(seen.optimal).toBeGreaterThan(0);
    expect(seen.infeasible).toBeGreaterThan(0);
    expect(seen.unbounded).toBeGreaterThan(0);
  });

  it("refuses each changed certificate", () => {
    fc.assert(
      fc.property(family, (program) => mutants(program, solveLinearProgram(program)).every((m) => !checkCertificate(program, m).valid)),
      RUNS,
    );
  });
});
