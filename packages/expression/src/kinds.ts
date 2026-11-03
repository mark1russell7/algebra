/**
 * The coeval kinds of the expression documents and the machine of the verbs `summary`, `float`, `interval`, `ball`,
 * `exact` and `bigfloat`.
 * An evaluator of a later item adds its own verb to these kinds. The documents do not change.
 *
 * @packageDocumentation
 */
import { fail, makeContext, ok, prepare } from "@mark1russell7/coeval";
import type { EvalInput, Kind, Machine, Result, World } from "@mark1russell7/coeval";

/** The shape of the value of a kind (the field `parts` of a coeval kind). */
export type Shape = NonNullable<Kind["parts"]>;
import * as B from "@algebra/bigfloat";
import type { BigFloat } from "@algebra/bigfloat";
import { ballNode, ballNum, ballVar } from "./ball.ts";
import type { Ball, BallCell, BallInput } from "./ball.ts";
import { bigfloatNode, bigfloatNum, bigfloatVar } from "./bigfloat-evaluator.ts";
import type { BigEnclosure, BigfloatCell, BigInterval } from "./bigfloat-evaluator.ts";
import { exactNode, exactNum, exactVar } from "./exact.ts";
import type { ExactCell, ExactResult } from "./exact.ts";
import { floatNode, floatNum, floatVar } from "./float.ts";
import type { FloatCell, FloatResult } from "./float.ts";
import type { Interval } from "./interval.ts";
import { intervalNode, intervalNum, intervalVar, NO_CLAIM } from "./interval-evaluator.ts";
import type { Enclosure, IntervalCell, IntervalInput } from "./interval-evaluator.ts";
import type { Document } from "./schema.ts";
import { combine, numSummary, varSummary } from "./summary.ts";
import type { KindName, NodeData, Summary } from "./summary.ts";

/** The verb that gives the summary of a node. */
export const SUMMARY = "summary";
/** The verb that compiles a node into float code with a bound of its error (roadmap item A3). */
export const FLOAT = "float";
/** The verb that compiles a node into code that gives an outward interval of its value (roadmap item A4). */
export const INTERVAL = "interval";
/** The verb that compiles a node into code that gives a midpoint and a radius of its value (roadmap item A4). */
export const BALL = "ball";
/** The verb that compiles a node into code that gives its exact rational value (roadmap item A6). */
export const EXACT = "exact";
/** The verb that compiles a node into code that gives an outward `BigFloat` interval at a precision (roadmap item A7). */
export const BIGFLOAT = "bigfloat";

/** The verbs of the compiled evaluators, which take the position of each variable from the context. */
const COMPILED = [FLOAT, INTERVAL, BALL, EXACT, BIGFLOAT] as const;

const list: Shape = { shape: "list" };
const term: Shape = { shape: "term" };

/** The shape of the value of each kind. */
export const SHAPES: Readonly<Record<KindName, Shape>> = {
  num: { shape: "number" },
  var: { shape: "text" },
  add: list,
  mul: list,
  min: list,
  max: list,
  sub: list,
  div: list,
  neg: term,
  pow: {
    shape: "record",
    fields: { base: term, exp: { shape: "number", whole: true } },
    required: ["base", "exp"],
    closed: true,
  },
  root: {
    shape: "record",
    fields: { radicand: term, index: { shape: "number", whole: true, min: 2 } },
    required: ["radicand", "index"],
    closed: true,
  },
  lt: list,
  le: list,
  eq: list,
};

/** The name of each kind, in a fixed order. */
export const KINDS = Object.keys(SHAPES) as readonly KindName[];

const evaluatorName = (kind: KindName, verb: string = SUMMARY): string => `expression.${verb}.${kind}`;

function kindOf(name: KindName): Kind {
  return {
    verbs: { [SUMMARY]: evaluatorName(name), ...Object.fromEntries(COMPILED.map((v) => [v, evaluatorName(name, v)])) },
    parts: SHAPES[name],
    pure: true,
    verbEffects: { [SUMMARY]: [], ...Object.fromEntries(COMPILED.map((v) => [v, []])) },
  };
}

/** The world of the expression kinds. */
export const expressionWorld: World = {
  kinds: Object.fromEntries(KINDS.map((k) => [k, kindOf(k)])),
  defaults: {},
};

function isInterval(v: unknown): v is readonly [number, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number" && v[0] <= v[1];
}

function summaryOfNode(kind: KindName) {
  return (input: EvalInput): Result => {
    if (kind === "num") {
      const v = input.doc.value;
      return typeof v === "number" && Number.isFinite(v) ? ok(numSummary(v)) : fail("#VALUE!", "num needs a finite number.");
    }
    if (kind === "var") {
      const name = input.doc.value;
      if (typeof name !== "string") return fail("#VALUE!", "var needs a name.");
      const given = input.context.names[name];
      return ok(varSummary(name, isInterval(given) ? given : undefined));
    }
    const parts: Summary[] = [];
    for (const part of input.parts) {
      const r = part.evaluate();
      if (!r.ok) return r;
      parts.push(r.value as Summary);
    }
    const data = (input.data ?? {}) as NodeData;
    return ok(combine(kind, parts, data));
  };
}

/** The rules of a compiled verb: a literal, a variable at a position, and a node from the cells of its parts. */
interface CompiledRules<C> {
  num(value: number): C;
  variable(index: number): C;
  node(kind: KindName, parts: readonly C[], data: NodeData): C;
}

/** This function gives the evaluator of one kind for a compiled verb. */
function compiledOfNode<C>(kind: KindName, rules: CompiledRules<C>) {
  return (input: EvalInput): Result => {
    if (kind === "num") {
      const v = input.doc.value;
      return typeof v === "number" && Number.isFinite(v) ? ok(rules.num(v)) : fail("#VALUE!", "num needs a finite number.");
    }
    if (kind === "var") {
      const name = input.doc.value;
      const index = typeof name === "string" ? input.context.names[name] : undefined;
      return typeof index === "number" ? ok(rules.variable(index)) : fail("#NAME?", `The variable ${String(name)} has no position.`);
    }
    const parts: C[] = [];
    for (const part of input.parts) {
      const r = part.evaluate();
      if (!r.ok) return r;
      parts.push(r.value as C);
    }
    return ok(rules.node(kind, parts, (input.data ?? {}) as NodeData));
  };
}

const RULES: Readonly<Record<(typeof COMPILED)[number], CompiledRules<unknown>>> = {
  [FLOAT]: { num: floatNum, variable: floatVar, node: (k, p, d) => floatNode(k, p as FloatCell[], d) },
  [INTERVAL]: { num: intervalNum, variable: intervalVar, node: (k, p, d) => intervalNode(k, p as IntervalCell[], d) },
  [BALL]: { num: ballNum, variable: ballVar, node: (k, p, d) => ballNode(k, p as BallCell[], d) },
  [EXACT]: { num: exactNum, variable: exactVar, node: (k, p, d) => exactNode(k, p as ExactCell[], d) },
  [BIGFLOAT]: { num: bigfloatNum, variable: bigfloatVar, node: (k, p, d) => bigfloatNode(k, p as BigfloatCell[], d) },
};

/** The machine of the verbs `summary`, `float`, `interval`, `ball`, `exact` and `bigfloat` for the expression kinds. */
export const expressionMachine: Machine = {
  world: expressionWorld,
  evaluators: Object.fromEntries(
    KINDS.flatMap((k) => [
      [evaluatorName(k), summaryOfNode(k)],
      ...COMPILED.map((v) => [evaluatorName(k, v), compiledOfNode(k, RULES[v])]),
    ]),
  ),
};

/** The options of `summarize`. */
export interface SummarizeOptions {
  /** The bounds of each variable. A variable without bounds has the whole line. */
  readonly bounds?: Readonly<Record<string, Interval & readonly [number, number]>>;
}

/**
 * This function gives the summary of a document with the verb `summary` of coeval.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The bounds of the variables.
 * @returns The summary, or the error of coeval.
 */
export function summarize(doc: Document, options: SummarizeOptions = {}): Result<Summary> {
  // No fold: a `var` reads the bounds from the context of each evaluation, so a part must not freeze at compile time.
  const plan = prepare(expressionMachine, doc, { verb: SUMMARY, fold: false });
  return plan.evaluate(makeContext(options.bounds ?? {})) as Result<Summary>;
}

/** The options of `compileFloat`, `compileInterval`, `compileBall`, `compileExact` and `compileBigfloat`. */
export interface CompileFloatOptions {
  /** The order of the values of a call. The default is the free variables, sorted. The list must have each free variable. */
  readonly variables?: readonly string[];
}

/** A compiled document: the order of its variables and the function of their values. */
export interface FloatFunction {
  /** The names of the variables, in the order of the values of `evaluate`. */
  readonly variables: readonly string[];
  /**
   * This function gives the float value and the bound of its error at one point. It uses only the closures of the
   * compilation. It has no `eval`, and it does not use coeval.
   *
   * @param values - The value of each variable, in the order of `variables`.
   * @returns The value and the bound of its error.
   */
  evaluate(values: ArrayLike<number>): FloatResult;
}

/**
 * This function compiles a document one time with a compiled verb of coeval. It gives the order of the variables and
 * the cell of the root.
 */
function compileWith<C>(verb: string, doc: Document, options: CompileFloatOptions): Result<{ variables: string[]; root: C }> {
  const summary = summarize(doc);
  if (!summary.ok) return summary;
  const variables = options.variables ?? summary.value.free;
  const missing = summary.value.free.filter((name) => !variables.includes(name));
  if (missing.length > 0) return fail("#NAME?", `The variables have no position: ${missing.join(", ")}.`);
  const positions = Object.fromEntries(variables.map((name, i) => [name, i]));
  const plan = prepare(expressionMachine, doc, { verb, fold: false });
  const made = plan.evaluate(makeContext(positions));
  if (!made.ok) return made;
  return ok({ variables: [...variables], root: made.value as C });
}

/** This function refuses a call with fewer values than variables. */
function checkCount(values: ArrayLike<unknown>, count: number): void {
  if (values.length < count) throw new RangeError(`The call needs ${count} values, not ${values.length}.`);
}

/**
 * This function compiles a document one time with the verb `float` of coeval. The result is a tree of closures, one
 * closure for each node. Each call gives a value and a bound of its error. A result is not a value alone at any time.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The order of the variables.
 * @returns The compiled function, or the error of coeval.
 */
export function compileFloat(doc: Document, options: CompileFloatOptions = {}): Result<FloatFunction> {
  const made = compileWith<FloatCell>(FLOAT, doc, options);
  if (!made.ok) return made;
  const { variables, root } = made.value;
  const run = root.run;
  return ok({
    variables,
    evaluate(values) {
      checkCount(values, variables.length);
      const value = run(values);
      return { value, error: root.error };
    },
  });
}

/** A document compiled with the verb `interval`. */
export interface IntervalFunction {
  /** The names of the variables, in the order of the values of `evaluate`. */
  readonly variables: readonly string[];
  /**
   * This function gives an interval that contains the exact value at each point of the inputs. It uses only the
   * closures of the compilation.
   *
   * @param values - The value of each variable, a number or an interval, in the order of `variables`.
   * @returns An interval, `null` when no point gives a real value, or `"no claim"`.
   */
  evaluate(values: ArrayLike<IntervalInput>): Enclosure;
}

/**
 * This function compiles a document one time with the verb `interval` of coeval. Each operation rounds outward with
 * the operations of `interval`. A divisor that holds zero gives no claim. An even root of a value that can be
 * negative and a variable that is not finite do too.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The order of the variables.
 * @returns The compiled function, or the error of coeval.
 */
export function compileInterval(doc: Document, options: CompileFloatOptions = {}): Result<IntervalFunction> {
  const made = compileWith<IntervalCell>(INTERVAL, doc, options);
  if (!made.ok) return made;
  const { variables, root } = made.value;
  const run = root.run;
  return ok({
    variables,
    evaluate(values) {
      checkCount(values, variables.length);
      return run(values);
    },
  });
}

/** A document compiled with the verb `ball`. */
export interface BallFunction {
  /** The names of the variables, in the order of the values of `evaluate`. */
  readonly variables: readonly string[];
  /**
   * This function gives a ball that contains the exact value at each point of the input balls. It uses only the
   * closures of the compilation.
   *
   * @param values - The value of each variable, a number or a ball, in the order of `variables`.
   * @returns The midpoint and the radius. A radius of `Infinity` makes no claim.
   */
  evaluate(values: ArrayLike<BallInput>): Ball;
}

/**
 * This function compiles a document one time with the verb `ball` of coeval. The midpoint is the float value of the
 * verb `float`, and the radius rounds upward. A radius of `Infinity` makes no claim.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The order of the variables.
 * @returns The compiled function, or the error of coeval.
 */
export function compileBall(doc: Document, options: CompileFloatOptions = {}): Result<BallFunction> {
  const made = compileWith<BallCell>(BALL, doc, options);
  if (!made.ok) return made;
  const { variables, root } = made.value;
  const run = root.run;
  return ok({
    variables,
    evaluate(values) {
      checkCount(values, variables.length);
      const mid = run(values);
      return { mid, rad: root.rad };
    },
  });
}

/** A document compiled with the verb `exact`. */
export interface ExactFunction {
  /** The names of the variables, in the order of the values of `evaluate`. */
  readonly variables: readonly string[];
  /**
   * This function gives the exact value at one point. It uses only the closures of the compilation.
   *
   * @param values - The value of each variable, in the order of `variables`.
   * @returns A rational with no error, `null` when the point gives no real value, or `"no claim"`.
   */
  evaluate(values: ArrayLike<number>): ExactResult;
}

/**
 * This function compiles a document one time with the verb `exact` of coeval. Each call gives the exact rational value.
 * It costs more than the float verbs, because each operation is on `bigint`.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The order of the variables.
 * @returns The compiled function, or the error of coeval.
 */
export function compileExact(doc: Document, options: CompileFloatOptions = {}): Result<ExactFunction> {
  const made = compileWith<ExactCell>(EXACT, doc, options);
  if (!made.ok) return made;
  const { variables, root } = made.value;
  const run = root.run;
  return ok({
    variables,
    evaluate(values) {
      checkCount(values, variables.length);
      return run(values);
    },
  });
}

/** A claim of the verb `bigfloat`: an interval that contains the exact value, and the bound of its error. */
export interface BigfloatClaim extends BigInterval {
  /** The width `high - low`, rounded up: the bound of `|v - exact|` for each `v` in the interval. */
  readonly error: BigFloat;
}

/** The result of a call of the verb `bigfloat`: a claim, `null` for no real value, or `"no claim"`. */
export type BigfloatResult = BigfloatClaim | Exclude<BigEnclosure, BigInterval>;

/** A document compiled with the verb `bigfloat`. */
export interface BigfloatFunction {
  /** The names of the variables, in the order of the values of `evaluate`. */
  readonly variables: readonly string[];
  /**
   * This function gives an interval that contains the exact value at one point, and the bound of its error. It uses only
   * the closures of the compilation.
   *
   * @param values - The value of each variable, in the order of `variables`.
   * @param precision - The precision of each operation in bits, a whole number of 1 or more.
   * @returns A claim, `null` when the point gives no real value, or `"no claim"`.
   * @throws RangeError when the precision is not a whole number of 1 or more.
   */
  evaluate(values: ArrayLike<number>, precision: number): BigfloatResult;
}

/**
 * This function compiles a document one time with the verb `bigfloat` of coeval. Each call selects its precision, so a
 * caller can repeat a call at a higher precision with no new compilation. Each operation rounds correctly and outward.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The order of the variables.
 * @returns The compiled function, or the error of coeval.
 */
export function compileBigfloat(doc: Document, options: CompileFloatOptions = {}): Result<BigfloatFunction> {
  const made = compileWith<BigfloatCell>(BIGFLOAT, doc, options);
  if (!made.ok) return made;
  const { variables, root } = made.value;
  const run = root.run;
  return ok({
    variables,
    evaluate(values, precision) {
      checkCount(values, variables.length);
      // this call refuses a bad precision also for a document that has no operation
      B.zero(precision);
      const r = run(values, precision);
      if (r === null || r === NO_CLAIM) return r;
      return { low: r.low, high: r.high, error: B.sub(r.high, r.low, { precision, rounding: "up" }) };
    },
  });
}
