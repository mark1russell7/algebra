/**
 * The verb `rational` of roadmap item A8. This verb is a new answer of the expression kinds: the documents and the package
 * `@mark1russell7/expression` do not change.
 *
 * The result of a node is one of three values, as in the verbs `exact` and `polynomial`:
 *
 * - a rational function: a claim. At each real point the node has a value when, and only when, the domain of the function
 *   is not 0 at the point. That value is the value of the function. The error is zero.
 * - `null`: a claim. The node has no real value at any point.
 * - `"no claim"`: the verb cannot tell. A node can hold a function that no quotient of polynomials holds, or a node can be
 *   past a limit.
 *
 * Thus `x / x` gives the value 1 and the domain `x`, and the verb `polynomial` gives no claim for it. A limit applies to
 * each node, so the value `"no claim"` does not compare two documents.
 *
 * @packageDocumentation
 */
import { makeContext, ok, prepare } from "@mark1russell7/coeval";
import type { Machine, Result } from "@mark1russell7/coeval";
import { NO_CLAIM } from "@mark1russell7/expression";
import type { Document, Expression, KindName, NodeData } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { toRationalDocument } from "./document.ts";
import { addVerb, polynomialMachine } from "./normal-form.ts";
import { constant, key as polynomialKey, LIMITS, variable } from "./polynomial.ts";
import type { Limits } from "./polynomial.ts";
import { add, constantValue, divideFunctions, fromPolynomial, key, multiply, negate, ONE_FUNCTION, power, restrict, subtract, withinLimits, ZERO_FUNCTION } from "./rational-function.ts";
import type { LimitedFunction, PartialFunction, RationalFunction } from "./rational-function.ts";

/** The verb that gives the rational function of a node. */
export const RATIONAL = "rational";

/** The result of a node for the verb `rational`: a function, `null` for no real value, or `"no claim"`. */
export type RationalResult = PartialFunction;

/**
 * The claim of a document. Each claim states its error.
 *
 * - `rational`: at each real point where `domain` of `value` is not 0, the document has the exact value of `value`. At
 *   each other real point, the document has no value. The error is zero.
 * - `no value`: the document has no real value at any point. The error is zero.
 * - `no claim`: the verb cannot tell. The error is `Infinity`.
 */
export type RationalForm =
  | { readonly kind: "rational"; readonly value: RationalFunction; readonly key: string; readonly domainKey: string; readonly error: 0 }
  | { readonly kind: "no value"; readonly error: 0 }
  | { readonly kind: typeof NO_CLAIM; readonly error: number };

/** This function folds a binary operation over the parts of a node. It stops at the first `"no claim"`. */
function fold(parts: readonly RationalFunction[], step: (a: RationalFunction, b: RationalFunction) => LimitedFunction): LimitedFunction {
  let out = parts[0] as RationalFunction;
  for (const part of parts.slice(1)) {
    const next = step(out, part);
    if (next === NO_CLAIM) return NO_CLAIM;
    out = next;
  }
  return out;
}

/** This function gives the constant of a difference, `undefined` for more than a constant, or `"no claim"`. */
function gap(a: RationalFunction, b: RationalFunction, limits: Limits): Rational | undefined | typeof NO_CLAIM {
  const difference = subtract(a, b, limits);
  return difference === NO_CLAIM ? NO_CLAIM : constantValue(difference);
}

/** The rule of `min` and `max`: two parts that differ by a constant have a known order at each point with a value. */
function extreme(parts: readonly RationalFunction[], keepRight: (difference: -1 | 0 | 1) => boolean, limits: Limits): RationalResult {
  let best = parts[0] as RationalFunction;
  let domain = best.domain;
  for (const part of parts.slice(1)) {
    const difference = gap(best, part, limits);
    if (difference === undefined || difference === NO_CLAIM) return NO_CLAIM;
    const joined = restrict(part, domain, limits);
    if (joined === NO_CLAIM) return NO_CLAIM;
    domain = joined.domain;
    if (keepRight(Q.sign(difference))) best = part;
  }
  return restrict(best, domain, limits);
}

/** The rule of a comparison: a difference that is a constant gives one truth value at each point with a value. */
function comparison(a: RationalFunction, b: RationalFunction, holds: (difference: -1 | 0 | 1) => boolean, limits: Limits): RationalResult {
  const difference = gap(a, b, limits);
  if (difference === undefined || difference === NO_CLAIM) return NO_CLAIM;
  const domain = restrict(a, b.domain, limits);
  return domain === NO_CLAIM ? NO_CLAIM : { ...(holds(Q.sign(difference)) ? ONE_FUNCTION : ZERO_FUNCTION), domain: domain.domain };
}

/** The rule of a root, as in the verb `exact`. A radicand that is not a constant makes no claim. */
function rootOf(radicand: RationalFunction, index: number, limits: Limits): RationalResult {
  const value = constantValue(radicand);
  if (value === undefined) return NO_CLAIM;
  if (Q.sign(value) < 0 && index % 2 === 0) return null;
  if (index > limits.maxDegree) return NO_CLAIM;
  const root = Q.root(value, index);
  return root === null ? NO_CLAIM : { ...fromPolynomial(constant(root)), domain: radicand.domain };
}

/** This function gives the result of a node from the functions of its parts. */
function ruleOf(kind: KindName, parts: readonly RationalFunction[], data: NodeData, limits: Limits): RationalResult {
  const [a, b] = parts as [RationalFunction, RationalFunction];
  switch (kind) {
    case "add":
      return fold(parts, (l, r) => add(l, r, limits));
    case "sub":
      return subtract(a, b, limits);
    case "neg":
      return negate(a);
    case "mul":
      return fold(parts, (l, r) => multiply(l, r, limits));
    case "div":
      return divideFunctions(a, b, limits);
    case "pow":
      return power(a, data.exp as number, limits);
    case "root":
      return rootOf(a, data.index as number, limits);
    case "min":
      return extreme(parts, (s) => s > 0, limits);
    case "max":
      return extreme(parts, (s) => s < 0, limits);
    case "lt":
      return comparison(a, b, (s) => s < 0, limits);
    case "le":
      return comparison(a, b, (s) => s <= 0, limits);
    case "eq":
      return comparison(a, b, (s) => s === 0, limits);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts.`);
  }
}

/**
 * This function gives the machine of the expression kinds with the verbs `polynomial` and `rational`. Each verb of
 * `expressionMachine` stays.
 *
 * @param limits - The limits of each node.
 * @returns The machine.
 */
export function rationalMachine(limits: Limits = LIMITS): Machine {
  return addVerb<RationalFunction>(polynomialMachine(limits), RATIONAL, {
    constant: (value) => fromPolynomial(constant(value)),
    variable: (name) => fromPolynomial(variable(name)),
    node: (kind, parts, data) => {
      const result = ruleOf(kind, parts, data, limits);
      return result === null || result === NO_CLAIM ? result : withinLimits(result, limits);
    },
  });
}

const DEFAULT_MACHINE = rationalMachine();

/** This function gives the result of the root node of a document. */
function resultOf(doc: Document, limits: Limits): Result<RationalResult> {
  const machine = limits === LIMITS ? DEFAULT_MACHINE : rationalMachine(limits);
  return prepare(machine, doc, { verb: RATIONAL, fold: false }).evaluate(makeContext({})) as Result<RationalResult>;
}

/**
 * This function gives the rational form of a document. Two documents with the kind `rational` have equal keys when, and
 * only when, they are one element of the field of rational functions. Two documents with equal keys and equal domain keys
 * have one value at each real point. Two different domain keys can have one real zero set: `x^2 + 1` and `1` have no real
 * zero, so equal documents can have different domain keys.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param limits - The limits of each node. The default is `LIMITS`.
 * @returns The claim, or the error of coeval.
 */
export function rationalForm(doc: Document, limits: Limits = LIMITS): Result<RationalForm> {
  const made = resultOf(doc, limits);
  if (!made.ok) return made;
  const f = made.value;
  if (f === NO_CLAIM) return ok({ kind: NO_CLAIM, error: Infinity });
  if (f === null) return ok({ kind: "no value", error: 0 });
  return ok({ kind: "rational", value: f, key: key(f), domainKey: polynomialKey(f.domain), error: 0 });
}

/**
 * This function simplifies a document by its rational form. The result has the same exact value as `doc` at each real
 * point, and it has no value at the same points. Thus `x / x` gives `1 + 0 / x`, which keeps the hole at 0. A second call
 * on the result gives the same document.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param limits - The limits of each node. The default is `LIMITS`.
 * @returns The document, `null` when `doc` has no real value at any point, `"no claim"`, or the error of coeval.
 */
export function simplifyRational(doc: Document, limits: Limits = LIMITS): Result<Expression | null | typeof NO_CLAIM> {
  const made = resultOf(doc, limits);
  if (!made.ok) return made;
  const f = made.value;
  return ok(f === null || f === NO_CLAIM ? f : toRationalDocument(f, limits));
}
