// @mark1russell7/linear: exact linear algebra and linear programs over the rationals of @mark1russell7/rational.
export type { Matrix, RationalInput, Vector } from "./vector.ts";
export { columnsOf, dot, matrix, multiply, toRational, transpose, vector } from "./vector.ts";
export type { RowEchelon, SolveResult } from "./matrix.ts";
export { nullSpace, rank, rref, solve } from "./matrix.ts";
export type {
  Constraint,
  ConstraintInput,
  LinearProgram,
  LinearProgramInput,
  LinearProgramResult,
  Relation,
  Sense,
} from "./program.ts";
export { linearProgram } from "./program.ts";
export { solveLinearProgram } from "./simplex.ts";
export type { LexicographicResult, LexicographicStage, Objective } from "./lexicographic.ts";
export { solveLexicographic } from "./lexicographic.ts";
export type { CertificateCheck } from "./certificate.ts";
export { checkCertificate } from "./certificate.ts";
export type { Branch, BranchNode, IntegerOptions, IntegerProgram, IntegerProgramResult, NodeOutcome } from "./integer.ts";
export { checkIntegerCertificate, solveIntegerProgram } from "./integer.ts";
