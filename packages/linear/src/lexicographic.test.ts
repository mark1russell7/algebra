import { equals, rational } from "@mark1russell7/rational";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bruteForce, programs, RUNS } from "./brute.test-helper.ts";
import { checkCertificate, dot, linearProgram, type Objective, solveLexicographic, vector } from "./index.ts";

describe("lexicographic objectives", () => {
  it("breaks a tie of the first objective with the second", () => {
    const { constraints } = linearProgram({
      sense: "max",
      objective: [0, 0],
      constraints: [
        { coefficients: [1, 1], relation: "<=", rhs: 4 },
        { coefficients: [1, 0], relation: "<=", rhs: 3 },
      ],
    });
    const objectives: Objective[] = [
      { sense: "max", coefficients: vector([1, 1]) },
      { sense: "min", coefficients: vector([1, 0]) },
    ];
    const r = solveLexicographic(constraints, objectives);
    expect(r).toMatchObject({ status: "optimal", x: vector([0, 4]), values: [rational(4n), rational(0n)] });
    for (const stage of r.stages) expect(checkCertificate(stage.program, stage.result).valid).toBe(true);
  });

  it("stops at a stage with no optimum", () => {
    const objectives: Objective[] = [
      { sense: "max", coefficients: vector([1, 0]) },
      { sense: "max", coefficients: vector([0, 1]) },
    ];
    const rows = linearProgram({ sense: "max", objective: [0, 0], constraints: [{ coefficients: [1, 0], relation: "<=", rhs: 2 }] }).constraints;
    const r = solveLexicographic(rows, objectives);
    expect(r.status).toBe("unbounded");
    expect(r.stages).toHaveLength(2);
    expect(() => solveLexicographic(rows, [])).toThrow(RangeError);
  });

  it("gives a valid certificate at each stage, the optimum of the enumeration, and holds each earlier optimum", () => {
    const cases = programs({ equalities: true }).chain((p) =>
      fc.tuple(
        fc.constant(p),
        fc.array(fc.integer({ min: -3, max: 3 }).map((k) => rational(BigInt(k))), {
          minLength: p.objective.length,
          maxLength: p.objective.length,
        }),
        fc.constantFrom<"max" | "min">("max", "min"),
      ),
    );
    fc.assert(
      fc.property(cases, ([p, second, sense]) => {
        const objectives: Objective[] = [
          { sense: p.sense, coefficients: p.objective },
          { sense, coefficients: second },
        ];
        const r = solveLexicographic(p.constraints, objectives);
        for (const stage of r.stages) {
          const check = checkCertificate(stage.program, stage.result);
          if (!check.valid) throw new Error(check.failures.join("; "));
          const oracle = bruteForce(stage.program);
          if (oracle.status !== stage.result.status) return false;
          if (oracle.status === "optimal" && stage.result.status === "optimal" && !equals(oracle.value, stage.result.value)) return false;
        }
        if (r.status !== "optimal") return true;
        return objectives.every((o, k) => equals(dot(o.coefficients, r.x), r.values[k]!));
      }),
      RUNS,
    );
  });
});
