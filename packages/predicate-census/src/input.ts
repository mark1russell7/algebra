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
/** The fields of each input line. A line keeps the fields that the census does not know. */
export interface LineBase {
  readonly case: string;
  readonly fn: string;
  /** The weight of the line: the count of the same inputs that the sender merged into it. The default is 1. */
  readonly n: number;
  readonly floatAnswer?: boolean | undefined;
  readonly [field: string]: unknown;
}
/** A segment pair line. */
export interface SegmentPairLine extends LineBase {
  readonly a: Vec;
  readonly b: Vec;
  readonly c: Vec;
  readonly d: Vec;
}
/** A segment and box line. */
export interface SegmentBoxLine extends LineBase {
  readonly a: Vec;
  readonly b: Vec;
  readonly box: Box;
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
  readonly totalSegmentPairs?: number | undefined;
  readonly totalBoxTests?: number | undefined;
  readonly totalPairs?: number | undefined;
  readonly truncated?: boolean | undefined;
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
export const segmentPairLine: z.ZodType<SegmentPairLine> = z.looseObject({ ...base, a: vec, b: vec, c: vec, d: vec });
/** The schema of a segment and a box: does the segment `ab` pass through the open inside of the box. */
export const segmentBoxLine: z.ZodType<SegmentBoxLine> = z.looseObject({ ...base, a: vec, b: vec, box });
/** The schema of a box pair: is the margin of the two boxes on each axis larger than `eps`. */
export const boxPairLine: z.ZodType<BoxPairLine> = z.looseObject({ ...base, a: box, b: box, eps: finite.optional() });

const count = z.number().int().nonnegative();
/** The fields of a count line that give the count of the far inputs, by predicate. */
export const FAR_FIELDS: Readonly<Record<string, "segmentPair" | "segmentBox" | "boxPair">> = {
  totalSegmentPairs: "segmentPair",
  totalBoxTests: "segmentBox",
  totalPairs: "boxPair",
};

/**
 * The schema of a count line. It gives the count of the far inputs of a case, which have no line. A truncated case
 * also gives the count of its near inputs that have no line, in fields whose names start with `near`.
 */
export const countLine: z.ZodType<CountLine> = z
  .looseObject({
    case: z.string(),
    totalSegmentPairs: count.optional(),
    totalBoxTests: count.optional(),
    totalPairs: count.optional(),
    truncated: z.boolean().optional(),
  })
  .refine(
    (o) => Object.keys(FAR_FIELDS).some((k) => k in o) || o.truncated !== undefined,
    "A count line needs a total or the field truncated.",
  );

/** A parsed line, with the form that it has. */
export type Line =
  | { readonly form: "segmentPair"; readonly line: SegmentPairLine }
  | { readonly form: "segmentBox"; readonly line: SegmentBoxLine }
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
  const boxes = boxPairLine.safeParse(raw);
  if (boxes.success) return { form: "boxPair", line: boxes.data };
  const counts = countLine.safeParse(raw);
  if (counts.success) return { form: "count", line: counts.data };
  return { form: "unknown", line: raw, error: "The line has no known form." };
}

/**
 * This function gives the count of the near inputs without a line of a truncated case. It adds each whole field whose
 * name starts with `near`.
 *
 * @param line - The count line.
 * @returns The count of each such field.
 */
export function unseenNear(line: CountLine): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(line)) {
    if (k.startsWith("near") && typeof x === "number" && Number.isInteger(x) && x >= 0) out[k] = x;
  }
  return out;
}
