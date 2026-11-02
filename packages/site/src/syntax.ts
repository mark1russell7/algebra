/**
 * The text form of the expression documents for the playground. The parser and the printer are the ones of coeval,
 * with a profile of the expression kinds. Only the last step changes the references of coeval into variables.
 *
 * @packageDocumentation
 */
import { parse, print } from "@mark1russell7/coeval";
import type { SyntaxProfile } from "@mark1russell7/coeval";
import { documentSchema } from "@mark1russell7/expression";
import type { Document } from "@mark1russell7/expression";

/** The text syntax of the expression kinds: `+ - * /`, a minus sign, and the calls `pow`, `root`, `min` and `max`. */
export const EXPRESSION_SYNTAX: SyntaxProfile = {
  operators: [
    { symbol: "<", fixity: "infix", prec: 1, assoc: "none", kind: "lt" },
    { symbol: "<=", fixity: "infix", prec: 1, assoc: "none", kind: "le" },
    { symbol: "=", fixity: "infix", prec: 1, assoc: "none", kind: "eq" },
    { symbol: "+", fixity: "infix", prec: 2, assoc: "left", kind: "add" },
    { symbol: "-", fixity: "infix", prec: 2, assoc: "left", kind: "sub" },
    { symbol: "*", fixity: "infix", prec: 3, assoc: "left", kind: "mul" },
    { symbol: "/", fixity: "infix", prec: 3, assoc: "left", kind: "div" },
    { symbol: "-", fixity: "prefix", prec: 4, kind: "neg" },
  ],
  literals: { numbers: true, signed: false, strings: false, words: {}, envelopes: { number: "num" } },
  refs: { fields: false, roots: [] },
  calls: {
    ops: false,
    forms: [
      { name: "pow", kind: "pow", fields: ["base", "exp"], wrap: ["base"] },
      { name: "root", kind: "root", fields: ["radicand", "index"], wrap: ["radicand"] },
      { name: "min", kind: "min", args: "list", min: 2, wrap: true },
      { name: "max", kind: "max", args: "list", min: 2, wrap: true },
    ],
  },
};

/** The result of `readExpression`: a document, or a message with the place of the problem. */
export type ReadResult =
  | { readonly ok: true; readonly doc: Document }
  | { readonly ok: false; readonly message: string; readonly offset: number | null };

/**
 * This function changes the output of the coeval parser into an expression document. A bare number becomes `num`,
 * a reference `names.x` becomes the variable `x`, and the list of one part of a minus sign becomes the part.
 */
export function toDocument(node: unknown): unknown {
  if (typeof node === "number") return { type: "num", value: node };
  if (Array.isArray(node)) return node.map(toDocument);
  if (node === null || typeof node !== "object") return node;
  const { type, value } = node as { type?: unknown; value?: unknown };
  if (type === "ref" && Array.isArray(value) && value.length === 2 && value[0] === "names") return { type: "var", value: value[1] };
  if (type === "num") return node;
  if (type === "neg" && Array.isArray(value) && value.length === 1) return { type, value: toDocument(value[0]) };
  if (type === "pow" || type === "root") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) out[k] = k === "exp" || k === "index" ? v : toDocument(v);
    return { type, value: out };
  }
  return { type, value: toDocument(value) };
}

/**
 * This function reads the text of an expression. The zod schema of the package checks the document.
 *
 * @param text - The text, for example `(a + b) - a`.
 * @returns The document, or the first problem.
 */
export function readExpression(text: string): ReadResult {
  const parsed = parse(EXPRESSION_SYNTAX, text);
  if (!parsed.ok) {
    const issue = parsed.issues[0];
    return { ok: false, message: issue?.message ?? "The text is not an expression.", offset: issue?.offset ?? null };
  }
  const checked = documentSchema.safeParse(toDocument(parsed.doc));
  if (!checked.success) {
    const issue = checked.error.issues[0];
    const at = issue === undefined || issue.path.length === 0 ? "" : ` at ${issue.path.join(".")}`;
    return { ok: false, message: `The text is not an expression of the package${at}. A power and a root need a whole number.`, offset: null };
  }
  return { ok: true, doc: checked.data };
}

/** This function changes an expression document back into the form of the coeval printer. It undoes `toDocument`. */
export function toSyntax(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toSyntax);
  if (node === null || typeof node !== "object") return node;
  const { type, value } = node as { type?: unknown; value?: unknown };
  if (type === "var") return { type: "ref", value: ["names", value] };
  if (type === "num") return value;
  if (type === "neg") return { type, value: [toSyntax(value)] };
  if (type === "pow" || type === "root") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toSyntax(v);
    return { type, value: out };
  }
  return { type, value: toSyntax(value) };
}

/** This function writes a document as text with the same profile. */
export function writeExpression(doc: Document): string {
  const r = print(EXPRESSION_SYNTAX, toSyntax(doc));
  return r.ok ? (r.value as string) : JSON.stringify(doc);
}
