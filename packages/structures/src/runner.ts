/**
 * The generic runner of the laws. It tests each claimed law of a structure and of its parts, on seeded samples. A
 * small finite carrier gets each tuple. The runner has no special case for an instance.
 *
 * @packageDocumentation
 */
import { deriveSeed, random } from "@mark1russell7/rigor-generators";
import type { Random } from "@mark1russell7/rigor-generators";
import { LAWS } from "./laws.ts";
import { partsOf } from "./levels.ts";
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

/** The result of one claimed law of one structure. */
export interface LawReport {
  /** The name of the structure, then the field of each part, separated by `/`. */
  readonly path: string;
  readonly law: LawName;
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
function* sampledTuples<T>(carrier: Carrier<T>, count: number, samples: number, draw: Random): Generator<readonly T[]> {
  for (let i = 0; i < samples; i += 1) yield Array.from({ length: count }, () => carrier.sample(draw));
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

const checkOne = (structure: AnyStructure, path: string, name: LawName, options: Required<RunOptions>): LawReport => {
  const { arity } = LAWS[name];
  const { carrier } = structure;
  const seed = deriveSeed(options.seed, `${path}/${name}`);
  const count = carrier.elements?.length ?? 0;
  const exhaustive = arity === 0 || (carrier.elements !== undefined && count ** arity <= options.samples);
  const tuples = exhaustive ? allTuples(carrier.elements ?? [], arity) : sampledTuples(carrier, arity, options.samples, random(seed));
  let cases = 0;
  for (const values of tuples) {
    cases += 1;
    if (!holdsAt(structure, name, values)) {
      return { path, law: name, arity, seed, cases, exhaustive, failure: values.map((value) => carrier.show(value)) };
    }
  }
  return { path, law: name, arity, seed, cases, exhaustive, failure: null };
};

/**
 * This function tests each law that a structure claims, and each law that its parts claim.
 *
 * @param structure - The structure.
 * @param options - The seed and the count of samples.
 * @returns One report for each claim of the structure and of its parts.
 */
export const checkClaims = (structure: AnyStructure, options: RunOptions = {}): readonly LawReport[] => {
  const settled = { seed: options.seed ?? DEFAULT_SEED, samples: options.samples ?? DEFAULT_SAMPLES };
  const walk = (current: AnyStructure, path: string): readonly LawReport[] => [
    ...(Object.keys(current.claims) as LawName[]).map((name) => checkOne(current, path, name, settled)),
    ...partsOf(current).flatMap(([field, part]) => walk(part, `${path}/${field}`)),
  ];
  return walk(structure, structure.name);
};
