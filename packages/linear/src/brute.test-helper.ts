/**
 * An independent oracle for small programs: the enumeration of each vertex and each extreme ray, and the generators of the
 * seeded program families.
 */
import { type Rational, compare, ONE, rational, sign, sub, ZERO } from "@mark1russell7/rational";
import fc from "fast-check";
import { solve } from "./matrix.ts";
import type { Constraint, LinearProgram, Relation } from "./program.ts";
import { dot, type Vector } from "./vector.ts";

/** The count of cases of each property. The variable `PROPERTY_RUNS` sets it. The seed is fixed, so each run is the same. */
export const RUNS: { readonly numRuns: number; readonly seed: number } = { numRuns: Number(environment()["PROPERTY_RUNS"] ?? 300), seed: 0x1a30 };

/** This function gives the environment variables of the process. The build config has no Node types, so it reads them from `globalThis`. */
function environment(): Readonly<Record<string, string | undefined>> {
  return (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
}

/** This function tells if `x >= 0` meets each row. */
export function feasible(rows: readonly Constraint[], x: Vector): boolean {
  if (x.some((v) => sign(v) < 0)) return false;
  return rows.every((c) => {
    const s = sign(sub(dot(c.coefficients, x), c.rhs));
    return c.relation === "=" ? s === 0 : c.relation === "<=" ? s <= 0 : s >= 0;
  });
}

/** This function gives each subset of `k` of the numbers `0` to `n - 1`. */
function subsets(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let first = 0; first <= n - k; first++) {
    for (const rest of subsets(n - first - 1, k - 1)) out.push([first, ...rest.map((r) => r + first + 1)]);
  }
  return out;
}

/**
 * This function gives each vertex of `{ x >= 0 : rows }`. A vertex is the unique solution of `n` tight constraints, from the
 * rows and the bounds `x_j = 0`, that meets each row.
 */
export function vertices(rows: readonly Constraint[], n: number): Vector[] {
  const candidates: { a: Vector; b: Rational }[] = [
    ...rows.map((c) => ({ a: c.coefficients, b: c.rhs })),
    ...Array.from({ length: n }, (_, j) => ({ a: Array.from({ length: n }, (_, k) => (k === j ? ONE : ZERO)), b: ZERO })),
  ];
  const found = new Map<string, Vector>();
  for (const pick of subsets(candidates.length, n)) {
    const a = pick.map((i) => candidates[i]!.a);
    const b = pick.map((i) => candidates[i]!.b);
    const s = solve(a, b, n);
    if (s.status !== "solved" || s.nullSpace.length > 0) continue;
    if (feasible(rows, s.x)) found.set(s.x.map((v) => `${v.n}/${v.d}`).join(","), s.x);
  }
  return [...found.values()];
}

/** The verdict of the oracle. */
export type Oracle = { readonly status: "optimal"; readonly value: Rational } | { readonly status: "infeasible" | "unbounded" };

/**
 * This function solves a small program by enumeration. The set `{ x >= 0 : rows }` has a vertex when it is not empty. The
 * program is unbounded when a vertex of `{ d >= 0 : rows with right side 0, sum d = 1 }` improves the objective.
 */
export function bruteForce(program: LinearProgram): Oracle {
  const n = program.objective.length;
  const points = vertices(program.constraints, n);
  if (points.length === 0) return { status: "infeasible" };
  const s = program.sense === "max" ? 1 : -1;
  const cone: Constraint[] = [
    ...program.constraints.map((c) => ({ ...c, rhs: ZERO })),
    { coefficients: Array.from({ length: n }, () => ONE), relation: "=", rhs: ONE },
  ];
  if (vertices(cone, n).some((d) => sign(dot(program.objective, d)) * s > 0)) return { status: "unbounded" };
  let best = dot(program.objective, points[0]!);
  for (const p of points) {
    const v = dot(program.objective, p);
    if (compare(v, best) * s > 0) best = v;
  }
  return { status: "optimal", value: best };
}

const small = (zeroWeight: number): fc.Arbitrary<Rational> =>
  fc.oneof(
    { weight: zeroWeight, arbitrary: fc.constant(ZERO) },
    { weight: 6, arbitrary: fc.integer({ min: -4, max: 4 }).map((k) => rational(BigInt(k))) },
    { weight: 1, arbitrary: fc.tuple(fc.integer({ min: -5, max: 5 }), fc.integer({ min: 1, max: 4 })).map(([p, q]) => rational(BigInt(p), BigInt(q))) },
  );

const relation = (equalities: boolean): fc.Arbitrary<Relation> =>
  equalities ? fc.constantFrom<Relation>("<=", ">=", "=") : fc.constantFrom<Relation>("<=", "<=", ">=");

/**
 * This function gives an arbitrary small program. With `equalities`, rows can be `=`. With `degenerate`, many right sides
 * are 0, so many bases have the same point.
 */
export function programs(options: { readonly equalities?: boolean; readonly degenerate?: boolean } = {}): fc.Arbitrary<LinearProgram> {
  const rhsZero = options.degenerate ? 6 : 1;
  return fc.tuple(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 0, max: 4 })).chain(([n, m]) =>
    fc.record({
      sense: fc.constantFrom<"max" | "min">("max", "min"),
      objective: fc.array(small(1), { minLength: n, maxLength: n }),
      constraints: fc.array(
        fc.record({
          coefficients: fc.array(small(2), { minLength: n, maxLength: n }),
          relation: relation(options.equalities ?? false),
          rhs: small(rhsZero),
        }),
        { minLength: m, maxLength: m },
      ),
    }),
  );
}
