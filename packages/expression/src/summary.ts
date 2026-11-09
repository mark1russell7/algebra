/**
 * The summary of an expression node: its free variables, its degree, the bounds of its value and its cost. The
 * summary of a node comes only from the summaries of its children and the data of the node.
 *
 * @packageDocumentation
 */
import { interval as I } from "@mark1russell7/interval";
import type { Interval } from "@mark1russell7/interval";
import { recordMonoid, sortedUnionMonoid, stringOrder, sumMonoid } from "@mark1russell7/structures";
import type { Monoid } from "@mark1russell7/structures";

export type { Monoid };

/** The name of each kind of an expression. */
export type ExpressionKind = "num" | "var" | "add" | "sub" | "mul" | "div" | "neg" | "pow" | "root" | "min" | "max";
/** The name of each kind of a comparison. */
export type ComparisonKind = "lt" | "le" | "eq";
/** The name of each kind. */
export type KindName = ExpressionKind | ComparisonKind;

/**
 * The summary of a node.
 *
 * - `free`: the names of the free variables, sorted, each one time.
 * - `degree`: an upper bound of the total degree as a polynomial, from the syntax. `null` tells that the node is not
 *   a polynomial in its variables, for example a division by a variable.
 * - `bounds`: an interval that contains the exact real value of the node at each point of the variable bounds. A
 *   comparison gives `1` for true and `0` for false. `null` tells that no point gives a real value.
 * - `cost`: the count of the nodes of each kind in the expression, the node itself included.
 */
export interface Summary {
  readonly free: readonly string[];
  readonly degree: number | null;
  readonly bounds: Interval;
  readonly cost: Readonly<Record<string, number>>;
}

/** The monoid of the free variables: the union of sorted lists of the core. It is also commutative and idempotent. */
export const freeMonoid: Monoid<readonly string[]> = sortedUnionMonoid(stringOrder);

/** The monoid of the costs: the sum of the counts of each kind, with the keys sorted. It is also commutative. */
export const costMonoid: Monoid<Readonly<Record<string, number>>> = recordMonoid(sumMonoid);

/**
 * This function gives the summary of a number literal.
 *
 * @param value - The finite float of the literal. It means its exact binary value.
 * @returns The summary: no variables, degree 0, the point bounds and a cost of one `num`.
 */
export function numSummary(value: number): Summary {
  return { free: [], degree: 0, bounds: [value, value], cost: { num: 1 } };
}

/**
 * This function gives the summary of a variable.
 *
 * @param name - The name of the variable.
 * @param bounds - The bounds of the variable. The default is the whole line.
 * @returns The summary: the one variable, degree 1, the bounds and a cost of one `var`.
 */
export function varSummary(name: string, bounds: Interval = I.WHOLE): Summary {
  return { free: [name], degree: 1, bounds, cost: { var: 1 } };
}

/** The data of a node that is not a part: the exponent of `pow` and the index of `root`. */
export interface NodeData {
  readonly exp?: number;
  readonly index?: number;
}

function foldBounds(parts: readonly Summary[], op: (x: Interval, y: Interval) => Interval): Interval {
  const [first, ...rest] = parts;
  if (first === undefined) throw new RangeError("A node with a list of parts needs one part or more.");
  return rest.reduce<Interval>((acc, s) => op(acc, s.bounds), first.bounds);
}

function degreeOf(kind: KindName, parts: readonly Summary[], data: NodeData): number | null {
  const ds = parts.map((p) => p.degree);
  if (ds.some((d) => d === null)) return null;
  const d = ds as number[];
  switch (kind) {
    case "add":
    case "sub":
      return Math.max(...d);
    case "mul":
      return d.reduce((a, b) => a + b, 0);
    case "neg":
      return d[0] as number;
    case "div":
      return d[1] === 0 ? (d[0] as number) : null;
    case "pow": {
      const e = data.exp as number;
      if (e >= 0) return (d[0] as number) * e;
      return d[0] === 0 ? 0 : null;
    }
    case "root":
    case "min":
    case "max":
      return d.every((x) => x === 0) ? 0 : null;
    case "lt":
    case "le":
    case "eq":
      return null;
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use numSummary or varSummary.`);
  }
}

function boundsOf(kind: KindName, parts: readonly Summary[], data: NodeData): Interval {
  const [a, b] = parts.map((p) => p.bounds);
  switch (kind) {
    case "add":
      return foldBounds(parts, I.add);
    case "mul":
      return foldBounds(parts, I.mul);
    case "min":
      return foldBounds(parts, I.min);
    case "max":
      return foldBounds(parts, I.max);
    case "sub":
      return I.sub(a ?? null, b ?? null);
    case "div":
      return I.div(a ?? null, b ?? null);
    case "neg":
      return I.neg(a ?? null);
    case "pow":
      return I.pow(a ?? null, data.exp as number);
    case "root":
      return I.root(a ?? null, data.index as number);
    case "lt":
      return I.lt(a ?? null, b ?? null);
    case "le":
      return I.le(a ?? null, b ?? null);
    case "eq":
      return I.eq(a ?? null, b ?? null);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use numSummary or varSummary.`);
  }
}

/**
 * This function gives the summary of a node from the summaries of its parts. It is the one rule of each kind, and
 * the verb `summary` of the machine uses it.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The summaries of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The summary of the node.
 */
export function combine(kind: KindName, parts: readonly Summary[], data: NodeData = {}): Summary {
  return {
    free: parts.reduce((acc, p) => freeMonoid.combine(acc, p.free), freeMonoid.empty),
    degree: degreeOf(kind, parts, data),
    bounds: boundsOf(kind, parts, data),
    cost: parts.reduce((acc, p) => costMonoid.combine(acc, p.cost), { [kind]: 1 }),
  };
}
