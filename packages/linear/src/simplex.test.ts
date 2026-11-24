import { rational, ZERO } from "@mark1russell7/rational";
import { describe, expect, it } from "vitest";
import { bruteForce } from "./brute.test-helper.ts";
import { checkCertificate, type LinearProgram, type LinearProgramResult, linearProgram, solveLinearProgram, vector } from "./index.ts";
import { runSimplex } from "./simplex.ts";

/** This function solves a program and expects a valid certificate. */
function solved(program: LinearProgram): LinearProgramResult {
  const result = solveLinearProgram(program);
  expect(checkCertificate(program, result)).toEqual({ valid: true, failures: [] });
  return result;
}

/** The cycling example of Chvátal (Linear Programming, 1983, chapter 3). */
const chvatal = linearProgram({
  sense: "max",
  objective: [10, -57, -9, -24],
  constraints: [
    { coefficients: ["1/2", "-11/2", "-5/2", 9], relation: "<=", rhs: 0 },
    { coefficients: ["1/2", "-3/2", "-1/2", 1], relation: "<=", rhs: 0 },
    { coefficients: [1, 0, 0, 0], relation: "<=", rhs: 1 },
  ],
});

/** The cycling example of Beale (1955). */
const beale = linearProgram({
  sense: "min",
  objective: ["-3/4", 150, "-1/50", 6],
  constraints: [
    { coefficients: ["1/4", -60, "-1/25", 9], relation: "<=", rhs: 0 },
    { coefficients: ["1/2", -90, "-1/50", 3], relation: "<=", rhs: 0 },
    { coefficients: [0, 0, 1, 0], relation: "<=", rhs: 1 },
  ],
});

describe("the simplex on known programs", () => {
  it("solves a textbook maximization", () => {
    const p = linearProgram({
      sense: "max",
      objective: [3, 5],
      constraints: [
        { coefficients: [1, 0], relation: "<=", rhs: 4 },
        { coefficients: [0, 2], relation: "<=", rhs: 12 },
        { coefficients: [3, 2], relation: "<=", rhs: 18 },
      ],
    });
    const r = solved(p);
    expect(r).toEqual({ status: "optimal", x: vector([2, 6]), value: rational(36n), dual: vector([0, "3/2", 1]) });
  });

  it("solves a minimization with >= and = rows and a negative right side", () => {
    const p = linearProgram({
      sense: "min",
      objective: [2, 3, 1],
      constraints: [
        { coefficients: [1, 1, 0], relation: ">=", rhs: 4 },
        { coefficients: [0, 1, 1], relation: "=", rhs: 3 },
        { coefficients: [-1, 0, -1], relation: "<=", rhs: -1 },
      ],
    });
    const r = solved(p);
    expect(r.status).toBe("optimal");
    expect(bruteForce(p)).toEqual({ status: "optimal", value: r.status === "optimal" ? r.value : ZERO });
  });

  it("gives a Farkas ray for an infeasible program", () => {
    const p = linearProgram({
      sense: "max",
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 1], relation: "<=", rhs: 1 },
        { coefficients: [1, 1], relation: ">=", rhs: 2 },
      ],
    });
    expect(solved(p).status).toBe("infeasible");
  });

  it("gives a point and a direction for an unbounded program", () => {
    const p = linearProgram({
      sense: "max",
      objective: [1, -1],
      constraints: [{ coefficients: [1, -2], relation: "<=", rhs: 2 }],
    });
    expect(solved(p).status).toBe("unbounded");
  });

  it("solves a program with no rows", () => {
    expect(solved(linearProgram({ sense: "min", objective: [1, 2], constraints: [] }))).toEqual({
      status: "optimal",
      x: [ZERO, ZERO],
      value: ZERO,
      dual: [],
    });
    expect(solved(linearProgram({ sense: "max", objective: [0, 1], constraints: [] })).status).toBe("unbounded");
  });

  it("keeps a redundant equality row", () => {
    const p = linearProgram({
      sense: "max",
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 1], relation: "=", rhs: 2 },
        { coefficients: [2, 2], relation: "=", rhs: 4 },
        { coefficients: [0, 1], relation: "<=", rhs: 1 },
      ],
    });
    expect(solved(p)).toMatchObject({ status: "optimal", value: rational(3n) });
  });

  it("solves a free variable as the difference of two variables", () => {
    // min v subject to v >= -3, with v = p - q.
    const p = linearProgram({ sense: "min", objective: [1, -1], constraints: [{ coefficients: [1, -1], relation: ">=", rhs: -3 }] });
    expect(solved(p)).toMatchObject({ status: "optimal", value: rational(-3n) });
  });

  it("refuses a row with the wrong length", () => {
    expect(() => linearProgram({ sense: "max", objective: [1, 2], constraints: [{ coefficients: [1], relation: "<=", rhs: 1 }] })).toThrow(RangeError);
  });
});

describe("degenerate programs that cycle under the largest coefficient", () => {
  it("ends on the example of Chvátal under the rule of Bland", () => {
    const r = solved(chvatal);
    expect(r).toMatchObject({ status: "optimal", value: rational(1n), x: vector([1, 0, 1, 0]) });
    expect(runSimplex(chvatal, "largest").cycled).toBe(true);
  });

  it("ends on the example of Beale under the rule of Bland", () => {
    const r = solved(beale);
    expect(r).toMatchObject({ status: "optimal", value: rational(-1n, 20n), x: vector(["1/25", 0, 1, 0]) });
    expect(runSimplex(beale, "largest").cycled).toBe(true);
  });
});

describe("checkCertificate refuses changed certificates", () => {
  const p = linearProgram({
    sense: "max",
    objective: [3, 5],
    constraints: [
      { coefficients: [1, 0], relation: "<=", rhs: 4 },
      { coefficients: [0, 2], relation: "<=", rhs: 12 },
      { coefficients: [3, 2], relation: "<=", rhs: 18 },
    ],
  });

  it("refuses a moved point, a moved dual and a wrong value", () => {
    const r = solveLinearProgram(p);
    if (r.status !== "optimal") throw new Error("expected an optimum");
    expect(checkCertificate(p, { ...r, x: vector([2, 5]) }).valid).toBe(false);
    expect(checkCertificate(p, { ...r, dual: vector([1, "3/2", 1]) }).valid).toBe(false);
    expect(checkCertificate(p, { ...r, dual: vector([0, 0, "5/2"]) }).valid).toBe(false);
    expect(checkCertificate(p, { ...r, value: rational(37n) }).valid).toBe(false);
    expect(checkCertificate(p, { ...r, dual: vector([0, 1]) }).valid).toBe(false);
  });

  it("refuses a false ray and a false direction", () => {
    expect(checkCertificate(p, { status: "infeasible", ray: vector([0, 0, 0]) }).valid).toBe(false);
    expect(checkCertificate(p, { status: "infeasible", ray: vector([1, 1, 1]) }).valid).toBe(false);
    expect(checkCertificate(p, { status: "unbounded", x: vector([0, 0]), direction: vector([1, 0]) }).valid).toBe(false);
    expect(checkCertificate(p, { status: "unbounded", x: vector([5, 0]), direction: vector([0, 0]) }).valid).toBe(false);
  });
});
