/**
 * The interval evaluator of the expression kinds (roadmap item A4). The verb `interval` compiles a document one time
 * into a tree of closures, as the verb `float` does. Each call gives an interval that contains the exact value. Each
 * operation is an operation of `interval.ts`, which rounds each bound outward by one float step at most.
 *
 * A result is one of three values:
 *
 * - `[low, high]`: a claim. The expression has a real value at each point of the inputs, and the value is in the
 *   interval. An infinite bound tells that the interval has no bound on that side.
 * - `null`: a claim. No point of the inputs gives a real value, for example a quotient by the point zero.
 * - `"no claim"`: the evaluator cannot tell. A divisor or a base of a negative power that holds zero gives it. An even
 *   root of a value that can be negative and a variable that is not finite give it too.
 *
 * A part without a real value makes the node have no real value, also when another part makes no claim.
 *
 * @packageDocumentation
 */
import type { Truth } from "./ball.ts";
import * as I from "./interval.ts";
import type { Interval } from "./interval.ts";
import type { KindName, NodeData } from "./summary.ts";

/** The result that makes no claim. */
export const NO_CLAIM = "no claim";

/** The result of a node for the verb `interval`: an interval, `null` for no real value, or `"no claim"`. */
export type Enclosure = Interval | typeof NO_CLAIM;

/** The value of a variable for the verb `interval`: a number, which is the interval of one point, or an interval. */
export type IntervalInput = number | readonly [number, number];

/** The code of one node: a function of the values of the variables. */
export type IntervalRun = (values: ArrayLike<IntervalInput>) => Enclosure;

/** The compiled code of one node. */
export interface IntervalCell {
  readonly run: IntervalRun;
}

/**
 * This function compiles a number literal. A literal is the exact binary value of its float.
 *
 * @param value - The finite float of the literal.
 * @returns The cell of the literal.
 */
export function intervalNum(value: number): IntervalCell {
  const point: Interval = [value, value];
  return { run: () => point };
}

/**
 * This function compiles a variable. A finite number is the interval of one point. A number that is not finite makes
 * no claim. An interval must have `low <= high`, a low bound below `Infinity` and a high bound above `-Infinity`.
 *
 * @param index - The position of the variable in the values of a call.
 * @returns The cell of the variable.
 */
export function intervalVar(index: number): IntervalCell {
  return {
    run: (values) => {
      const v = values[index] as IntervalInput;
      if (typeof v === "number") return v - v === 0 ? [v, v] : NO_CLAIM;
      const [low, high] = v;
      if (!(low <= high && low < Infinity && high > -Infinity)) throw new RangeError(`[${low}, ${high}] is not an interval.`);
      return v;
    },
  };
}

/**
 * This function evaluates the parts of a node. A part without a real value gives `null`, and else a part without a
 * claim gives `"no claim"`.
 */
function runParts(parts: readonly IntervalCell[], values: ArrayLike<IntervalInput>): (readonly [number, number])[] | null | typeof NO_CLAIM {
  const out: (readonly [number, number])[] = [];
  let open = false;
  let none = false;
  for (const part of parts) {
    const r = part.run(values);
    if (r === null) none = true;
    else if (r === NO_CLAIM) open = true;
    else out.push(r);
  }
  return none ? null : open ? NO_CLAIM : out;
}

/** This function tells if an interval holds zero. */
const holdsZero = (x: readonly [number, number]): boolean => x[0] <= 0 && x[1] >= 0;

/** This function tells if an interval is the point zero. */
const isZero = (x: readonly [number, number]): boolean => x[0] === 0 && x[1] === 0;

/** The rule of a divisor: the point zero has no real value, and another interval that holds zero makes no claim. */
function quotient(x: Interval, y: readonly [number, number]): Enclosure {
  if (isZero(y)) return null;
  return holdsZero(y) ? NO_CLAIM : I.div(x, y);
}

/** The rule of a power: a negative power of an interval that holds zero is the rule of a divisor. */
function power(x: readonly [number, number], n: number): Enclosure {
  if (n < 0 && holdsZero(x)) return isZero(x) ? null : NO_CLAIM;
  return I.pow(x, n);
}

/** The rule of a root: an even root of an interval with a negative point and a point of zero or more makes no claim. */
function rootOf(x: readonly [number, number], k: number): Enclosure {
  if (k % 2 === 0 && x[0] < 0) return x[1] < 0 ? null : NO_CLAIM;
  return I.root(x, k);
}

const fold = (f: (x: Interval, y: Interval) => Interval) => (xs: readonly (readonly [number, number])[]): Enclosure =>
  xs.slice(1).reduce<Interval>((acc, x) => f(acc, x), xs[0] as Interval);

/**
 * This function compiles one node from the cells of its parts. It is the rule of each kind for the verb `interval`. A
 * list of parts folds from the left. A comparison gives `[1, 1]` for true, `[0, 0]` for false, and `[0, 1]` when the
 * intervals do not decide it.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The cells of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The cell of the node.
 */
export function intervalNode(kind: KindName, parts: readonly IntervalCell[], data: NodeData = {}): IntervalCell {
  if (parts.length === 0) throw new RangeError(`The kind ${kind} needs one part or more.`);
  const rule = ruleOf(kind, data);
  return {
    run: (values) => {
      const xs = runParts(parts, values);
      return xs === null || xs === NO_CLAIM ? xs : rule(xs);
    },
  };
}

function ruleOf(kind: KindName, data: NodeData): (xs: readonly (readonly [number, number])[]) => Enclosure {
  switch (kind) {
    case "add":
      return fold(I.add);
    case "sub":
      return fold(I.sub);
    case "mul":
      return fold(I.mul);
    case "min":
      return fold(I.min);
    case "max":
      return fold(I.max);
    case "div":
      return ([x, y]) => quotient(x as Interval, y as readonly [number, number]);
    case "neg":
      return ([x]) => I.neg(x as Interval);
    case "pow":
      return ([x]) => power(x as readonly [number, number], data.exp as number);
    case "root":
      return ([x]) => rootOf(x as readonly [number, number], data.index as number);
    case "lt":
    case "le":
    case "eq":
      return fold(I[kind]);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use intervalNum or intervalVar.`);
  }
}

/**
 * This function gives the truth value of the result of a comparison document.
 *
 * @param result - The result of a comparison document.
 * @returns `true` for `[1, 1]`, `false` for `[0, 0]`, and `"undecided"` for each other result.
 */
export function decideInterval(result: Enclosure): Truth {
  if (result === null || result === NO_CLAIM || result[0] !== result[1]) return "undecided";
  return result[0] === 1;
}
