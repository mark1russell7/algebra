/**
 * The zod schemas of the input lines. Each line of a `.jsonl` file is one object. The schemas keep the fields that
 * they do not know, so a later field of the sender does not stop the census.
 *
 * @packageDocumentation
 */
import { z } from "zod";

/** A point of the plane. */
export type Vec = readonly [number, number];
/** An axis box: its low corner and its size. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
/** A rectangle as `[x0, y0, x1, y1]`: two opposite corners. */
export type Rect = readonly [number, number, number, number];
/** The float answer of a line: a truth value, or a sign for a point-side test. */
export type FloatAnswer = boolean | -1 | 0 | 1;
/** The fields of each input line. A line keeps the fields that the census does not know. */
export interface LineBase {
  readonly case: string;
  readonly fn: string;
  /** The weight of the line: the count of the same inputs that the sender merged into it. The default is 1. */
  readonly n: number;
  readonly floatAnswer?: FloatAnswer | undefined;
  readonly [field: string]: unknown;
}
/** A segment pair line. */
export interface SegmentPairLine extends LineBase {
  readonly a: Vec;
  readonly b: Vec;
  readonly c: Vec;
  readonly d: Vec;
  /** The value is `true` when the sender found an end point that is equal in both segments. */
  readonly sharedEnd?: boolean | undefined;
}
/** A segment and box line. */
export interface SegmentBoxLine extends LineBase {
  readonly a: Vec;
  readonly b: Vec;
  readonly box: Box;
  readonly eps?: number | undefined;
}
/** A segment and rectangle line. */
export interface SegmentRectLine extends LineBase {
  readonly a: Vec;
  readonly b: Vec;
  readonly rect: Rect;
  readonly eps?: number | undefined;
}
/** A point-side line: the side of the point `p` against the line `ab`. */
export interface PointSideLine extends LineBase {
  readonly p: Vec;
  readonly a: Vec;
  readonly b: Vec;
}
/** A box pair line. */
export interface BoxPairLine extends LineBase {
  readonly a: Box;
  readonly b: Box;
  readonly eps?: number | undefined;
}
/** A count line. */
export interface CountLine {
  readonly case: string;
  readonly truncated?: boolean | undefined;
  /** The count of all tests of each function, the near tests too. */
  readonly tests?: Readonly<Record<string, number>> | undefined;
  /** The count of the near tests of each function. */
  readonly near?: Readonly<Record<string, number>> | undefined;
  readonly [field: string]: unknown;
}

const finite = z.number().refine(Number.isFinite, "A coordinate must be finite.");
const vec = z.tuple([finite, finite]);
const box = z.looseObject({ x: finite, y: finite, w: finite, h: finite });
const base = {
  case: z.string(),
  fn: z.string(),
  n: z.number().int().positive().default(1),
  floatAnswer: z.boolean().optional(),
};

/** The schema of a segment pair: does the open segment `ab` cross the open segment `cd`. */
export const segmentPairLine: z.ZodType<SegmentPairLine> = z.looseObject({
  ...base,
  a: vec,
  b: vec,
  c: vec,
  d: vec,
  sharedEnd: z.boolean().optional(),
});
/** The schema of a segment and a box: is the part of the segment `ab` in the box longer than `eps`. */
export const segmentBoxLine: z.ZodType<SegmentBoxLine> = z.looseObject({ ...base, a: vec, b: vec, box, eps: finite.optional() });
/** The schema of a segment and a rectangle `[x0, y0, x1, y1]`: the same test as a segment and a box. */
export const segmentRectLine: z.ZodType<SegmentRectLine> = z.looseObject({
  ...base,
  a: vec,
  b: vec,
  rect: z.tuple([finite, finite, finite, finite]),
  eps: finite.optional(),
});
/** The schema of a point-side test: the sign of `orient(a,b,p)`. The float answer is a sign or a truth value. */
export const pointSideLine: z.ZodType<PointSideLine> = z.looseObject({
  ...base,
  p: vec,
  a: vec,
  b: vec,
  floatAnswer: z.union([z.boolean(), z.literal(-1), z.literal(0), z.literal(1)]).optional(),
});
/** The schema of a box pair: is the margin of the two boxes on each axis larger than `eps`. */
export const boxPairLine: z.ZodType<BoxPairLine> = z.looseObject({ ...base, a: box, b: box, eps: finite.optional() });

const count = z.number().int().nonnegative();

/** The kinds of test of a count line: the four predicates, and the nearest-centre test, which has no predicate. */
export type CountKind = "segmentPair" | "segmentBox" | "boxPair" | "pointSide" | "nearest";

/**
 * The fields of a count line, by kind. The total counts each test of the kind, the near tests too. The near field
 * counts the near tests. The sender writes a line for each near test, so the far tests are `total - near`.
 */
export const COUNT_FIELDS: Readonly<Record<CountKind, { readonly total: string; readonly near: string }>> = {
  segmentPair: { total: "totalSegmentPairs", near: "nearSegmentPairs" },
  segmentBox: { total: "totalBoxTests", near: "nearBoxTests" },
  boxPair: { total: "totalPairs", near: "nearPairs" },
  pointSide: { total: "totalPointSideTests", near: "nearPointSideTests" },
  nearest: { total: "totalNearestTests", near: "nearNearestTests" },
};

/** The field of a count line that counts the near segment pairs with an end point that is equal in both segments. */
export const SHARED_END_FIELD = "nearSharedEnd";

const countFields: Record<string, z.ZodOptional<typeof count>> = {};
for (const f of Object.values(COUNT_FIELDS)) {
  countFields[f.total] = count.optional();
  countFields[f.near] = count.optional();
}
countFields[SHARED_END_FIELD] = count.optional();

/**
 * The schema of a count line. It gives the count of the tests of a case. A truncated case has near tests without a
 * line. The census counts these tests as unseen.
 */
export const countLine: z.ZodType<CountLine> = z
  .looseObject({
    case: z.string(),
    ...countFields,
    truncated: z.boolean().optional(),
    tests: z.record(z.string(), count).optional(),
    near: z.record(z.string(), count).optional(),
  })
  .refine(
    (o) => Object.values(COUNT_FIELDS).some((f) => f.total in o) || o.truncated !== undefined,
    "A count line needs a total or the field truncated.",
  );

/** A parsed line, with the form that it has. */
export type Line =
  | { readonly form: "segmentPair"; readonly line: SegmentPairLine }
  | { readonly form: "segmentBox"; readonly line: SegmentBoxLine }
  | { readonly form: "segmentRect"; readonly line: SegmentRectLine }
  | { readonly form: "pointSide"; readonly line: PointSideLine }
  | { readonly form: "boxPair"; readonly line: BoxPairLine }
  | { readonly form: "count"; readonly line: CountLine }
  | { readonly form: "unknown"; readonly line: unknown; readonly error: string };

/**
 * This function finds the form of one parsed line. The shape of the line selects the form, not the field `fn`. A line
 * that has no known form is `unknown`, and the census keeps it in a separate group.
 *
 * @param raw - The value of the JSON line.
 * @returns The line with its form.
 */
export function parseLine(raw: unknown): Line {
  const pair = segmentPairLine.safeParse(raw);
  if (pair.success) return { form: "segmentPair", line: pair.data };
  const segBox = segmentBoxLine.safeParse(raw);
  if (segBox.success) return { form: "segmentBox", line: segBox.data };
  const segRect = segmentRectLine.safeParse(raw);
  if (segRect.success) return { form: "segmentRect", line: segRect.data };
  const side = pointSideLine.safeParse(raw);
  if (side.success) return { form: "pointSide", line: side.data };
  const boxes = boxPairLine.safeParse(raw);
  if (boxes.success) return { form: "boxPair", line: boxes.data };
  const counts = countLine.safeParse(raw);
  if (counts.success) return { form: "count", line: counts.data };
  return { form: "unknown", line: raw, error: "The line has no known form." };
}
