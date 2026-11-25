import { add, compare, equals, floor, isInteger, mul, neg, ONE, type Rational, rational, sub, ZERO } from "@mark1russell7/rational";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bruteForce, feasible, programs, RUNS } from "./brute.test-helper.ts";
import {
  checkIntegerCertificate,
  dot,
  type IntegerProgram,
  type IntegerProgramResult,
  type LinearProgram,
  linearProgram,
  solveIntegerProgram,
  solveLinearProgram,
  vector,
} from "./index.ts";

/** The upper bound of each variable in the families with a box. */
const BOX = 3;

/** This function gives an integer program from the inputs of `linearProgram` and the list of the integer variables. */
function integerProgram(input: Parameters<typeof linearProgram>[0], integer: readonly number[]): IntegerProgram {
  return { ...linearProgram(input), integer };
}

/** This function gives the program with the row `x_j <= BOX` for each variable. */
function boxed(program: LinearProgram): LinearProgram {
  const n = program.objective.length;
  const box = Array.from({ length: n }, (_, j) => ({ coefficients: Array.from({ length: n }, (_, k) => (k === j ? ONE : ZERO)), relation: "<=" as const, rhs: rational(BigInt(BOX)) }));
  return { ...program, constraints: [...program.constraints, ...box] };
}

/** This function expects a valid certificate, and gives the result. */
function solved(program: IntegerProgram, nodeLimit?: number): IntegerProgramResult {
  const result = solveIntegerProgram(program, nodeLimit === undefined ? {} : { nodeLimit });
  const check = checkIntegerCertificate(program, result);
  if (!check.valid) throw new Error(check.failures.join("; "));
  return result;
}

/** The verdict of the enumeration: the status and the optimal value. */
type Enumerated = { readonly status: "optimal"; readonly value: Rational } | { readonly status: "infeasible" };

/**
 * This function solves a program in the box by enumeration. It fixes the integer variables at each integer point of the box. It
 * enumerates the vertices of the rest with `bruteForce`. It does not use the simplex.
 */
function enumerate(program: IntegerProgram): Enumerated {
  const n = program.objective.length;
  const integer = [...new Set(program.integer)].sort((a, b) => a - b);
  const rest = Array.from({ length: n }, (_, j) => j).filter((j) => !integer.includes(j));
  const s = program.sense === "max" ? 1 : -1;
  let best: Rational | undefined;
  const points: number[][] = [[]];
  for (let k = 0; k < integer.length; k++) {
    const next: number[][] = [];
    for (const p of points) for (let v = 0; v <= BOX; v++) next.push([...p, v]);
    points.splice(0, points.length, ...next);
  }
  for (const p of points) {
    const fixed = new Map(integer.map((j, k) => [j, rational(BigInt(p[k] as number))]));
    const offset = integer.reduce((sum, j) => add(sum, mul(program.objective[j] as Rational, fixed.get(j) as Rational)), ZERO);
    let value: Rational | undefined;
    if (rest.length === 0) {
      const x = Array.from({ length: n }, (_, j) => fixed.get(j) as Rational);
      if (feasible(program.constraints, x)) value = offset;
    } else {
      const reduced: LinearProgram = {
        sense: program.sense,
        objective: rest.map((j) => program.objective[j] as Rational),
        constraints: program.constraints.map((c) => ({
          coefficients: rest.map((j) => c.coefficients[j] as Rational),
          relation: c.relation,
          rhs: integer.reduce((rhs, j) => sub(rhs, mul(c.coefficients[j] as Rational, fixed.get(j) as Rational)), c.rhs),
        })),
      };
      const oracle = bruteForce(reduced);
      if (oracle.status === "unbounded") throw new Error("the box leaves a continuous variable with no bound");
      if (oracle.status === "optimal") value = add(oracle.value, offset);
    }
    if (value !== undefined && (best === undefined || compare(value, best) * s > 0)) best = value;
  }
  return best === undefined ? { status: "infeasible" } : { status: "optimal", value: best };
}

describe("integer programs", () => {
  it("gives the integer optimum where the relaxation is fractional", () => {
    const program = integerProgram(
      {
        sense: "max",
        objective: [5, 4],
        constraints: [
          { coefficients: [6, 4], relation: "<=", rhs: 24 },
          { coefficients: [1, 2], relation: "<=", rhs: 6 },
        ],
      },
      [0, 1],
    );
    const relaxation = solveLinearProgram(program);
    expect(relaxation).toMatchObject({ status: "optimal", x: vector([3, "3/2"]), value: rational(21n) });
    expect(solved(program)).toMatchObject({ status: "optimal", x: vector([4, 0]), value: rational(20n) });
  });

  it("keeps a continuous variable fractional in a mixed program", () => {
    const program = integerProgram(
      {
        sense: "max",
        objective: [1, 1],
        constraints: [
          { coefficients: [2, 3], relation: "<=", rhs: 7 },
          { coefficients: [1, 0], relation: "<=", rhs: "3/2" },
        ],
      },
      [0],
    );
    expect(solved(program)).toMatchObject({ status: "optimal", x: vector([1, "5/3"]), value: rational(8n, 3n) });
  });

  it("proves that a line with a feasible relaxation has no integer point", () => {
    const program = integerProgram({ sense: "max", objective: [1], constraints: [{ coefficients: [2], relation: "=", rhs: 1 }] }, [0]);
    const result = solved(program);
    expect(result.status).toBe("infeasible");
    if (result.status === "infeasible") expect(result.tree.map((node) => node.outcome)).toEqual(["branched", "infeasible", "infeasible"]);
  });

  it("gives an integer point and an integer direction for an unbounded program", () => {
    const program = integerProgram({ sense: "max", objective: [1, 1], constraints: [{ coefficients: [2, -3], relation: "=", rhs: 1 }] }, [0, 1]);
    const result = solved(program);
    expect(result.status).toBe("unbounded");
    if (result.status === "unbounded") {
      expect(result.x.every(isInteger)).toBe(true);
      expect(result.direction.every(isInteger)).toBe(true);
    }
  });

  it("stops at the limit on a line with no integer point and no bound of its relaxation", () => {
    // The relaxation is unbounded. The search for one integer point goes up the line x - y = 1/2 with no end.
    const program = integerProgram({ sense: "max", objective: [1, 0], constraints: [{ coefficients: [2, -2], relation: "=", rhs: 1 }] }, [0, 1]);
    const result = solved(program, 30);
    expect(result).toMatchObject({ status: "limit", x: undefined, value: undefined, bound: undefined });
  });

  it("gives a proved bound at the limit", () => {
    const program = integerProgram(
      {
        sense: "max",
        objective: [5, 4],
        constraints: [
          { coefficients: [6, 4], relation: "<=", rhs: 24 },
          { coefficients: [1, 2], relation: "<=", rhs: 6 },
        ],
      },
      [0, 1],
    );
    expect(solved(program, 1)).toMatchObject({ status: "limit", x: undefined, bound: rational(21n) });
  });

  it("refuses each changed certificate", () => {
    const knapsack = integerProgram(
      {
        sense: "max",
        objective: [5, 4],
        constraints: [
          { coefficients: [6, 4], relation: "<=", rhs: 24 },
          { coefficients: [1, 2], relation: "<=", rhs: 6 },
        ],
      },
      [0, 1],
    );
    const optimal = solved(knapsack);
    if (optimal.status !== "optimal") throw new Error("the knapsack has an optimum");
    const refused = (result: IntegerProgramResult): boolean => !checkIntegerCertificate(knapsack, result).valid;
    expect(refused({ ...optimal, value: add(optimal.value, ONE) })).toBe(true);
    expect(refused({ ...optimal, x: vector([3, 1]), value: rational(19n) })).toBe(true);
    expect(refused({ ...optimal, tree: optimal.tree.slice(0, -1) })).toBe(true);
    expect(refused({ status: "infeasible", tree: optimal.tree })).toBe(true);

    const mixed = integerProgram({ sense: "max", objective: [1, 1], constraints: [{ coefficients: [2, 3], relation: "<=", rhs: 7 }, { coefficients: [1, 0], relation: "<=", rhs: "3/2" }] }, [0]);
    const relaxed = solveLinearProgram(mixed);
    if (relaxed.status !== "optimal") throw new Error("the relaxation has an optimum");
    expect(checkIntegerCertificate(mixed, { status: "optimal", x: relaxed.x, value: relaxed.value, tree: [{ parent: undefined, branch: undefined, outcome: "integer", result: relaxed }] }).valid).toBe(false);

    const line = integerProgram({ sense: "max", objective: [1, 1], constraints: [{ coefficients: [2, -3], relation: "=", rhs: 1 }] }, [0, 1]);
    const unbounded = solved(line);
    if (unbounded.status !== "unbounded") throw new Error("the line is unbounded");
    expect(checkIntegerCertificate(line, { ...unbounded, direction: unbounded.direction.map(neg) }).valid).toBe(false);
  });

  it("refuses a variable that is not in the program, and a limit that is not a count", () => {
    const program = integerProgram({ sense: "max", objective: [1], constraints: [] }, [1]);
    expect(() => solveIntegerProgram(program)).toThrow(RangeError);
    expect(() => solveIntegerProgram({ ...program, integer: [0] }, { nodeLimit: 0 })).toThrow(RangeError);
  });
});

const integerFamily = programs({ equalities: true }).map((program): IntegerProgram => ({ ...boxed(program), integer: program.objective.map((_, j) => j) }));
const mixedFamily = programs({ equalities: true })
  .filter((program) => program.objective.length >= 2)
  .chain((program) =>
    fc
      .subarray(
        program.objective.map((_, j) => j),
        { minLength: 1, maxLength: program.objective.length - 1 },
      )
      .map((integer): IntegerProgram => ({ ...boxed(program), integer })),
  );
const openFamily = programs({ equalities: true }).map((program): IntegerProgram => ({ ...program, integer: program.objective.map((_, j) => j) }));

describe.each([
  ["integer programs in a box", integerFamily],
  ["mixed programs in a box", mixedFamily],
] as const)("branch and bound on %s", (_name, family) => {
  it("gives a valid certificate, and the status and value of the enumeration", () => {
    const seen = { optimal: 0, infeasible: 0 };
    fc.assert(
      fc.property(family, (program) => {
        const result = solved(program);
        const oracle = enumerate(program);
        if (result.status !== "optimal" && result.status !== "infeasible") return false;
        seen[result.status]++;
        return oracle.status === result.status && (oracle.status !== "optimal" || (result.status === "optimal" && equals(oracle.value, result.value)));
      }),
      RUNS,
    );
    expect(seen.optimal).toBeGreaterThan(0);
    expect(seen.infeasible).toBeGreaterThan(0);
  });

  it("refuses a changed value or a tree with no last node", () => {
    fc.assert(
      fc.property(family, (program) => {
        const result = solveIntegerProgram(program);
        if (result.status === "optimal" && checkIntegerCertificate(program, { ...result, value: add(result.value, ONE) }).valid) return false;
        if ((result.status === "optimal" || result.status === "infeasible") && result.tree.length > 1) {
          if (checkIntegerCertificate(program, { ...result, tree: result.tree.slice(0, -1) }).valid) return false;
        }
        return true;
      }),
      RUNS,
    );
  });
});

describe("the base: the optimum of the relaxation, rounded down", () => {
  it("misses the integer optimum on some programs in a box", () => {
    let wrong = 0;
    fc.assert(
      fc.property(integerFamily, (program) => {
        const oracle = enumerate(program);
        const relaxation = solveLinearProgram(program);
        if (oracle.status !== "optimal" || relaxation.status !== "optimal") return true;
        const x = relaxation.x.map(floor);
        if (!feasible(program.constraints, x) || !equals(dot(program.objective, x), oracle.value)) wrong++;
        return true;
      }),
      RUNS,
    );
    expect(wrong).toBeGreaterThan(0);
  });
});

describe("branch and bound on programs with no box", () => {
  it("gives a valid certificate for each status", () => {
    const seen = { optimal: 0, infeasible: 0, unbounded: 0, limit: 0 };
    fc.assert(
      fc.property(openFamily, (program) => {
        const result = solved(program, 30);
        seen[result.status]++;
        if (result.status === "unbounded") return !checkIntegerCertificate(program, { ...result, direction: result.direction.map(neg) }).valid;
        return true;
      }),
      RUNS,
    );
    expect(seen.optimal).toBeGreaterThan(0);
    expect(seen.infeasible).toBeGreaterThan(0);
    expect(seen.unbounded).toBeGreaterThan(0);
  }, 30_000);
});
