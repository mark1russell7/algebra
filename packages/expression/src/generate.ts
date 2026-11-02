/**
 * A seeded generator of random expression documents for property tests. The same seed gives the same documents on
 * each platform.
 *
 * @packageDocumentation
 */
import type { Comparison, Expression } from "./schema.ts";

/** A source of random numbers in `[0, 1)`. */
export type Random = () => number;

/**
 * This function makes a seeded source of random numbers (mulberry32).
 *
 * @param seed - The seed. The function uses its low 32 bits.
 * @returns The source.
 */
export function random(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The near-degenerate constants: zero, one, the limits of the float range and values one step from a power of two.
 * The list also has decimals that have no exact float.
 */
export const DEGENERATE_CONSTANTS: readonly number[] = [
  0,
  1,
  -1,
  2,
  0.5,
  Number.MIN_VALUE,
  -Number.MIN_VALUE,
  2 ** -1022,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  1 + Number.EPSILON,
  1 - Number.EPSILON / 2,
  2 ** 53,
  2 ** 53 + 2,
  0.1,
  0.2,
  0.3,
  1e-300,
  1e300,
];

/** The options of the generator. */
export interface GenerateOptions {
  /** The deepest nesting of nodes. The default is 4. */
  readonly maxDepth?: number;
  /** The names of the variables. The default is `x`, `y` and `z`. An empty list gives closed expressions. */
  readonly variables?: readonly string[];
  /** The chance that a literal is a near-degenerate constant. The default is 0.25. */
  readonly degenerate?: number;
  /** The kinds that the generator can use for an inner node. The default is each kind. */
  readonly kinds?: readonly InnerKind[];
  /** The smallest and the largest exponent of `pow`. The default is -3 and 4. */
  readonly exponents?: readonly [number, number];
}

/** The kinds of an inner node of an expression. */
export type InnerKind = "add" | "sub" | "mul" | "div" | "neg" | "pow" | "root" | "min" | "max";

const INNER: readonly InnerKind[] = ["add", "sub", "mul", "div", "neg", "pow", "root", "min", "max"];

function pick<T>(rnd: Random, items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)] as T;
}

function int(rnd: Random, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

function literal(rnd: Random, degenerate: number): number {
  if (rnd() < degenerate) return pick(rnd, DEGENERATE_CONSTANTS);
  const v = rnd() < 0.5 ? int(rnd, -9, 9) : (rnd() - 0.5) * 2 ** int(rnd, -8, 8);
  return v === 0 ? 0 : v; // No -0: the schema refuses it.
}

/**
 * This function makes one random expression.
 *
 * @param rnd - The source of random numbers, from `random`.
 * @param options - The depth, the variables, the constants and the kinds.
 * @returns An expression that passes `expressionSchema`.
 */
export function randomExpression(rnd: Random, options: GenerateOptions = {}): Expression {
  const maxDepth = options.maxDepth ?? 4;
  const variables = options.variables ?? ["x", "y", "z"];
  const degenerate = options.degenerate ?? 0.25;
  const kinds = options.kinds ?? INNER;
  const [eLo, eHi] = options.exponents ?? [-3, 4];
  const make = (depth: number): Expression => {
    if (depth >= maxDepth || kinds.length === 0 || rnd() < 0.3) {
      if (variables.length > 0 && rnd() < 0.4) return { type: "var", value: pick(rnd, variables) };
      return { type: "num", value: literal(rnd, degenerate) };
    }
    const kind = pick(rnd, kinds);
    const next = (): Expression => make(depth + 1);
    switch (kind) {
      case "add":
      case "mul":
      case "min":
      case "max": {
        const rest = Array.from({ length: int(rnd, 0, 2) }, next);
        return { type: kind, value: [next(), next(), ...rest] };
      }
      case "sub":
      case "div":
        return { type: kind, value: [next(), next()] };
      case "neg":
        return { type: "neg", value: next() };
      case "pow":
        return { type: "pow", value: { base: next(), exp: int(rnd, eLo, eHi) } };
      case "root":
        return { type: "root", value: { radicand: next(), index: int(rnd, 2, 5) } };
    }
  };
  return make(0);
}

/**
 * This function makes one random comparison of two random expressions.
 *
 * @param rnd - The source of random numbers, from `random`.
 * @param options - The options of each side.
 * @returns A comparison that passes `comparisonSchema`.
 */
export function randomComparison(rnd: Random, options: GenerateOptions = {}): Comparison {
  const type = pick(rnd, ["lt", "le", "eq"] as const);
  return { type, value: [randomExpression(rnd, options), randomExpression(rnd, options)] };
}
