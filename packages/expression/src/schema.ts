/**
 * The zod schema of the expression documents. A document is a coeval envelope `{ type, value }`. Each child is an
 * envelope too: the schema permits no bare values.
 *
 * @packageDocumentation
 */
import { z } from "zod";

/**
 * A number literal: a finite float that means its exact binary value. The schema refuses `-0`, because JSON writes it
 * as `0` and the real value is the same.
 */
export interface Num {
  readonly type: "num";
  readonly value: number;
}
/** A variable. Its name starts with a letter or `_`, and has only letters, digits and `_`. */
export interface Var {
  readonly type: "var";
  readonly value: string;
}
/** A sum, product, smallest or largest of two parts or more. */
export interface Nary {
  readonly type: "add" | "mul" | "min" | "max";
  readonly value: readonly [Expression, Expression, ...Expression[]];
}
/** A difference or quotient of two parts. */
export interface Binary {
  readonly type: "sub" | "div";
  readonly value: readonly [Expression, Expression];
}
/** A negation of one part. */
export interface Neg {
  readonly type: "neg";
  readonly value: Expression;
}
/** A whole power of a part. The power zero gives one, also for a base of zero. */
export interface Pow {
  readonly type: "pow";
  readonly value: { readonly base: Expression; readonly exp: number };
}
/** The real root of a part, with a whole index of 2 or more. An even root of a negative value has no real value. */
export interface Root {
  readonly type: "root";
  readonly value: { readonly radicand: Expression; readonly index: number };
}
/** An expression: a document whose value is a real number. */
export type Expression = Num | Var | Nary | Binary | Neg | Pow | Root;

/** A comparison of two expressions: `<`, `<=` or `=`. Its value is true or false. */
export interface Comparison {
  readonly type: "lt" | "le" | "eq";
  readonly value: readonly [Expression, Expression];
}

/** A document of this package: an expression or a comparison. */
export type Document = Expression | Comparison;

/** The pattern of a variable name. */
export const VARIABLE_NAME: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

const finite = z
  .number()
  .refine(Number.isFinite, "A number literal must be finite.")
  .refine((v) => !Object.is(v, -0), "Write the number literal -0 as 0.");

/** The schema of an expression. */
export const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z.strictObject({ type: z.literal("num"), value: finite }),
    z.strictObject({ type: z.literal("var"), value: z.string().regex(VARIABLE_NAME) }),
    z.strictObject({
      type: z.enum(["add", "mul", "min", "max"]),
      value: z.tuple([expressionSchema, expressionSchema], expressionSchema),
    }),
    z.strictObject({ type: z.enum(["sub", "div"]), value: z.tuple([expressionSchema, expressionSchema]) }),
    z.strictObject({ type: z.literal("neg"), value: expressionSchema }),
    z.strictObject({
      type: z.literal("pow"),
      value: z.strictObject({ base: expressionSchema, exp: z.number().int() }),
    }),
    z.strictObject({
      type: z.literal("root"),
      value: z.strictObject({ radicand: expressionSchema, index: z.number().int().min(2) }),
    }),
  ]),
);

/** The schema of a comparison. */
export const comparisonSchema: z.ZodType<Comparison> = z.strictObject({
  type: z.enum(["lt", "le", "eq"]),
  value: z.tuple([expressionSchema, expressionSchema]),
});

/** The schema of a document: an expression or a comparison. */
export const documentSchema: z.ZodType<Document> = z.union([expressionSchema, comparisonSchema]);
