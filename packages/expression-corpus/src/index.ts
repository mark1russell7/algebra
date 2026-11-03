/**
 * The seeded corpus of A12: expression documents with points. The families are well-conditioned and ill-conditioned,
 * small and large, and near-degenerate geometric inputs. The condition number of each polynomial point is exact.
 *
 * @packageDocumentation
 */
export { condition, exactValue, isPolynomial } from "./condition.ts";
export type { ExactValue } from "./condition.ts";
export {
  corpus,
  corpusCase,
  FAMILIES,
  incircleDocument,
  LARGE_NODES,
  nodeCount,
  orientDocument,
  POINTS,
  POLYNOMIAL_FAMILIES,
  SEEDS,
  SMALL_NODES,
} from "./families.ts";
export type { CorpusCase, CorpusOptions, Family } from "./families.ts";
