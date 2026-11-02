/**
 * The coeval kinds of the expression documents and the machine of the verb `summary`. An evaluator of a later item
 * adds its own verb to these kinds. The documents do not change.
 *
 * @packageDocumentation
 */
import { fail, makeContext, ok, prepare } from "@mark1russell7/coeval";
import type { EvalInput, Kind, Machine, Result, World } from "@mark1russell7/coeval";

/** The shape of the value of a kind (the field `parts` of a coeval kind). */
export type Shape = NonNullable<Kind["parts"]>;
import type { Interval } from "./interval.ts";
import type { Document } from "./schema.ts";
import { combine, numSummary, varSummary } from "./summary.ts";
import type { KindName, NodeData, Summary } from "./summary.ts";

/** The verb that gives the summary of a node. */
export const SUMMARY = "summary";

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

const evaluatorName = (kind: KindName): string => `expression.summary.${kind}`;

function kindOf(name: KindName): Kind {
  return { verbs: { [SUMMARY]: evaluatorName(name) }, parts: SHAPES[name], pure: true, verbEffects: { [SUMMARY]: [] } };
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

/** The machine of the verb `summary` for the expression kinds. */
export const expressionMachine: Machine = {
  world: expressionWorld,
  evaluators: Object.fromEntries(KINDS.map((k) => [evaluatorName(k), summaryOfNode(k)])),
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
