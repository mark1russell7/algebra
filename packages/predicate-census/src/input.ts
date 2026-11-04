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
/** A near tie of the two nearest centres of the point `p`. The field `floatAnswer` is the index that the sender found. */
export interface NearestLine {
  readonly case: string;
  readonly fn: string;
  /** The weight of the line. */
  readonly n: number;
  readonly p: Vec;
  readonly c1: Vec;
  readonly c2: Vec;
  readonly i1: number;
  readonly i2: number;
  readonly floatAnswer: number;
  readonly [field: string]: unknown;
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
const index = z.number().int().nonnegative();
/** The schema of a near tie of two centres. The float answer must be one of the two indices. */
export const nearestLine: z.ZodType<NearestLine> = z
  .looseObject({ case: base.case, fn: base.fn, n: base.n, p: vec, c1: vec, c2: vec, i1: index, i2: index, floatAnswer: index })
  .refine((line) => line.i1 !== line.i2 && (line.floatAnswer === line.i1 || line.floatAnswer === line.i2), "The float answer must be one of two different indices.");
/** The schema of a box pair: is the margin of the two boxes on each axis larger than `eps`. */
export const boxPairLine: z.ZodType<BoxPairLine> = z.looseObject({ ...base, a: box, b: box, eps: finite.optional() });

const count = z.number().int().nonnegative();

/** The kinds of test of a count line. Only a near tie of a nearest-centre test has a line. */
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

/** A box of packing: its left, top, right and bottom edges, as the predicate of packing reads them. */
export interface EdgeBox {
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
}
/** The fields of each near line of packing. The census reads the weight `times` of packing as `n`. */
export interface PackingLineBase extends LineBase {
  /** The near reasons of packing, for example `x:zero` or `y:tolerance`. */
  readonly near: readonly string[];
}
/** A box pair line of packing: the function `overlap` of `checkHard`. */
export interface EdgePairLine extends PackingLineBase {
  readonly a: EdgeBox;
  readonly b: EdgeBox;
  readonly tolerance: number;
  /** The gap of a pair of `pairGaps`. The box `a` of the line already has this gap on each side. */
  readonly gap?: number | undefined;
}
/** A container line of packing: the container test of `checkHard` for one box. */
export interface ContainerLine extends PackingLineBase {
  readonly box: EdgeBox;
  readonly x: number;
  readonly y: number;
  /** The width, or `null` for an infinite width. Only a fixed side needs a finite size. */
  readonly w: number | null;
  /** The height, or `null` for an infinite height. */
  readonly h: number | null;
  readonly inset: number;
  readonly tolerance: number;
  readonly fixedW: boolean;
  readonly fixedH: boolean;
}
/** A strip line of packing: `edgeRange` of the segment from `(ax, ay)` to `(bx, by)` and the open strip from `y0` to `y1`. */
export interface StripLine extends PackingLineBase {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly y0: number;
  readonly y1: number;
}
/** The case line of packing. It comes after the near lines of its case. */
export interface PackingCountLine {
  readonly case: string;
  readonly totalPairs?: number | undefined;
  /** The count of all inputs of each function, the near inputs and the touch inputs too. */
  readonly totals: Readonly<Record<string, number>>;
  /** The count of the near inputs of each function. The weight of the near lines of a function is this count. */
  readonly near: Readonly<Record<string, number>>;
  /** The count of the inputs of each function with only values of exactly 0 near. These inputs have no line. */
  readonly touch: Readonly<Record<string, number>>;
  /** The count of the near lines of the case. */
  readonly lines: number;
  readonly [field: string]: unknown;
}

const edgeBox = z.looseObject({ l: finite, t: finite, r: finite, b: finite });
const packingBase = {
  case: z.string(),
  fn: z.string(),
  times: z.number().int().positive(),
  near: z.array(z.string()),
};
/** This function moves the weight `times` of a packing line to `n`. The schema of the line gives its type `L`. */
function weighed<L>(o: { readonly times: number; readonly [field: string]: unknown }): L {
  const { times, ...rest } = o;
  return { ...rest, n: times } as L;
}

/** The schema of a box pair of packing: is the margin `min(right) - max(left)` of each axis larger than `tolerance`. */
export const edgePairLine: z.ZodType<EdgePairLine> = z
  .looseObject({ ...packingBase, a: edgeBox, b: edgeBox, tolerance: finite, gap: finite.optional(), floatAnswer: z.boolean().optional() })
  .transform((o) => weighed<EdgePairLine>(o));
/** The schema of a container test of packing. A size of `null` is an infinite size of the container. */
export const containerLine: z.ZodType<ContainerLine> = z
  .looseObject({
    ...packingBase,
    box: edgeBox,
    x: finite,
    y: finite,
    w: finite.nullable(),
    h: finite.nullable(),
    inset: finite,
    tolerance: finite,
    fixedW: z.boolean(),
    fixedH: z.boolean(),
    floatAnswer: z.boolean().optional(),
  })
  .transform((o) => weighed<ContainerLine>(o));
/** The schema of a strip test of packing. The float answer of packing is a range or `null`. The census reads `null` as `false`. */
export const stripLine: z.ZodType<StripLine> = z
  .looseObject({
    ...packingBase,
    ax: finite,
    ay: finite,
    bx: finite,
    by: finite,
    y0: finite,
    y1: finite,
    floatAnswer: z.union([z.tuple([z.number(), z.number()]), z.null()]).optional(),
  })
  .transform((o) => weighed<StripLine>({ ...o, floatAnswer: o.floatAnswer === undefined ? undefined : o.floatAnswer !== null }));

/** The schema of the case line of packing. */
export const packingCountLine: z.ZodType<PackingCountLine> = z.looseObject({
  case: z.string(),
  totalPairs: count.optional(),
  totals: z.record(z.string(), count),
  near: z.record(z.string(), count),
  touch: z.record(z.string(), count),
  lines: count,
});

/** The reason of the census for each function of packing without a rule. A near line of such a function is `unknown`. */
export const PACKING_UNMODELED: Readonly<Record<string, string>> = {
  xAt: "The function xAt gives a rounded quotient, not a sign. The census has no exact rule for this value.",
  samePlacements: "The function samePlacements compares the placements after round3. The census has no exact rule for this rounding.",
};

/** A parsed line, with the form that it has. */
export type Line =
  | { readonly form: "segmentPair"; readonly line: SegmentPairLine }
  | { readonly form: "segmentBox"; readonly line: SegmentBoxLine }
  | { readonly form: "segmentRect"; readonly line: SegmentRectLine }
  | { readonly form: "pointSide"; readonly line: PointSideLine }
  | { readonly form: "nearest"; readonly line: NearestLine }
  | { readonly form: "boxPair"; readonly line: BoxPairLine }
  | { readonly form: "count"; readonly line: CountLine }
  | { readonly form: "edgePair"; readonly line: EdgePairLine }
  | { readonly form: "container"; readonly line: ContainerLine }
  | { readonly form: "strip"; readonly line: StripLine }
  | { readonly form: "packingCount"; readonly line: PackingCountLine }
  | {
      readonly form: "unknown";
      readonly line: unknown;
      readonly error: string;
      /** The value is `packing` for a near line of packing. Then the near check counts its weight. */
      readonly sender?: "packing" | undefined;
    };

/** This function tells if a raw line is a near line of packing: it has the weight `times` and a list `near`. */
function isPackingLine(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return "times" in o && Array.isArray(o["near"]);
}

/** This function finds the form of a near line of packing. A line of a function without a rule is `unknown`, with its reason. */
function parsePackingLine(raw: unknown): Line {
  const fn = (raw as Record<string, unknown>)["fn"];
  const unmodeled = typeof fn === "string" ? PACKING_UNMODELED[fn] : undefined;
  if (unmodeled !== undefined) return { form: "unknown", line: raw, error: unmodeled, sender: "packing" };
  const pair = edgePairLine.safeParse(raw);
  if (pair.success) return { form: "edgePair", line: pair.data };
  const strip = stripLine.safeParse(raw);
  if (strip.success) return { form: "strip", line: strip.data };
  const box = containerLine.safeParse(raw);
  if (!box.success) return { form: "unknown", line: raw, error: "The packing line has no known form.", sender: "packing" };
  const { fixedW, fixedH, w, h } = box.data;
  if ((fixedW && w === null) || (fixedH && h === null)) {
    return { form: "unknown", line: raw, error: "A fixed side of the container has an infinite size.", sender: "packing" };
  }
  return { form: "container", line: box.data };
}

/**
 * This function finds the form of one parsed line. The shape of the line selects the form, not the field `fn`. A line
 * that has no known form is `unknown`, and the census keeps it in a separate group. A near line of packing has the
 * fields `times` and `near`. A packing function in `PACKING_UNMODELED` has no rule, so its lines are `unknown`.
 *
 * @param raw - The value of the JSON line.
 * @returns The line with its form.
 */
export function parseLine(raw: unknown): Line {
  if (isPackingLine(raw)) return parsePackingLine(raw);
  const pair = segmentPairLine.safeParse(raw);
  if (pair.success) return { form: "segmentPair", line: pair.data };
  const segBox = segmentBoxLine.safeParse(raw);
  if (segBox.success) return { form: "segmentBox", line: segBox.data };
  const segRect = segmentRectLine.safeParse(raw);
  if (segRect.success) return { form: "segmentRect", line: segRect.data };
  const side = pointSideLine.safeParse(raw);
  if (side.success) return { form: "pointSide", line: side.data };
  const near = nearestLine.safeParse(raw);
  if (near.success) return { form: "nearest", line: near.data };
  const boxes = boxPairLine.safeParse(raw);
  if (boxes.success) return { form: "boxPair", line: boxes.data };
  const packingCounts = packingCountLine.safeParse(raw);
  if (packingCounts.success) return { form: "packingCount", line: packingCounts.data };
  const counts = countLine.safeParse(raw);
  if (counts.success) return { form: "count", line: counts.data };
  return { form: "unknown", line: raw, error: "The line has no known form." };
}
