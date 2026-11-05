/**
 * The families of the corpus of A12. Each case is one document and a batch of seeded points. The same family and seed
 * give the same case on each platform.
 *
 * @packageDocumentation
 */
import { nodesOf, randomExpression, summarize } from "@mark1russell7/expression";
import type { Expression, Summary } from "@mark1russell7/expression";
import { incircleInput, orientInput, points as geometricPoints } from "@mark1russell7/predicates/corpus";
import { deriveSeed, random } from "@mark1russell7/rigor-generators";
import type { Random } from "@mark1russell7/rigor-generators";

/**
 * The families of the corpus.
 *
 * - `small` and `large`: random documents of the A1 generator, with each kind.
 * - `well`: polynomials in Horner form with positive coefficients, at points in `[0, 2)`. Each condition is 1.
 * - `ill`: the expanded form of `(x - r)^n`, at points near `r`.
 * - `orient-*` and `incircle-*`: the determinants of the two predicates, on the inputs of `@mark1russell7/predicates`.
 */
export type Family = "small" | "large" | "well" | "ill" | "orient-random" | "orient-near" | "incircle-random" | "incircle-near";

/** The families, in the order of the corpus. */
export const FAMILIES: readonly Family[] = ["small", "large", "well", "ill", "orient-random", "orient-near", "incircle-random", "incircle-near"];

/** The families of polynomial documents. Each point of these families has a condition number. */
export const POLYNOMIAL_FAMILIES: readonly Family[] = ["well", "ill", "orient-random", "orient-near", "incircle-random", "incircle-near"];

/** The default seeds of the corpus: 8 cases for each family. */
export const SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** The default count of points of a case. */
export const POINTS = 64;

/** The largest count of nodes of a document of the family `small`. */
export const SMALL_NODES = 30;

/** The smallest and the largest count of nodes of a document of the family `large`. */
export const LARGE_NODES: readonly [number, number] = [200, 2000];

/** One case of the corpus: a document and its points. */
export interface CorpusCase {
  /** The name `<family>/s<seed>`. */
  readonly name: string;
  readonly family: Family;
  readonly seed: number;
  readonly document: Expression;
  /** The free variables of the document, sorted. This order is the default order of `compileFloat`. */
  readonly variables: readonly string[];
  /** The points. Each point has one finite value for each variable, in the order of `variables`. */
  readonly points: readonly (readonly number[])[];
}

/** The options of `corpusCase` and `corpus`. */
export interface CorpusOptions {
  /** The count of points of each case. The default is `POINTS`. */
  readonly points?: number;
}

const num = (value: number): Expression => ({ type: "num", value });
const v = (name: string): Expression => ({ type: "var", value: name });
const sub = (a: Expression, b: Expression): Expression => ({ type: "sub", value: [a, b] });
/** The parts of a node of the kinds `add` and `mul`: two or more. */
type Parts = [Expression, Expression, ...Expression[]];
const mul = (...parts: Parts): Expression => ({ type: "mul", value: parts });
const add = (...parts: Parts): Expression => ({ type: "add", value: parts });

/**
 * This function gives the count of the nodes of a document, from the cost of its summary.
 *
 * @param doc - The document.
 * @returns The count of the nodes, the root included.
 */
export function nodeCount(doc: Expression): number {
  return nodesOf(summaryOf(doc));
}

/** This function gives the summary of a document, or throws the error of coeval. */
function summaryOf(doc: Expression): Summary {
  const s = summarize(doc);
  if (!s.ok) throw new RangeError(`The document has no summary: ${s.error.reason}`);
  return s.value;
}

/** The orientation determinant `(ax - cx) (by - cy) - (ay - cy) (bx - cx)`. Its variables are `ax` to `cy`. */
export function orientDocument(): Expression {
  return sub(mul(sub(v("ax"), v("cx")), sub(v("by"), v("cy"))), mul(sub(v("ay"), v("cy")), sub(v("bx"), v("cx"))));
}

/**
 * The in-circle determinant: the 3 by 3 determinant of the rows `(u, w, u^2 + w^2)`, with `u = px - dx` and
 * `w = py - dy` for each point `p` of `a`, `b` and `c`. Its variables are `ax` to `dy`.
 */
export function incircleDocument(): Expression {
  const u = (p: string): Expression => sub(v(`${p}x`), v("dx"));
  const w = (p: string): Expression => sub(v(`${p}y`), v("dy"));
  const lift = (p: string): Expression => add(mul(u(p), u(p)), mul(w(p), w(p)));
  const row = (p: string): [Expression, Expression, Expression] => [u(p), w(p), lift(p)];
  const [[a1, a2, a3], [b1, b2, b3], [c1, c2, c3]] = [row("a"), row("b"), row("c")];
  const minor = (p: Expression, q: Expression, r: Expression, s: Expression): Expression => sub(mul(p, q), mul(r, s));
  return add(sub(mul(a1, minor(b2, c3, b3, c2)), mul(a2, minor(b1, c3, b3, c1))), mul(a3, minor(b1, c2, b2, c1)));
}

/** The binomial coefficient `n` over `k`, exact for the small `n` of the family `ill`. */
function binomial(n: number, k: number): number {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
}

/** A random document of the A1 generator with a count of nodes that `accept` takes. */
function randomDocument(rnd: Random, maxDepth: number, accept: (nodes: number) => boolean): Expression {
  for (let i = 0; i < 1000; i++) {
    const doc = randomExpression(() => rnd.next(), { maxDepth, variables: ["x", "y", "z"], degenerate: 0 });
    if (accept(nodeCount(doc))) return doc;
  }
  throw new RangeError(`No document of depth ${maxDepth} in 1000 draws of the seed ${rnd.seed} has an accepted count of nodes.`);
}

/** The document and the points of one case of a family. */
function familyOf(family: Family, rnd: Random, seed: number, count: number): { document: Expression; points: number[][] } {
  const draw = (point: () => number[]): number[][] => Array.from({ length: count }, point);
  switch (family) {
    case "small":
    case "large": {
      const document =
        family === "small"
          ? randomDocument(rnd, 3, (n) => n <= SMALL_NODES)
          : randomDocument(rnd, 12, (n) => n >= LARGE_NODES[0] && n <= LARGE_NODES[1]);
      const free = variablesOf(document);
      return { document, points: draw(() => free.map(() => rnd.range(-4, 4))) };
    }
    case "well": {
      // c0 + x (c1 + x (c2 + ... + x cn)), each coefficient in [0.5, 2).
      const degree = rnd.int(4, 16);
      let document = num(rnd.range(0.5, 2));
      for (let k = 0; k < degree; k++) document = add(num(rnd.range(0.5, 2)), mul(v("x"), document));
      return { document, points: draw(() => [rnd.range(0, 2)]) };
    }
    case "ill": {
      // The sum of C(n, k) (-r)^k x^(n - k). Each coefficient is an exact float.
      const n = rnd.int(4, 9);
      const r = rnd.pick([0.5, 0.75, 1, 2, 3]);
      const terms: Expression[] = [];
      for (let k = 0; k < n; k++) terms.push(mul(num(binomial(n, k) * (-r) ** k), { type: "pow", value: { base: v("x"), exp: n - k } }));
      terms.push(num((-r) ** n));
      // The degree is 4 or more, so the sum has 5 terms or more.
      return { document: add(...(terms as Parts)), points: draw(() => [r * (1 + (rnd.chance(0.5) ? 1 : -1) * 2 ** -rnd.int(8, 30))]) };
    }
    case "orient-random":
    case "orient-near":
      return { document: orientDocument(), points: geometricPoints(family === "orient-near" ? "near" : "random", seed, orientInput, count) };
    case "incircle-random":
    case "incircle-near":
      return { document: incircleDocument(), points: geometricPoints(family === "incircle-near" ? "near" : "random", seed, incircleInput, count) };
  }
}

/** The free variables of a document, sorted. */
function variablesOf(doc: Expression): string[] {
  return [...summaryOf(doc).free];
}

/**
 * This function gives one case of the corpus. The random numbers of a case come from the seed and the name of the
 * family, so each case is independent of the other cases.
 *
 * @param family - The family.
 * @param seed - The seed, a whole number.
 * @param options - The count of points.
 * @returns The case.
 */
export function corpusCase(family: Family, seed: number, options: CorpusOptions = {}): CorpusCase {
  const count = options.points ?? POINTS;
  const rnd = random(deriveSeed(seed, family));
  const { document, points } = familyOf(family, rnd, seed, count);
  return { name: `${family}/s${seed}`, family, seed, document, variables: variablesOf(document), points };
}

/**
 * This function gives the corpus: one case for each family and each seed, in the order of the families.
 *
 * @param seeds - The seeds. The default is `SEEDS`.
 * @param options - The count of points of each case.
 * @returns The cases.
 */
export function corpus(seeds: readonly number[] = SEEDS, options: CorpusOptions = {}): CorpusCase[] {
  return FAMILIES.flatMap((family) => seeds.map((seed) => corpusCase(family, seed, options)));
}
