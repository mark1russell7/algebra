/**
 * The cost and error model of A6. A question asks for a value within a tolerance, or for a sign. The stitched
 * evaluator tries float, ball, interval and exact in order, and stops at the first stage that answers. Each answer
 * names its stage and states its error. The selector gives the plan of the least expected cost from a cost model.
 *
 * The stage `bigfloat` raises the precision up to a stated limit. It is not in the default plan.
 *
 * @packageDocumentation
 */
export { ballClaim, bigfloatClaim, exactClaim, floatClaim, intervalClaim, NO_VALUE, NOTHING, STAGES } from "./claim.ts";
export type { BigClaim, Claim, DefaultStage, Stage } from "./claim.ts";
export { bigWithin, checkTolerance, meets, signOf, within } from "./question.ts";
export type { Question, Tolerance } from "./question.ts";
export { precisions, raise, START_PRECISION } from "./raise.ts";
export type { PrecisionLimit } from "./raise.ts";
export { planCost, select, sharesOf } from "./select.ts";
export type { CostModel, Selection, ShareRow, StageCost } from "./select.ts";
export { stitch } from "./stitch.ts";
export type { Answer, StitchOptions, Stitched } from "./stitch.ts";
