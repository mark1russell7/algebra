/**
 * The sign of a predicate, the stage that decides it, and the constants of the float filters.
 *
 * @packageDocumentation
 */

/** The sign of a value: `-1`, `0` or `1`. */
export type Sign = -1 | 0 | 1;

/**
 * The stage that decides a sign. The stage `filter` is the float filter. Its float value is farther from 0 than its
 * stated bound, or a factor of each term is exactly 0. The stage `exact` is the exact sign over dyadic numbers.
 */
export type Stage = "filter" | "exact";

/** The result of a sign predicate: the exact sign and the stage that decided it. */
export interface SignResult {
  readonly sign: Sign;
  readonly stage: Stage;
}

/** The unit roundoff of a float: `2^-53`. */
export const UNIT_ROUNDOFF: number = 2 ** -53;

/**
 * The term of the filters for underflow: `2^-1069`, which is 32 times the smallest float. A product that underflows
 * has an error of at most `2^-1075`. The term covers the few such errors of one predicate with a margin.
 */
export const UNDERFLOW_TERM: number = 2 ** -1069;

/**
 * The code of a sign and its stage, inside this package. The filter gives `-1`, `0` or `1`. The exact stage gives the
 * sign plus 3: `2`, `3` or `4`. A code is a number, so the hot path makes no object.
 */
export type SignCode = number;

/** The offset of the code of the exact stage. */
export const EXACT: number = 3;

const results = (stage: Stage): readonly SignResult[] =>
  ([-1, 0, 1] as const).map((sign) => Object.freeze({ sign, stage }));
const FILTER_RESULTS = results("filter");
const EXACT_RESULTS = results("exact");

/**
 * This function gives the sign of a code.
 *
 * @param code - The code of a sign and its stage.
 * @returns The sign.
 */
export function codeSign(code: SignCode): Sign {
  return (code > 1 ? code - EXACT : code) as Sign;
}

/**
 * This function gives the result of a code. The results are frozen constants, so the function makes no object.
 *
 * @param code - The code of a sign and its stage.
 * @returns The sign and the stage.
 */
export function codeResult(code: SignCode): SignResult {
  return (code > 1 ? EXACT_RESULTS[code - EXACT + 1] : FILTER_RESULTS[code + 1]) as SignResult;
}

/**
 * This function refuses a value that is not finite. A predicate has no exact sign at such a value.
 *
 * @param values - The inputs of a predicate.
 */
export function requireFinite(values: readonly number[]): void {
  for (const x of values) {
    if (!Number.isFinite(x)) throw new RangeError(`A predicate needs finite inputs, not ${x}.`);
  }
}
