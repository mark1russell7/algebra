/**
 * The tape evaluator of the expression kinds. The verb `tape` gives a tree of a document, and `tapeOf` flattens that
 * tree into a list of float instructions. One loop operates the list over two typed arrays: the values and the bounds of
 * the registers. There is one register for each result, and no closure for a node.
 *
 * The operations and their order are those of the verb `float`, and the bound rules are the functions of `float.ts`.
 * Thus a tape gives the value and the bound of `compileClosures` at each point. A list of parts folds from the left, and a
 * power is a list of products by repeated squares, as in `float.ts`.
 *
 * A compiled tape keeps its registers between calls, so one tape does not do two calls at the same time.
 *
 * @packageDocumentation
 */
import { close, comparisonError, divError, floatRoot, type FloatResult, mulError, rootError, sqrtError } from "./float.ts";
import type { KindName, NodeData } from "./summary.ts";

/** A node of the tree of the verb `tape`. The field `value` is the float of a `num` or the position of a `var`. */
export interface TapeTree {
  readonly kind: KindName;
  readonly value: number;
  readonly parts: readonly TapeTree[];
  readonly data: NodeData;
}

/**
 * This function gives the tree of a number literal.
 *
 * @param value - The finite float of the literal.
 * @returns The tree of the literal.
 */
export function tapeNum(value: number): TapeTree {
  return { kind: "num", value, parts: [], data: {} };
}

/**
 * This function gives the tree of a variable.
 *
 * @param index - The position of the variable in the values of a call.
 * @returns The tree of the variable.
 */
export function tapeVar(index: number): TapeTree {
  return { kind: "var", value: index, parts: [], data: {} };
}

/**
 * This function gives the tree of one node from the trees of its parts.
 *
 * @param kind - The kind of the node.
 * @param parts - The trees of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The tree of the node.
 */
export function tapeNode(kind: KindName, parts: readonly TapeTree[], data: NodeData = {}): TapeTree {
  if (parts.length === 0) throw new RangeError(`The kind ${kind} needs one part or more.`);
  return { kind, value: 0, parts, data };
}

const VAR = 0;
const ADD = 1;
const SUB = 2;
const MUL = 3;
const DIV = 4;
const NEG = 5;
const LEAST = 6;
const MOST = 7;
const ONE = 8;
const SQRT = 9;
const ROOT = 10;
const LT = 11;
const LE = 12;
const EQ = 13;

/** The size of one instruction in the code: the operation, the result register and two operands. */
const WIDTH = 4;

/** The operations of the kinds with two parts or a list of parts. */
const BINARY: Partial<Readonly<Record<KindName, number>>> = { add: ADD, sub: SUB, mul: MUL, div: DIV, min: LEAST, max: MOST, lt: LT, le: LE, eq: EQ };

/** A tape: the code, the first values of the registers and the register of the result. */
interface Tape {
  readonly code: Int32Array;
  readonly values: Float64Array;
  readonly root: number;
}

/** This function flattens a tree. A literal has a register with its value and no instruction. */
function flatten(tree: TapeTree): Tape {
  const code: number[] = [];
  const first: number[] = [];
  const positions = new Map<number, number>();
  const register = (value: number): number => first.push(value) - 1;
  const emit = (op: number, a: number, b: number): number => {
    const target = register(0);
    code.push(op, target, a, b);
    return target;
  };
  const power = (base: number, exp: number): number => {
    const n = Math.abs(exp);
    if (n === 0) return emit(ONE, base, 0);
    let square = base;
    let result: number | undefined;
    for (let k = n; k > 0; k = Math.floor(k / 2)) {
      if (k % 2 === 1) result = result === undefined ? square : emit(MUL, result, square);
      if (k > 1) square = emit(MUL, square, square);
    }
    return exp > 0 ? (result as number) : emit(DIV, register(1), result as number);
  };
  const walk = (t: TapeTree): number => {
    switch (t.kind) {
      case "num":
        return register(t.value);
      case "var": {
        const known = positions.get(t.value);
        if (known !== undefined) return known;
        const made = emit(VAR, t.value, 0);
        positions.set(t.value, made);
        return made;
      }
      case "neg":
        return emit(NEG, walk(t.parts[0] as TapeTree), 0);
      case "pow":
        return power(walk(t.parts[0] as TapeTree), t.data.exp as number);
      case "root": {
        const k = t.data.index as number;
        return emit(k === 2 ? SQRT : ROOT, walk(t.parts[0] as TapeTree), k);
      }
      default: {
        const op = BINARY[t.kind] as number;
        const [head, ...rest] = t.parts as readonly [TapeTree, ...TapeTree[]];
        return rest.reduce((left, part) => emit(op, left, walk(part)), walk(head));
      }
    }
  };
  const root = walk(tree);
  return { code: Int32Array.from(code), values: Float64Array.from(first), root };
}

/** The one loop of the tape. It writes the value and the bound of each register. */
function runTape(code: Int32Array, val: Float64Array, err: Float64Array, inputs: ArrayLike<number>): void {
  for (let pc = 0; pc < code.length; pc += WIDTH) {
    const target = code[pc + 1] as number;
    const a = code[pc + 2] as number;
    const b = code[pc + 3] as number;
    switch (code[pc]) {
      case VAR: {
        const v = inputs[a] as number;
        val[target] = v;
        err[target] = v - v === 0 ? 0 : Infinity;
        break;
      }
      case ADD: {
        const v = (val[a] as number) + (val[b] as number);
        val[target] = v;
        err[target] = close(v, (err[a] as number) + (err[b] as number));
        break;
      }
      case SUB: {
        const v = (val[a] as number) - (val[b] as number);
        val[target] = v;
        err[target] = close(v, (err[a] as number) + (err[b] as number));
        break;
      }
      case MUL: {
        const x = val[a] as number;
        const y = val[b] as number;
        const v = x * y;
        val[target] = v;
        err[target] = mulError(v, x, err[a] as number, y, err[b] as number);
        break;
      }
      case DIV: {
        const y = val[b] as number;
        const v = (val[a] as number) / y;
        val[target] = v;
        err[target] = divError(v, err[a] as number, y, err[b] as number);
        break;
      }
      case NEG:
        val[target] = -(val[a] as number);
        err[target] = err[a] as number;
        break;
      case LEAST:
        val[target] = Math.min(val[a] as number, val[b] as number);
        err[target] = Math.max(err[a] as number, err[b] as number);
        break;
      case MOST:
        val[target] = Math.max(val[a] as number, val[b] as number);
        err[target] = Math.max(err[a] as number, err[b] as number);
        break;
      case ONE:
        val[target] = 1;
        err[target] = (err[a] as number) < Infinity ? 0 : Infinity;
        break;
      case SQRT: {
        const r = val[a] as number;
        const v = Math.sqrt(r);
        val[target] = v;
        err[target] = sqrtError(v, r, err[a] as number);
        break;
      }
      case ROOT: {
        const r = val[a] as number;
        const v = floatRoot(r, b);
        val[target] = v;
        err[target] = rootError(v, r, err[a] as number, b);
        break;
      }
      case LT:
      case LE:
      case EQ: {
        const x = val[a] as number;
        const y = val[b] as number;
        const op = code[pc];
        val[target] = (op === LT ? x < y : op === LE ? x <= y : x === y) ? 1 : 0;
        err[target] = comparisonError(op === LT ? "lt" : op === LE ? "le" : "eq", x, err[a] as number, y, err[b] as number);
        break;
      }
    }
  }
}

/**
 * This function gives the run of a tree: the function of the values of the variables.
 *
 * @param tree - The tree of the verb `tape`.
 * @returns The function that gives the value and the bound at one point.
 */
export function tapeOf(tree: TapeTree): (inputs: ArrayLike<number>) => FloatResult {
  const { code, values, root } = flatten(tree);
  const err = new Float64Array(values.length);
  return (inputs) => {
    runTape(code, values, err, inputs);
    return { value: values[root] as number, error: err[root] as number };
  };
}
