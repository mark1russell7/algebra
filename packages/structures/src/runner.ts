/**
 * The generic runner of the laws. It tests each claimed law of a structure and of its parts, on seeded samples. A
 * small finite carrier gets each tuple. The runner has no special case for an instance.
 *
 * @packageDocumentation
 */
import { deriveSeed, random } from "@mark1russell7/rigor-generators";
import type { Random } from "@mark1russell7/rigor-generators";
import { LAWS } from "./laws.ts";
import { inputsOf, partsOf } from "./levels.ts";
import type { AnyStructure, Carrier, LawName } from "./structure.ts";

/** The default count of samples of a law. */
export const DEFAULT_SAMPLES = 500;

/** The default seed of a run. */
export const DEFAULT_SEED = 1;

/** The options of a run. */
export interface RunOptions {
  /** The seed of the run. The same seed gives the same tuples on each platform. The default is `DEFAULT_SEED`. */
  readonly seed?: number;
  /** The count of samples of a law. The default is `DEFAULT_SAMPLES`. */
  readonly samples?: number;
}

/** The result of one claimed law of one structure. The law names of the catalog are the default. */
export interface LawReport<Name extends string = LawName> {
  /** The name of the structure, then the field of each part, separated by `/`. */
  readonly path: string;
  readonly law: Name;
  readonly arity: number;
  /** The seed of the tuples of this law. */
  readonly seed: number;
  /** The count of tuples that the runner examined. */
  readonly cases: number;
  /** `true` when the tuples were each tuple of the carrier. */
  readonly exhaustive: boolean;
  /** The first tuple that fails, as text. It is `null` when each tuple passes. */
  readonly failure: readonly string[] | null;
}

/** This function gives all tuples of `count` values of `elements`, in lexicographic order. */
function* allTuples<T>(elements: readonly T[], count: number): Generator<readonly T[]> {
  if (count === 0) {
    yield [];
    return;
  }
  for (const head of elements) {
    for (const tail of allTuples(elements, count - 1)) yield [head, ...tail];
  }
}

/** This function gives `samples` seeded tuples of `count` values. */
function* sampledTuples<T>(source: Pick<Carrier<T>, "sample">, count: number, samples: number, draw: Random): Generator<readonly T[]> {
  for (let i = 0; i < samples; i += 1) yield Array.from({ length: count }, () => source.sample(draw));
}

/**
 * This function tests one law at one tuple. It answers `false` when the check throws too: a claimed law must hold at
 * each tuple of the carrier.
 *
 * @param structure - A structure at the level of the law, or above it.
 * @param name - The name of the law.
 * @param values - The values. Their count is the arity of the law.
 */
export const holdsAt = (structure: AnyStructure, name: LawName, values: readonly unknown[]): boolean => {
  const check = LAWS[name].check as unknown as (structure: AnyStructure, values: readonly unknown[]) => boolean;
  try {
    return check(structure, values);
  } catch {
    return false;
  }
};

/** The values that a law draws: a seeded sample, a text for a failure, and a list of the members of a small set. */
export type LawSource<T> = Pick<Carrier<T>, "sample" | "show" | "elements">;

/** One law to test on tuples of values. */
export interface LawCheck<T, Name extends string> {
  /** The name of the structure, then the field of each part, separated by `/`. */
  readonly path: string;
  readonly law: Name;
  readonly arity: number;
  readonly source: LawSource<T>;
  /** This function tells if the law holds at one tuple. A throw is a failure. */
  readonly holds: (values: readonly T[]) => boolean;
}

/**
 * This function tests one law on tuples of values. A small finite source gets each tuple, and another source gets
 * seeded samples. The seed of the law comes from the seed of the run, the path and the name of the law.
 *
 * @param check - The law.
 * @param options - The seed and the count of samples.
 * @returns The report of the law.
 */
export const checkLaw = <T, Name extends string>(check: LawCheck<T, Name>, options: RunOptions = {}): LawReport<Name> => {
  const { path, law, arity, source } = check;
  const samples = options.samples ?? DEFAULT_SAMPLES;
  const seed = deriveSeed(options.seed ?? DEFAULT_SEED, `${path}/${law}`);
  const count = source.elements?.length ?? 0;
  const exhaustive = arity === 0 || (source.elements !== undefined && count ** arity <= samples);
  const tuples = exhaustive ? allTuples(source.elements ?? [], arity) : sampledTuples(source, arity, samples, random(seed));
  let cases = 0;
  for (const values of tuples) {
    cases += 1;
    let holds: boolean;
    try {
      holds = check.holds(values);
    } catch {
      holds = false;
    }
    if (!holds) return { path, law, arity, seed, cases, exhaustive, failure: values.map((value) => source.show(value)) };
  }
  return { path, law, arity, seed, cases, exhaustive, failure: null };
};

const checkOne = (structure: AnyStructure, path: string, name: LawName, options: Required<RunOptions>): LawReport =>
  checkLaw({ path, law: name, arity: LAWS[name].arity, source: structure.carrier, holds: (values) => holdsAt(structure, name, values) }, options);

/**
 * This function tests each law that a structure claims, and each law that its parts and its inputs claim. A quotient
 * can pass its own laws on its representatives when its subset is not an ideal. The test of the input finds this.
 *
 * @param structure - The structure.
 * @param options - The seed and the count of samples.
 * @returns One report for each claim of the structure, of its parts and of its inputs.
 */
export const checkClaims = (structure: AnyStructure, options: RunOptions = {}): readonly LawReport[] => {
  const settled = { seed: options.seed ?? DEFAULT_SEED, samples: options.samples ?? DEFAULT_SAMPLES };
  const walk = (current: AnyStructure, path: string): readonly LawReport[] => [
    ...(Object.keys(current.claims) as LawName[]).map((name) => checkOne(current, path, name, settled)),
    ...[...partsOf(current), ...inputsOf(current)].flatMap(([field, part]) => walk(part, `${path}/${field}`)),
  ];
  return walk(structure, structure.name);
};
