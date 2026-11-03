/**
 * The coeval kinds of the expression documents and the machine of the verbs `summary` and `float`. An evaluator of a
 * later item adds its own verb to these kinds. The documents do not change.
 *
 * @packageDocumentation
 */
import { fail, makeContext, ok, prepare } from "@mark1russell7/coeval";
import type { EvalInput, Kind, Machine, Result, World } from "@mark1russell7/coeval";

/** The shape of the value of a kind (the field `parts` of a coeval kind). */
export type Shape = NonNullable<Kind["parts"]>;
import { floatNode, floatNum, floatVar } from "./float.ts";
import type { FloatCell, FloatResult } from "./float.ts";
import type { Interval } from "./interval.ts";
import type { Document } from "./schema.ts";
import { combine, numSummary, varSummary } from "./summary.ts";
import type { KindName, NodeData, Summary } from "./summary.ts";

/** The verb that gives the summary of a node. */
export const SUMMARY = "summary";
/** The verb that compiles a node into float code with a bound of its error (roadmap item A3). */
export const FLOAT = "float";

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
    verbs: { [SUMMARY]: evaluatorName(name), [FLOAT]: evaluatorName(name, FLOAT) },
    parts: SHAPES[name],
    pure: true,
    verbEffects: { [SUMMARY]: [], [FLOAT]: [] },
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

function floatOfNode(kind: KindName) {
  return (input: EvalInput): Result => {
    if (kind === "num") {
      const v = input.doc.value;
      return typeof v === "number" && Number.isFinite(v) ? ok(floatNum(v)) : fail("#VALUE!", "num needs a finite number.");
    }
    if (kind === "var") {
      const name = input.doc.value;
      const index = typeof name === "string" ? input.context.names[name] : undefined;
      return typeof index === "number" ? ok(floatVar(index)) : fail("#NAME?", `The variable ${String(name)} has no position.`);
    }
    const parts: FloatCell[] = [];
    for (const part of input.parts) {
      const r = part.evaluate();
      if (!r.ok) return r;
      parts.push(r.value as FloatCell);
    }
    return ok(floatNode(kind, parts, (input.data ?? {}) as NodeData));
  };
}

/** The machine of the verbs `summary` and `float` for the expression kinds. */
export const expressionMachine: Machine = {
  world: expressionWorld,
  evaluators: Object.fromEntries(
    KINDS.flatMap((k) => [
      [evaluatorName(k), summaryOfNode(k)],
      [evaluatorName(k, FLOAT), floatOfNode(k)],
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

/** The options of `compileFloat`. */
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
 * This function compiles a document one time with the verb `float` of coeval. The result is a tree of closures, one
 * closure for each node. Each call gives a value and a bound of its error. A result is not a value alone at any time.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param options - The order of the variables.
 * @returns The compiled function, or the error of coeval.
 */
export function compileFloat(doc: Document, options: CompileFloatOptions = {}): Result<FloatFunction> {
  const summary = summarize(doc);
  if (!summary.ok) return summary;
  const variables = options.variables ?? summary.value.free;
  const missing = summary.value.free.filter((name) => !variables.includes(name));
  if (missing.length > 0) return fail("#NAME?", `The variables have no position: ${missing.join(", ")}.`);
  const positions = Object.fromEntries(variables.map((name, i) => [name, i]));
  const plan = prepare(expressionMachine, doc, { verb: FLOAT, fold: false });
  const made = plan.evaluate(makeContext(positions));
  if (!made.ok) return made;
  const root = made.value as FloatCell;
  const run = root.run;
  const count = variables.length;
  return ok({
    variables: [...variables],
    evaluate(values) {
      if (values.length < count) throw new RangeError(`The call needs ${count} values, not ${values.length}.`);
      const value = run(values);
      return { value, error: root.error };
    },
  });
}
