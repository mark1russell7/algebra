/**
 * The cases of the bench of A5. Each case is one batch of 1000 seeded inputs of one predicate and one family of the
 * corpus of `@mark1russell7/predicates`. A use of a case gives the sum of the signs of its batch.
 *
 * @packageDocumentation
 */
import { incircleInput, orientInput, points } from "@mark1russell7/predicates/corpus";
import type { Family } from "@mark1russell7/predicates/corpus";

/** The sign functions of one arm. Each function gives `-1`, `0` or `1` in the convention of `@mark1russell7/predicates`. */
export interface Signs {
  readonly orient: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => number;
  readonly incircle: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) => number;
}

/** The groups of the cases. Each group gets its own time verdict. */
export type Group = "random" | "near" | "ties";
export const GROUPS: readonly Group[] = ["random", "near", "ties"];

/** The seeds of each predicate and group. 8 seeds and 2 predicates give 16 cases in each group. */
export const SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** The count of inputs of one batch. */
export const BATCH = 1000;

/** One case of the bench. */
export interface Case {
  /** The name `<predicate>/<group>/s<seed>`. */
  readonly name: string;
  readonly group: Group;
  /** This function gives the sum of the signs of the batch. */
  readonly run: () => number;
}

/** This function gives the group of a case name. */
export function groupOf(name: string): Group {
  return name.split("/")[1] as Group;
}

/**
 * This function gives the cases of one arm. Each arm uses it in its own instance of this module.
 * Thus the loops of the two arms do not share the type feedback of the engine.
 *
 * @param S - The sign functions of the arm.
 * @returns The cases, in the order of the groups, the predicates and the seeds.
 */
export function casesFor(S: Signs): Case[] {
  const out: Case[] = [];
  for (const group of GROUPS) {
    for (const seed of SEEDS) {
      const o = Float64Array.from(points(group as Family, 100 + seed, orientInput, BATCH).flat());
      out.push({
        name: `orient2d/${group}/s${seed}`,
        group,
        run: () => {
          let sum = 0;
          for (let i = 0; i < o.length; i += 6) sum += S.orient(o[i]!, o[i + 1]!, o[i + 2]!, o[i + 3]!, o[i + 4]!, o[i + 5]!);
          return sum;
        },
      });
    }
    for (const seed of SEEDS) {
      const c = Float64Array.from(points(group as Family, 200 + seed, incircleInput, BATCH).flat());
      out.push({
        name: `incircle/${group}/s${seed}`,
        group,
        run: () => {
          let sum = 0;
          for (let i = 0; i < c.length; i += 8) sum += S.incircle(c[i]!, c[i + 1]!, c[i + 2]!, c[i + 3]!, c[i + 4]!, c[i + 5]!, c[i + 6]!, c[i + 7]!);
          return sum;
        },
      });
    }
  }
  return out;
}
