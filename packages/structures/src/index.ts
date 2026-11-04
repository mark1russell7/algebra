// @algebra/structures: monoid, group, ring, field, order and lattice as data instances with law tests, and their constructions.
export type {
  AnyStructure,
  Binary,
  BoundedLattice,
  Carrier,
  Claims,
  Commutative,
  CommutativeIdeal,
  CommutativeRing,
  Constant,
  Construction,
  Evidence,
  Field,
  Group,
  Ideal,
  Lattice,
  LawName,
  Level,
  Magma,
  Monoid,
  NormalSubgroup,
  Order,
  Predicate,
  Refutation,
  Relation,
  Ring,
  Semigroup,
  Semilattice,
  Structure,
  Unary,
  UnitalMagma,
} from "./structure.ts";
export { requireExact, withoutZero } from "./structure.ts";
export type { AnyLaw, Arity, Law, LawArguments, LevelShapes } from "./laws.ts";
export { LAW_NAMES, LAWS } from "./laws.ts";
export type { LevelSpecification, PartSpecification } from "./levels.ts";
export { conforms, inputsOf, levelsBelow, LEVELS, operationFields, partsOf, partSpecifications, requiredLaws } from "./levels.ts";
export type { LawReport, RunOptions } from "./runner.ts";
export { checkClaims, DEFAULT_SAMPLES, DEFAULT_SEED, holdsAt } from "./runner.ts";
export {
  RATIONAL_ADD,
  RATIONAL_FIELD,
  RATIONAL_LATTICE,
  RATIONAL_MAX,
  RATIONAL_MIN,
  RATIONAL_MUL,
  RATIONAL_ORDER,
  RATIONAL_UNITS,
  RATIONALS,
} from "./rationals.ts";
export { integersMod, isPrime, MAX_MODULUS, primeField } from "./integers-mod.ts";
export { BOOLEAN_AND, BOOLEAN_LATTICE, BOOLEAN_OR, BOOLEAN_RING, BOOLEAN_XOR, BOOLEANS } from "./booleans.ts";
export { DOUBLE_ADD, DOUBLE_LATTICE, DOUBLE_MAX, DOUBLE_MIN, DOUBLES, ORDERED_DOUBLES } from "./doubles.ts";
export { INTEGER_ADD, INTEGER_MUL, INTEGER_RING, INTEGERS } from "./integers.ts";
export type { Permutation } from "./permutations.ts";
export { alternatingSubgroup, isEven, MAX_POINTS, symmetricGroup } from "./permutations.ts";
export type { Pair } from "./product.ts";
export { product } from "./product.ts";
export type { SubsetDefinition } from "./quotient.ts";
export {
  idealOf,
  INTEGER_COSETS,
  integerIdeal,
  listedIdeal,
  listedNormalSubgroup,
  normalSubgroupOf,
  quotientGroup,
  quotientRing,
  RATIONALS_MOD_INTEGERS,
} from "./quotient.ts";
export type { Polynomial } from "./polynomial-ring.ts";
export {
  coefficientLists,
  degree,
  divideMonic,
  evaluate,
  polynomial,
  polynomialIdeal,
  polynomialRing,
  SAMPLE_DEGREE,
  showPolynomial,
} from "./polynomial-ring.ts";
export type { RootExtension } from "./extension.ts";
export { extendFinite, extendRationals, ROOT_TEST_LIMIT, SEARCH_LIMIT } from "./extension.ts";
export type { LawDescription, OperationDescription, StructureDescription } from "./catalog.ts";
export { CATALOG, describe, describeCatalog, describeLaw, describeLaws } from "./catalog.ts";
