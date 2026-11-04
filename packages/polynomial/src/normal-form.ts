/**
 * The verb `polynomial` of roadmap item A8. This verb is a new answer of the expression kinds: the documents and the
 * package `@mark1russell7/expression` do not change. The machine of this module adds the verb to the kinds.
 *
 * The result of a node is one of three values, as in the verb `exact`:
 *
 * - a polynomial: a claim. The node and the polynomial have the same exact value at each real point, so they are equal
 *   as functions. The error is zero, and the node has a real value at each point.
 * - `null`: a claim. The node has no real value at any point, for example a quotient by `x - x`.
 * - `"no claim"`: the verb cannot tell. The value of the node can be a function that no polynomial holds, or a node can
 *   be past a limit.
 *
 * Only a total function has a normal form. Thus `x / x` gives no claim, because it has no value at 0, and `0 * (1 / x)`
 * gives no claim for the same reason. A part without a real value makes the node have no real value, also when another
 * part makes no claim.
 *
 * A limit applies to each node. Thus one form of a polynomial can give a claim, and another form of it can give no
 * claim. The value `"no claim"` tells nothing, and it does not tell that two documents differ.
 *
 * @packageDocumentation
 */
import { fail, makeContext, ok, prepare } from "@mark1russell7/coeval";
import type { EvalInput, Kind, Machine, Result } from "@mark1russell7/coeval";
import { expressionMachine, KINDS, NO_CLAIM } from "@mark1russell7/expression";
import type { Document, Expression, KindName, NodeData } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { toDocument } from "./document.ts";
import { constant, constantOf, key, LIMITS, multiply, negate, ONE, power, scale, subtract, sum, variable, within, ZERO } from "./polynomial.ts";
import type { Limits, Polynomial } from "./polynomial.ts";

/** The verb that gives the normal form of a node. */
export const POLYNOMIAL = "polynomial";

/** The result of a node for the verb `polynomial`: a polynomial, `null` for no real value, or `"no claim"`. */
export type PolynomialResult = Polynomial | null | typeof NO_CLAIM;

/**
 * The claim of a document. Each claim states its error.
 *
 * - `polynomial`: the document and `polynomial` have the same exact value at each real point. The error is zero.
 * - `no value`: the document has no real value at any point. The error is zero.
 * - `no claim`: the verb cannot tell. The error is `Infinity`.
 */
export type NormalForm =
  | { readonly kind: "polynomial"; readonly polynomial: Polynomial; readonly key: string; readonly error: 0 }
  | { readonly kind: "no value"; readonly error: 0 }
  | { readonly kind: typeof NO_CLAIM; readonly error: number };

/** This function gives the constant of a difference, and `undefined` when the two polynomials differ by more. */
const gap = (a: Polynomial, b: Polynomial): Rational | undefined => constantOf(subtract(a, b));

/**
 * The rule of `min` and `max`. Two parts that differ by a constant have a known order at each point. Each other pair
 * makes no claim. To differ by a constant is an equivalence, so the order of the parts does not change the result.
 */
function extreme(parts: readonly Polynomial[], keepRight: (difference: -1 | 0 | 1) => boolean): PolynomialResult {
  let best = parts[0] as Polynomial;
  for (const part of parts.slice(1)) {
    const difference = gap(best, part);
    if (difference === undefined) return NO_CLAIM;
    if (keepRight(Q.sign(difference))) best = part;
  }
  return best;
}

/** The rule of a comparison. A difference that is a constant gives one truth value at each point. */
function comparison(a: Polynomial, b: Polynomial, holds: (difference: -1 | 0 | 1) => boolean): PolynomialResult {
  const difference = gap(a, b);
  if (difference === undefined) return NO_CLAIM;
  return holds(Q.sign(difference)) ? ONE : ZERO;
}

/** The rule of a whole power. A negative power has a polynomial only for a constant base that is not zero. */
function powerOf(base: Polynomial, exponent: number, limits: Limits): PolynomialResult {
  if (exponent >= 0) return power(base, exponent, limits);
  const value = constantOf(base);
  if (value === undefined) return NO_CLAIM;
  if (Q.sign(value) === 0) return null;
  return power(constant(Q.inverse(value)), -exponent, limits);
}

/** The rule of a quotient. A divisor that is not a constant has zeros, or it needs a rational function. */
function quotient(a: Polynomial, b: Polynomial): PolynomialResult {
  const value = constantOf(b);
  if (value === undefined) return NO_CLAIM;
  return Q.sign(value) === 0 ? null : scale(a, Q.inverse(value));
}

/** The rule of a root, as in the verb `exact`. A radicand that is not a constant makes no claim. */
function rootOf(radicand: Polynomial, index: number, limits: Limits): PolynomialResult {
  const value = constantOf(radicand);
  if (value === undefined) return NO_CLAIM;
  if (Q.sign(value) < 0 && index % 2 === 0) return null;
  if (index > limits.maxDegree) return NO_CLAIM;
  const root = Q.root(value, index);
  return root === null ? NO_CLAIM : constant(root);
}

/** This function gives the result of a node from the polynomials of its parts. */
function ruleOf(kind: KindName, parts: readonly Polynomial[], data: NodeData, limits: Limits): PolynomialResult {
  const [a, b] = parts as [Polynomial, Polynomial];
  switch (kind) {
    case "add":
      return sum(parts);
    case "sub":
      return subtract(a, b);
    case "neg":
      return negate(a);
    case "mul": {
      let out: Polynomial = a;
      for (const part of parts.slice(1)) {
        const next = multiply(out, part, limits);
        if (next === NO_CLAIM) return NO_CLAIM;
        out = next;
      }
      return out;
    }
    case "div":
      return quotient(a, b);
    case "pow":
      return powerOf(a, data.exp as number, limits);
    case "root":
      return rootOf(a, data.index as number, limits);
    case "min":
      return extreme(parts, (s) => s > 0);
    case "max":
      return extreme(parts, (s) => s < 0);
    case "lt":
      return comparison(a, b, (s) => s < 0);
    case "le":
      return comparison(a, b, (s) => s <= 0);
    case "eq":
      return comparison(a, b, (s) => s === 0);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts.`);
  }
}

/**
 * The rules of a verb with the three results of this module: a value, `null` for no real value, or `"no claim"`. A node
 * with a part without a real value has no real value, also when another part makes no claim. A node with a part that
 * makes no claim makes no claim.
 */
export interface VerbRules<T> {
  readonly constant: (value: Rational) => T;
  readonly variable: (name: string) => T;
  readonly node: (kind: KindName, parts: readonly T[], data: NodeData) => T | null | typeof NO_CLAIM;
}

/** This function gives the evaluator of one kind for a verb. */
function nodeEvaluator<T>(kind: KindName, rules: VerbRules<T>) {
  return (input: EvalInput): Result => {
    if (kind === "num") {
      const v = input.doc.value;
      return typeof v === "number" && Number.isFinite(v) ? ok(rules.constant(Q.fromFloat(v))) : fail("#VALUE!", "num needs a finite number.");
    }
    if (kind === "var") {
      const name = input.doc.value;
      return typeof name === "string" ? ok(rules.variable(name)) : fail("#VALUE!", "var needs a name.");
    }
    const parts: T[] = [];
    let open = false;
    let none = false;
    for (const part of input.parts) {
      const r = part.evaluate();
      if (!r.ok) return r;
      const value = r.value as T | null | typeof NO_CLAIM;
      if (value === null) none = true;
      else if (value === NO_CLAIM) open = true;
      else parts.push(value);
    }
    if (none) return ok(null);
    if (open) return ok(NO_CLAIM);
    return ok(rules.node(kind, parts, (input.data ?? {}) as NodeData));
  };
}

/**
 * This function adds a verb to the expression kinds of a machine. The documents do not change, and each other verb
 * stays.
 *
 * @param machine - The machine.
 * @param verb - The name of the verb.
 * @param rules - The rules of the verb.
 * @returns The machine with the verb.
 */
export function addVerb<T>(machine: Machine, verb: string, rules: VerbRules<T>): Machine {
  const nameOf = (kind: KindName): string => `expression.${verb}.${kind}`;
  const kindOf = (name: KindName): Kind => {
    const kind = machine.world.kinds[name] as Kind;
    return { ...kind, verbs: { ...kind.verbs, [verb]: nameOf(name) }, verbEffects: { ...kind.verbEffects, [verb]: [] } };
  };
  return {
    ...machine,
    world: { ...machine.world, kinds: Object.fromEntries(KINDS.map((k) => [k, kindOf(k)])) },
    evaluators: { ...machine.evaluators, ...Object.fromEntries(KINDS.map((k) => [nameOf(k), nodeEvaluator(k, rules)])) },
  };
}

/**
 * This function gives the machine of the expression kinds with the verb `polynomial`. Each verb of
 * `expressionMachine` stays.
 *
 * @param limits - The limits of each node.
 * @returns The machine.
 */
export function polynomialMachine(limits: Limits = LIMITS): Machine {
  return addVerb<Polynomial>(expressionMachine, POLYNOMIAL, {
    constant,
    variable,
    node: (kind, parts, data) => {
      const result = ruleOf(kind, parts, data, limits);
      return result === null || result === NO_CLAIM ? result : within(result, limits);
    },
  });
}

const DEFAULT_MACHINE = polynomialMachine();

/** This function gives the result of the root node of a document. */
function resultOf(doc: Document, limits: Limits): Result<PolynomialResult> {
  const machine = limits === LIMITS ? DEFAULT_MACHINE : polynomialMachine(limits);
  return prepare(machine, doc, { verb: POLYNOMIAL, fold: false }).evaluate(makeContext({})) as Result<PolynomialResult>;
}

/**
 * This function gives the normal form of a document. Two documents with the kind `polynomial` have equal keys when, and
 * only when, they are equal as functions.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param limits - The limits of each node. The default is `LIMITS`.
 * @returns The claim, or the error of coeval.
 */
export function normalForm(doc: Document, limits: Limits = LIMITS): Result<NormalForm> {
  const made = resultOf(doc, limits);
  if (!made.ok) return made;
  const p = made.value;
  if (p === NO_CLAIM) return ok({ kind: NO_CLAIM, error: Infinity });
  if (p === null) return ok({ kind: "no value", error: 0 });
  return ok({ kind: "polynomial", polynomial: p, key: key(p), error: 0 });
}

/**
 * This function simplifies a document by its normal form. The result has the same exact value as `doc` at each real
 * point, and equal polynomials give equal documents. A second call on the result gives the same document.
 *
 * @param doc - The document. Use `documentSchema` to check a document from outside.
 * @param limits - The limits of each node. The default is `LIMITS`.
 * @returns The document, `null` when `doc` has no real value at any point, `"no claim"`, or the error of coeval.
 */
export function simplify(doc: Document, limits: Limits = LIMITS): Result<Expression | null | typeof NO_CLAIM> {
  const made = resultOf(doc, limits);
  if (!made.ok) return made;
  const p = made.value;
  return ok(p === null || p === NO_CLAIM ? p : toDocument(p));
}
