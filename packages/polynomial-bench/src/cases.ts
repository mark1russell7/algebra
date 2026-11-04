/**
 * The cases of the bench of A8: the polynomial families of the corpus of A12, and generated families. A generated family
 * has a stated count of variables, degree and terms. A case name is `<family>/s<seed>`. The seed gives the same document on each platform.
 *
 * @packageDocumentation
 */
import { corpusCase, POLYNOMIAL_FAMILIES, SEEDS } from "@algebra/expression-corpus";
import type { Family } from "@algebra/expression-corpus";
import type { Expression } from "@mark1russell7/expression";
import { deriveSeed, random } from "@mark1russell7/rigor-generators";
import type { Random } from "@mark1russell7/rigor-generators";

/** One case of the bench. */
export interface BenchCase {
  /** The name `<family>/s<seed>`. */
  readonly name: string;
  readonly family: string;
  readonly seed: number;
  readonly document: Expression;
  /** The free variables, sorted. */
  readonly variables: readonly string[];
  /** The points: one finite value for each variable, in the order of `variables`. */
  readonly points: readonly (readonly number[])[];
}

/**
 * The shape of a generated family.
 *
 * - `expand`: a product of two polynomials plus a third one. The normal form must expand it.
 * - `quotient`: a quotient with a planted common factor. The normal form must find it by the gcd.
 * - `sum`: a sum of three quotients. The normal form must find a common denominator.
 * - `rational-roots`: a product of linear factors with rational roots.
 * - `mixed-roots`: a product of linear factors, of factors `x^2 - k` and of factors with no real root.
 * - `dense-roots`: a polynomial with a random integer coefficient at each power.
 */
export interface Shape {
  readonly kind: "expand" | "quotient" | "sum" | "rational-roots" | "mixed-roots" | "dense-roots";
  readonly variables: number;
  readonly degree: number;
  readonly terms: number;
}

const shape = (kind: Shape["kind"], variables: number, degree: number, terms: number): readonly [string, Shape] => [
  kind.endsWith("roots") ? `${kind}-d${degree}` : `${kind}-v${variables}-d${degree}-t${terms}`,
  { kind, variables, degree, terms },
];

/** The generated families, by name. */
export const GENERATED: Readonly<Record<string, Shape>> = Object.fromEntries([
  shape("expand", 2, 4, 4),
  shape("expand", 3, 6, 8),
  shape("expand", 4, 8, 16),
  shape("quotient", 1, 4, 3),
  shape("quotient", 2, 3, 4),
  shape("quotient", 3, 3, 6),
  shape("sum", 1, 3, 3),
  shape("sum", 2, 2, 3),
  shape("rational-roots", 1, 8, 0),
  shape("rational-roots", 1, 16, 0),
  shape("mixed-roots", 1, 12, 0),
  shape("mixed-roots", 1, 24, 0),
  shape("dense-roots", 1, 8, 0),
  shape("dense-roots", 1, 16, 0),
  shape("dense-roots", 1, 32, 0),
  shape("dense-roots", 1, 64, 0),
]);

/** The count of points of a generated case, the count of the corpus. */
export const POINTS = 64;

const NAMES = ["x", "y", "z", "w"];

const num = (value: number): Expression => ({ type: "num", value });
const name = (value: string): Expression => ({ type: "var", value });

function join(type: "add" | "mul", parts: readonly Expression[]): Expression {
  const [first, second, ...rest] = parts;
  if (first === undefined) return num(type === "add" ? 0 : 1);
  return second === undefined ? first : { type, value: [first, second, ...rest] };
}

const power = (base: Expression, exp: number): Expression => (exp === 1 ? base : { type: "pow", value: { base, exp } });

/** This function gives a polynomial document with the stated shape. Each coefficient is an integer from 1 to 9 in size. */
function polynomial(rnd: Random, variables: readonly string[], degree: number, terms: number): Expression {
  return join(
    "add",
    Array.from({ length: terms }, () => {
      const exponents = variables.map(() => 0);
      for (let left = rnd.below(degree + 1); left > 0; left--) {
        const at = rnd.below(variables.length);
        exponents[at] = (exponents[at] as number) + 1;
      }
      const powers = variables.flatMap((variable, at) => ((exponents[at] as number) === 0 ? [] : [power(name(variable), exponents[at] as number)]));
      return join("mul", [num(rnd.int(1, 9) * (rnd.chance(0.5) ? -1 : 1)), ...powers]);
    }),
  );
}

const quotient = (a: Expression, b: Expression): Expression => ({ type: "div", value: [a, b] });

/** This function gives a linear factor `d*x - n` with the root `n/d`. */
const linear = (x: Expression, n: number, d: number): Expression => join("add", [join("mul", [num(d), x]), num(-n)]);

function rationalRoots(rnd: Random, degree: number): Expression {
  const x = name("x");
  return join(
    "mul",
    Array.from({ length: degree }, () => linear(x, rnd.int(-40, 40), rnd.pick([1, 2, 3, 5, 7, 8]))),
  );
}

function mixedRoots(rnd: Random, degree: number): Expression {
  const x = name("x");
  const parts: Expression[] = [];
  for (let left = degree; left > 0; ) {
    const choice = rnd.below(3);
    if (choice === 0 || left === 1) {
      parts.push(linear(x, rnd.int(-40, 40), rnd.pick([1, 2, 3, 5])));
      left -= 1;
    } else {
      parts.push(join("add", [power(x, 2), num(choice === 1 ? -rnd.int(2, 40) : rnd.int(1, 40))]));
      left -= 2;
    }
  }
  return join("mul", parts);
}

function denseRoots(rnd: Random, degree: number): Expression {
  const x = name("x");
  return join("add", [
    power(x, degree),
    ...Array.from({ length: degree }, (_, i) => (i === 0 ? num(rnd.int(-1000, 1000) || 1) : join("mul", [num(rnd.int(-1000, 1000) || 1), power(x, i)]))),
  ]);
}

function documentOf(rnd: Random, s: Shape, names: readonly string[]): Expression {
  const part = (): Expression => polynomial(rnd, names, s.degree, s.terms);
  switch (s.kind) {
    case "expand":
      return join("add", [join("mul", [part(), part()]), part()]);
    case "quotient": {
      const common = polynomial(rnd, names, Math.max(2, s.degree - 1), Math.max(2, s.terms - 1));
      return quotient(join("mul", [part(), common]), join("mul", [common, part()]));
    }
    case "sum":
      return join("add", [quotient(part(), part()), quotient(part(), part()), quotient(part(), part())]);
    case "rational-roots":
      return rationalRoots(rnd, s.degree);
    case "mixed-roots":
      return mixedRoots(rnd, s.degree);
    case "dense-roots":
      return denseRoots(rnd, s.degree);
  }
}

/** This function gives a case of a generated family. A point is a float with a small denominator of a power of two. */
function generatedCase(family: string, s: Shape, seed: number): BenchCase {
  const rnd = random(deriveSeed(seed, family));
  const variables = NAMES.slice(0, s.variables);
  const document = documentOf(rnd, s, variables);
  const points = Array.from({ length: POINTS }, () => variables.map(() => rnd.int(-1024, 1024) / 64));
  return { name: `${family}/s${seed}`, family, seed, document, variables, points };
}

/**
 * This function gives the case of a name `<family>/s<seed>`.
 *
 * @param caseName - The name of the case.
 * @returns The case.
 */
export function benchCase(caseName: string): BenchCase {
  const [family, seedText] = caseName.split("/");
  const seed = Number(seedText?.slice(1));
  if (family === undefined || !Number.isSafeInteger(seed)) throw new RangeError(`The case ${caseName} has no family and seed.`);
  const s = GENERATED[family];
  if (s !== undefined) return generatedCase(family, s, seed);
  if (!POLYNOMIAL_FAMILIES.includes(family as Family)) throw new RangeError(`The case ${caseName} has no family of this bench.`);
  return corpusCase(family as Family, seed);
}

/** The names of all the cases: the polynomial families of the corpus, then the generated families. */
export function caseNames(): string[] {
  return [...POLYNOMIAL_FAMILIES, ...Object.keys(GENERATED)].flatMap((family) => SEEDS.map((seed) => `${family}/s${seed}`));
}

/** This function gives the family of a case name. */
export const familyOf = (caseName: string): string => caseName.split("/")[0] as string;

/** This function tells if a family asks for the roots of its document, and not for its normal form. */
export const isRootFamily = (family: string): boolean => family.includes("-roots-");
