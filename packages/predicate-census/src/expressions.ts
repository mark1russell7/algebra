/**
 * The expression documents of the predicate signs, and three evaluators of a sign: the A1 bound, the exact dyadic
 * value and the plain float value.
 *
 * @packageDocumentation
 */
import { makeContext, prepare } from "@mark1russell7/coeval";
import { expressionMachine, SUMMARY } from "@mark1russell7/expression";
import type { Expression, Summary } from "@mark1russell7/expression";
import { dyadic as D } from "@mark1russell7/predicates";
import type { Dyadic } from "@mark1russell7/predicates";

/** This function gives a variable. */
export const v = (name: string): Expression => ({ type: "var", value: name });
/** This function gives the sum of two parts. */
export const plus = (x: Expression, y: Expression): Expression => ({ type: "add", value: [x, y] });
/** This function gives the difference of two parts. */
export const minus = (x: Expression, y: Expression): Expression => ({ type: "sub", value: [x, y] });
/** This function gives the product of two parts. */
export const times = (x: Expression, y: Expression): Expression => ({ type: "mul", value: [x, y] });
/** This function gives the smaller of two parts. */
export const least = (x: Expression, y: Expression): Expression => ({ type: "min", value: [x, y] });
/** This function gives the negation of a part. */
export const negate = (x: Expression): Expression => ({ type: "neg", value: x });
/** This function gives a constant. */
export const num = (x: number): Expression => ({ type: "num", value: x });
/** This function gives the larger of two parts. */
export const most = (x: Expression, y: Expression): Expression => ({ type: "max", value: [x, y] });

/** A point of the plane, as two expressions. */
export type PointExpr = readonly [Expression, Expression];

/** This function gives the orientation `(qx - px) * (ry - py) - (qy - py) * (rx - px)` of three points. */
export function orient(p: PointExpr, q: PointExpr, r: PointExpr): Expression {
  return minus(times(minus(q[0], p[0]), minus(r[1], p[1])), times(minus(q[1], p[1]), minus(r[0], p[0])));
}

/** The value of each variable at one input. */
export type Point = Readonly<Record<string, number>>;

/** The sign of a value: `-1`, `0` or `1`. */
export type Sign = -1 | 0 | 1;

/**
 * This function gives the sign that a bound fixes. Only a bound that is entirely positive, entirely negative or
 * exactly `[0, 0]` fixes a sign.
 *
 * @param bounds - The bound of the value, or `null`.
 * @returns The sign, or `null` when the bound does not fix it.
 */
export function boundSign(bounds: readonly [number, number] | null): Sign | null {
  if (bounds === null) return null;
  const [lo, hi] = bounds;
  if (lo > 0) return 1;
  if (hi < 0) return -1;
  if (lo === 0 && hi === 0) return 0;
  return null;
}

/** The variable names of a point: its `x` and its `y`. */
export type PointVars = readonly [string, string];

/** A compiled sign: its name, its document and its evaluators. */
export interface SignForm {
  readonly name: string;
  readonly doc: Expression;
  /**
   * The three points of an orientation sign, or `undefined` for another sign. When two of these points are equal,
   * the value is exactly 0.
   */
  readonly points?: readonly [PointVars, PointVars, PointVars] | undefined;
  /** This function gives the A1 bound of the value, with each variable at a point interval. */
  bounds(point: Point): readonly [number, number] | null;
}

/**
 * This function compiles the document of a sign one time. Each evaluation then gives the A1 bound at one input, the
 * same bound as `summarize(doc, { bounds })` gives with point bounds.
 *
 * @param name - The name of the sign.
 * @param doc - The expression of the sign.
 * @returns The compiled sign.
 */
export function signForm(name: string, doc: Expression, points?: readonly [PointVars, PointVars, PointVars]): SignForm {
  const plan = prepare(expressionMachine, doc, { verb: SUMMARY, fold: false });
  return {
    name,
    doc,
    points,
    bounds(point) {
      const names: Record<string, readonly [number, number]> = {};
      for (const [k, x] of Object.entries(point)) names[k] = [x, x];
      const r = plan.evaluate(makeContext(names));
      if (!r.ok) throw new Error(`The summary of the sign ${name} failed: ${JSON.stringify(r)}`);
      return (r.value as Summary).bounds;
    },
  };
}

/**
 * This function compiles the orientation sign of three points of variables. The sign keeps the points for the
 * structural filter.
 *
 * @param name - The name of the sign.
 * @param p - The variables of the first point.
 * @param q - The variables of the second point.
 * @param r - The variables of the third point.
 * @returns The compiled sign.
 */
export function orientForm(name: string, p: PointVars, q: PointVars, r: PointVars): SignForm {
  const e = (x: PointVars): PointExpr => [v(x[0]), v(x[1])];
  return signForm(name, orient(e(p), e(q), e(r)), [p, q, r]);
}

/**
 * This function is the structural filter of a sign. Two equal points of an orientation give the value 0 exactly, so
 * the filter gives the sign 0 without a bound. The filter compares the floats of the points.
 *
 * @param form - The sign.
 * @param point - The value of each variable.
 * @returns The value is `true` when two points of the orientation are equal.
 */
export function structuralZero(form: SignForm, point: Point): boolean {
  if (form.points === undefined) return false;
  const [p, q, r] = form.points.map((x) => [valueOf(point, x[0]), valueOf(point, x[1])] as const) as [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  const same = (s: readonly [number, number], t: readonly [number, number]): boolean => s[0] === t[0] && s[1] === t[1];
  return same(p, q) || same(q, r) || same(p, r);
}

function valueOf(point: Point, name: string): number {
  const x = point[name];
  if (x === undefined) throw new RangeError(`The input has no value for ${name}.`);
  return x;
}

/**
 * This function gives the exact value of a sign expression at a point. It knows `num`, `var`, `add`, `sub`, `mul`,
 * `neg`, `min` and `max`, because the predicates use only these kinds.
 *
 * @param doc - The expression.
 * @param point - The value of each variable.
 * @returns The exact dyadic value.
 */
export function exactValue(doc: Expression, point: Point): Dyadic {
  switch (doc.type) {
    case "num":
      return D.fromFloat(doc.value);
    case "var":
      return D.fromFloat(valueOf(point, doc.value));
    case "neg":
      return D.neg(exactValue(doc.value, point));
    case "add":
    case "sub":
    case "mul":
    case "min":
    case "max": {
      const [first, ...rest] = doc.value.map((x) => exactValue(x, point)) as [Dyadic, ...Dyadic[]];
      const op = {
        add: D.add,
        sub: D.sub,
        mul: D.mul,
        min: (a: Dyadic, b: Dyadic) => (D.compare(a, b) <= 0 ? a : b),
        max: (a: Dyadic, b: Dyadic) => (D.compare(a, b) >= 0 ? a : b),
      }[doc.type];
      return rest.reduce(op, first);
    }
    default:
      throw new RangeError(`The exact evaluator has no kind ${doc.type}.`);
  }
}

/**
 * This function gives the plain float value of a sign expression at a point, with the operations of JavaScript.
 *
 * @param doc - The expression.
 * @param point - The value of each variable.
 * @returns The float value.
 */
export function floatValue(doc: Expression, point: Point): number {
  switch (doc.type) {
    case "num":
      return doc.value;
    case "var":
      return valueOf(point, doc.value);
    case "neg":
      return -floatValue(doc.value, point);
    case "add":
    case "sub":
    case "mul":
    case "min":
    case "max": {
      const [first, ...rest] = doc.value.map((x) => floatValue(x, point)) as [number, ...number[]];
      const op = {
        add: (a: number, b: number) => a + b,
        sub: (a: number, b: number) => a - b,
        mul: (a: number, b: number) => a * b,
        min: (a: number, b: number) => Math.min(a, b),
        max: (a: number, b: number) => Math.max(a, b),
      }[doc.type];
      return rest.reduce(op, first);
    }
    default:
      throw new RangeError(`The float evaluator has no kind ${doc.type}.`);
  }
}
