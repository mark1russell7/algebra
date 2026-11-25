/**
 * Integer programs: branch and bound on the exact simplex. The certificate of a result is the tree of its nodes.
 *
 * @packageDocumentation
 */
import { type Rational, add, compare, equals, floor, gcd, isInteger, ONE, rational, toString, ZERO } from "@mark1russell7/rational";
import { type CertificateCheck, checkCertificate, checkFeasible } from "./certificate.ts";
import { checkShape, type Constraint, type LinearProgram, type LinearProgramResult } from "./program.ts";
import { solveLinearProgram } from "./simplex.ts";
import { dot, type Vector } from "./vector.ts";

/** A linear program in which each variable of the list `integer` takes integer values only. The other variables are continuous. */
export interface IntegerProgram extends LinearProgram {
  /** The indices of the integer variables. */
  readonly integer: readonly number[];
}

/** The row that a node adds to the rows of its parent: `x[variable] <= value` or `x[variable] >= value`. The value is an integer. */
export interface Branch {
  readonly variable: number;
  readonly relation: "<=" | ">=";
  readonly value: Rational;
}

/**
 * The outcome of a node of the tree.
 *
 * - `branched`: the node has two children. One child adds `x_j <= k`, and the other child adds `x_j >= k + 1`.
 * - `integer`: the relaxation of the node has an optimum with an integer value on each integer variable.
 * - `bound`: the optimum of the relaxation is not better than the best integer point that the solve found before the node.
 * - `infeasible`: the relaxation of the node has no point.
 * - `open`: the solve stopped at its limit before the node.
 */
export type NodeOutcome = "branched" | "integer" | "bound" | "infeasible" | "open";

/** One node of the tree. The root is node 0. Each other node has a parent with a smaller index. */
export interface BranchNode {
  readonly parent: number | undefined;
  readonly branch: Branch | undefined;
  readonly outcome: NodeOutcome;
  /** The result of the relaxation of the node, with its certificate. An open node has no result. */
  readonly result: LinearProgramResult | undefined;
}

/**
 * The result of an integer program, with its certificate.
 *
 * - `optimal`: the point `x`, its value, and the tree. Each leaf proves that its integer points are not better than `x`.
 * - `infeasible`: the tree. Each leaf has a Farkas ray, so the program has no integer point.
 * - `unbounded`: an integer point `x` and a direction `direction` with an integer value on each integer variable.
 *   Each point `x + t direction` with an integer `t >= 0` is an integer point, and the objective improves without limit.
 * - `limit`: the solve stopped at its limit. It gives the best integer point that it found, if any. `bound` is a bound of the
 *   optimum that the tree proves. A program with an unbounded relaxation gives no bound.
 */
export type IntegerProgramResult =
  | { readonly status: "optimal"; readonly x: Vector; readonly value: Rational; readonly tree: readonly BranchNode[] }
  | { readonly status: "infeasible"; readonly tree: readonly BranchNode[] }
  | { readonly status: "unbounded"; readonly x: Vector; readonly direction: Vector }
  | {
      readonly status: "limit";
      readonly x: Vector | undefined;
      readonly value: Rational | undefined;
      readonly bound: Rational | undefined;
      readonly tree: readonly BranchNode[];
    };

/** The options of `solveIntegerProgram`. */
export interface IntegerOptions {
  /** The largest count of relaxations that the solve solves. The default is 10000. */
  readonly nodeLimit?: number;
}

/** A node in construction. */
interface WorkNode {
  readonly parent: number | undefined;
  readonly branch: Branch | undefined;
  outcome: NodeOutcome;
  result: LinearProgramResult | undefined;
}

/** The result of one search, before the solve gives its status. */
interface Search {
  readonly best: { readonly x: Vector; readonly value: Rational } | undefined;
  readonly nodes: readonly WorkNode[];
  /** True when the search stopped at its limit with open nodes. */
  readonly stopped: boolean;
}

/**
 * This function gives the problems of the list `integer` of a program: an index that is not an integer, or not a variable.
 *
 * @internal
 */
export function integerProblems(program: IntegerProgram): string[] {
  const n = program.objective.length;
  return program.integer.filter((j) => !Number.isInteger(j) || j < 0 || j >= n).map((j) => `the integer variable ${String(j)} is not a variable of the program`);
}

/**
 * This function gives the program of a node: the rows of the program, then the row of each branch on the path from the root.
 *
 * @internal
 */
export function nodeProgram(program: LinearProgram, tree: readonly Pick<BranchNode, "parent" | "branch">[], id: number): LinearProgram {
  const rows: Constraint[] = [];
  const n = program.objective.length;
  for (let at: number | undefined = id; at !== undefined; at = tree[at]?.parent) {
    const branch = tree[at]?.branch;
    if (branch === undefined) continue;
    const coefficients = Array.from({ length: n }, (_, j) => (j === branch.variable ? ONE : ZERO));
    rows.push({ coefficients, relation: branch.relation, rhs: branch.value });
  }
  return { ...program, constraints: [...program.constraints, ...rows.reverse()] };
}

/**
 * This function searches the tree depth first. It branches on the fractional integer variable with the smallest index, and it
 * takes the child `x_j <= k` first. With `first`, it stops at the first integer point.
 */
function search(program: LinearProgram, integer: readonly number[], limit: number, first: boolean, root: LinearProgramResult): Search {
  const s = program.sense === "max" ? 1 : -1;
  const nodes: WorkNode[] = [{ parent: undefined, branch: undefined, outcome: "open", result: undefined }];
  const stack = [0];
  let best: Search["best"];
  let solved = 0;
  while (stack.length > 0 && solved < limit) {
    const id = stack.pop() as number;
    const node = nodes[id] as WorkNode;
    const result = id === 0 ? root : solveLinearProgram(nodeProgram(program, nodes, id));
    solved++;
    node.result = result;
    if (result.status === "infeasible") {
      node.outcome = "infeasible";
      continue;
    }
    // A node adds rows to a program with an optimum or with the objective 0, so its relaxation is not unbounded.
    if (result.status === "unbounded") throw new Error("linear: the relaxation of a node is unbounded, and the relaxation of the root is not");
    if (best !== undefined && compare(result.value, best.value) * s <= 0) {
      node.outcome = "bound";
      continue;
    }
    const j = integer.find((k) => !isInteger(result.x[k] as Rational));
    if (j === undefined) {
      node.outcome = "integer";
      best = { x: result.x, value: result.value };
      if (first) return { best, nodes, stopped: false };
      continue;
    }
    node.outcome = "branched";
    const k = floor(result.x[j] as Rational);
    nodes.push({ parent: id, branch: { variable: j, relation: ">=", value: add(k, ONE) }, outcome: "open", result: undefined });
    stack.push(nodes.length - 1);
    nodes.push({ parent: id, branch: { variable: j, relation: "<=", value: k }, outcome: "open", result: undefined });
    stack.push(nodes.length - 1);
  }
  return { best, nodes, stopped: stack.length > 0 };
}

/** This function gives the direction times the least common multiple of its denominators, so each entry is an integer. */
function integral(direction: Vector): Vector {
  let m = 1n;
  for (const v of direction) m = (m / gcd(m, v.d)) * v.d;
  return direction.map((v) => rational(v.n * (m / v.d)));
}

/** This function gives the frozen tree of the nodes of a search. */
function treeOf(nodes: readonly WorkNode[]): BranchNode[] {
  return nodes.map(({ parent, branch, outcome, result }) => ({ parent, branch, outcome, result }));
}

/**
 * This function solves an integer program with branch and bound on the exact simplex. The search goes depth first. It branches
 * on the fractional integer variable with the smallest index.
 *
 * - A relaxation with an optimum starts the search for the optimum. Each node with no better optimum than the best point is a leaf.
 * - An unbounded relaxation starts a search for one integer point with the objective 0. When it finds a point, the program is
 *   unbounded: the program has rational rows, so its integer points have the unbounded directions of its relaxation.
 * - The search can go on with no end, for example on a line with no integer point. The limit `nodeLimit` stops it.
 *
 * @throws {RangeError} A row has a length that is not the count of variables.
 * @throws {RangeError} An integer variable is not a variable of the program.
 * @throws {RangeError} The option `nodeLimit` is not an integer of 1 or more.
 */
export function solveIntegerProgram(program: IntegerProgram, options: IntegerOptions = {}): IntegerProgramResult {
  checkShape(program);
  const problems = integerProblems(program);
  if (problems.length > 0) throw new RangeError(`linear: ${problems.join(", ")}`);
  const limit = options.nodeLimit ?? 10_000;
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`linear: the node limit ${String(limit)} is not an integer of 1 or more`);
  const integer = [...new Set(program.integer)].sort((a, b) => a - b);
  const root = solveLinearProgram(program);
  if (root.status === "unbounded") {
    const zero: LinearProgram = { ...program, objective: program.objective.map(() => ZERO) };
    const found = search(zero, integer, limit, true, solveLinearProgram(zero));
    if (found.best !== undefined) return { status: "unbounded", x: found.best.x, direction: integral(root.direction) };
    const tree = treeOf(found.nodes);
    if (found.stopped) return { status: "limit", x: undefined, value: undefined, bound: undefined, tree };
    return { status: "infeasible", tree };
  }
  const found = search(program, integer, limit, false, root);
  const tree = treeOf(found.nodes);
  if (found.stopped) {
    const s = program.sense === "max" ? 1 : -1;
    let bound = found.best?.value;
    for (const node of found.nodes) {
      if (node.outcome !== "open" || node.parent === undefined) continue;
      const parent = found.nodes[node.parent]?.result;
      if (parent?.status === "optimal" && (bound === undefined || compare(parent.value, bound) * s > 0)) bound = parent.value;
    }
    return { status: "limit", x: found.best?.x, value: found.best?.value, bound, tree };
  }
  if (found.best === undefined) return { status: "infeasible", tree };
  return { status: "optimal", x: found.best.x, value: found.best.value, tree };
}

/** This function adds a failure for each integer variable of `x` with a value that is not an integer. */
function checkIntegral(integer: readonly number[], x: Vector, name: string, failures: string[]): void {
  for (const j of integer) {
    const v = x[j];
    if (v !== undefined && !isInteger(v)) failures.push(`${name}[${String(j)}] = ${toString(v)} is not an integer`);
  }
}

/** This function adds a failure when the value `v` is better than `limit` in the sense of the program. */
function checkNotBetter(s: 1 | -1, v: Rational, limit: Rational, name: string, failures: string[]): void {
  if (compare(v, limit) * s > 0) failures.push(`${name} ${toString(v)} is better than ${toString(limit)}`);
}

/**
 * This function examines the tree of a result: its shape, and a certificate for each leaf. With `best`, the value of each leaf
 * is not better than `best`. Each failure goes into `failures`.
 */
function checkTree(program: IntegerProgram, tree: readonly BranchNode[], allowOpen: boolean, best: Rational | undefined, failures: string[]): void {
  const s = program.sense === "max" ? 1 : -1;
  const integer = new Set(program.integer);
  const root = tree[0];
  if (root === undefined || root.parent !== undefined || root.branch !== undefined) {
    failures.push("node 0 is not a root with no parent and no branch");
    return;
  }
  const children = tree.map((): number[] => []);
  for (let i = 1; i < tree.length; i++) {
    const node = tree[i] as BranchNode;
    if (node.parent === undefined || !Number.isInteger(node.parent) || node.parent < 0 || node.parent >= i || node.branch === undefined) {
      failures.push(`node ${String(i)} has no parent before it, or no branch`);
      return;
    }
    if (!integer.has(node.branch.variable) || !isInteger(node.branch.value)) failures.push(`node ${String(i)} branches on a variable that is not an integer variable, or at a value that is not an integer`);
    children[node.parent]?.push(i);
  }
  tree.forEach((node, i) => {
    const kids = children[i] as number[];
    if (node.outcome === "branched") {
      const [a, b] = kids.map((k) => (tree[k] as BranchNode).branch as Branch);
      const down = [a, b].find((branch) => branch?.relation === "<=");
      const up = [a, b].find((branch) => branch?.relation === ">=");
      if (kids.length !== 2 || down === undefined || up === undefined || down.variable !== up.variable || !equals(add(down.value, ONE), up.value)) {
        failures.push(`node ${String(i)} is branched, and its children are not x_j <= k and x_j >= k + 1`);
      }
      return;
    }
    if (kids.length > 0) failures.push(`node ${String(i)} has children, and its outcome is ${node.outcome}`);
    if (node.outcome === "open") {
      if (!allowOpen) failures.push(`node ${String(i)} is open`);
      if (best === undefined || node.parent === undefined) return;
      // The integer points of an open node are not better than the optimum of the relaxation of its parent.
      const parent = tree[node.parent]?.result;
      if (parent?.status !== "optimal") {
        failures.push(`node ${String(i)} is open, and its parent has no optimum`);
        return;
      }
      const check = checkCertificate(nodeProgram(program, tree, node.parent), parent);
      for (const failure of check.failures) failures.push(`node ${String(node.parent)}: ${failure}`);
      checkNotBetter(s, parent.value, best, `the parent of the open node ${String(i)} has the value`, failures);
      return;
    }
    const result = node.result;
    if (result === undefined) {
      failures.push(`node ${String(i)} is a leaf with no result`);
      return;
    }
    const check = checkCertificate(nodeProgram(program, tree, i), result);
    for (const failure of check.failures) failures.push(`node ${String(i)}: ${failure}`);
    if (node.outcome === "infeasible") {
      if (result.status !== "infeasible") failures.push(`node ${String(i)} is infeasible, and its result is ${result.status}`);
      return;
    }
    if (result.status !== "optimal") {
      failures.push(`node ${String(i)} is a leaf of the outcome ${node.outcome}, and its result is ${result.status}`);
      return;
    }
    if (node.outcome === "integer") checkIntegral(program.integer, result.x, `node ${String(i)}: x`, failures);
    if (best === undefined) failures.push(`node ${String(i)} has an optimum, and the result claims no integer point`);
    else checkNotBetter(s, result.value, best, `node ${String(i)} has the value`, failures);
  });
}

/**
 * This function examines the certificate of the result of an integer program with exact arithmetic. It does not trust the solver.
 *
 * - `optimal`: the point is feasible, its integer variables are integers, and its value is `c x`. The tree covers each integer
 *   point: each branched node has the children `x_j <= k` and `x_j >= k + 1`. Each leaf has a valid certificate of its
 *   relaxation, and its value is not better than the value of the point.
 * - `infeasible`: the tree covers each integer point, and each leaf has a Farkas ray.
 * - `unbounded`: the point and the direction meet the conditions of `checkCertificate`, and their integer variables are integers.
 * - `limit`: the point, if any, meets the conditions of an optimum. The tree has the shape of a tree of branches, and each closed
 *   leaf has a valid certificate. With a bound, each leaf and the parent of each open node have a value that is not better than the bound.
 */
export function checkIntegerCertificate(program: IntegerProgram, result: IntegerProgramResult): CertificateCheck {
  const failures: string[] = [];
  if (program.constraints.some((c) => c.coefficients.length !== program.objective.length)) {
    failures.push("a constraint row has a length that is not the count of variables");
    return { valid: false, failures };
  }
  failures.push(...integerProblems(program));
  if (failures.length > 0) return { valid: false, failures };
  const s = program.sense === "max" ? 1 : -1;
  const point = (x: Vector, value: Rational): void => {
    checkFeasible(program, x, failures);
    checkIntegral(program.integer, x, "x", failures);
    if (x.length === program.objective.length && !equals(dot(program.objective, x), value)) failures.push(`the value ${toString(value)} is not c x = ${toString(dot(program.objective, x))}`);
  };
  if (result.status === "unbounded") {
    failures.push(...checkCertificate(program, { status: "unbounded", x: result.x, direction: result.direction }).failures);
    checkIntegral(program.integer, result.x, "x", failures);
    checkIntegral(program.integer, result.direction, "direction", failures);
  } else if (result.status === "optimal") {
    point(result.x, result.value);
    checkTree(program, result.tree, false, result.value, failures);
  } else if (result.status === "infeasible") {
    checkTree(program, result.tree, false, undefined, failures);
    result.tree.forEach((node, i) => {
      if (node.outcome !== "branched" && node.outcome !== "infeasible") failures.push(`node ${String(i)} is a leaf of the outcome ${node.outcome} in an infeasible result`);
    });
  } else {
    if ((result.x === undefined) !== (result.value === undefined)) failures.push("the limit result has a point with no value, or a value with no point");
    if (result.x !== undefined && result.value !== undefined) {
      point(result.x, result.value);
      if (result.bound === undefined) failures.push("the limit result has a point and no bound");
      else checkNotBetter(s, result.value, result.bound, "the value", failures);
    }
    checkTree(program, result.tree, true, result.bound, failures);
  }
  return { valid: failures.length === 0, failures };
}
