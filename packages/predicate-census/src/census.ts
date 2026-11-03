/**
 * The census: it classifies each input line and adds the counts of each case and function.
 *
 * @packageDocumentation
 */
import { dyadic as D } from "@mark1russell7/predicates";
import type { Dyadic } from "@mark1russell7/predicates";
import { boundSign, exactValue, floatValue, structuralZero } from "./expressions.ts";
import type { Point, Sign, SignForm } from "./expressions.ts";
import { COUNT_FIELDS, parseLine, SHARED_END_FIELD } from "./input.ts";
import type { CountKind, CountLine, FloatAnswer, Line, PackingCountLine, Vec } from "./input.ts";
import {
  boxPairPoint,
  CALL_SITE_RULES,
  containerPoint,
  containerPredicate,
  edgePair,
  edgePairPoint,
  pointSidePoint,
  PREDICATES,
  segmentBoxPoint,
  segmentPairPoint,
  segmentRect,
  segmentRectPoint,
  strip,
  stripPoint,
} from "./predicates.ts";
import type { Answer, Predicate, PredicateName } from "./predicates.ts";

/** The A1 bound, the bound sign, the exact sign and the float sign of one sign expression of an input. */
export interface SignRecord {
  readonly name: string;
  readonly bounds: readonly [number, number] | null;
  /** The sign that the bound fixes, or `null`. */
  readonly boundSign: Sign | null;
  /** The sign that the structural filter or the bound fixes, or `null`. */
  readonly filterSign: Sign | null;
  readonly exactSign: Sign;
  readonly floatSign: Sign;
  /** The value is `false` when the exact value is outside the bound. Then A1 has a defect. */
  readonly contained: boolean;
}

/** The classification of one input. */
export interface Classified {
  readonly predicate: PredicateName;
  /** The signs that the exact rule or the rule of the bounds asked. */
  readonly signs: readonly SignRecord[];
  /** The value is `true` when the rule of the bounds asks a sign that the bound does not fix. */
  readonly undecided: boolean;
  /** The value is `true` when the rule asks a sign that the structural filter and the bound do not fix. */
  readonly undecidedFiltered: boolean;
  readonly exactAnswer: Answer;
  readonly floatAnswer: Answer;
  /** The value is `input` when the line gave the float answer, and `census` when the census computed it. */
  readonly floatSource: "input" | "census";
  /** The value is `false` when the float answer has a form that the census cannot compare with the exact answer. */
  readonly floatCompared: boolean;
  readonly floatWrong: boolean;
  /** The answer of the bound signs, or `null` when the input is undecided. */
  readonly boundAnswer: Answer | null;
  /** The largest width of a bound of the input. */
  readonly maxWidth: number;
  /** The largest magnitude of a variable of the input. */
  readonly scale: number;
}

const floatSign = (x: number): Sign => (x > 0 ? 1 : x < 0 ? -1 : 0);
const STOP = Symbol("undecided");

/**
 * This function classifies one input of a predicate. It applies the rule with the exact signs, the bound signs and the
 * filtered signs. Without a given float answer, it also applies the rule with the float signs.
 *
 * @param predicate - The predicate, or its name.
 * @param point - The value of each variable of the predicate.
 * @param given - The float answer of the sender, if the line has one.
 * @returns The classification.
 */
export function classify(predicate: PredicateName | Predicate, point: Point, given?: FloatAnswer): Classified {
  const p = typeof predicate === "string" ? PREDICATES[predicate] : predicate;
  const cache = new Map<SignForm, SignRecord>();
  const record = (form: SignForm): SignRecord => {
    let r = cache.get(form);
    if (r === undefined) {
      const bounds = form.bounds(point);
      const exact = exactValue(form.doc, point);
      const contained = bounds !== null && D.compareBound(bounds[0], exact) <= 0 && D.compareBound(bounds[1], exact) >= 0;
      const bs = boundSign(bounds);
      r = {
        name: form.name,
        bounds,
        boundSign: bs,
        filterSign: structuralZero(form, point) ? 0 : bs,
        exactSign: D.sign(exact),
        floatSign: floatSign(floatValue(form.doc, point)),
        contained,
      };
      cache.set(form, r);
    }
    return r;
  };
  const run = (pick: (r: SignRecord) => Sign | null): Answer | null => {
    try {
      return p.answer((form) => {
        const s = pick(record(form));
        if (s === null) throw STOP;
        return s;
      });
    } catch (e) {
      if (e === STOP) return null;
      throw e;
    }
  };
  const exactAnswer = run((r) => r.exactSign) as Answer;
  const boundAnswer = run((r) => r.boundSign);
  const filteredAnswer = run((r) => r.filterSign);
  const floatAnswer = given ?? (run((r) => r.floatSign) as Answer);
  const floatCompared = typeof floatAnswer === typeof exactAnswer;
  const signs = [...cache.values()];
  let maxWidth = 0;
  for (const s of signs) if (s.bounds !== null) maxWidth = Math.max(maxWidth, s.bounds[1] - s.bounds[0]);
  return {
    predicate: p.name,
    signs,
    undecided: boundAnswer === null,
    undecidedFiltered: filteredAnswer === null,
    exactAnswer,
    floatAnswer,
    floatSource: given === undefined ? "census" : "input",
    floatCompared,
    floatWrong: floatCompared && floatAnswer !== exactAnswer,
    boundAnswer,
    maxWidth,
    scale: Math.max(...Object.values(point).map(Math.abs)),
  };
}

/** The factor of the scale of an input that gives the distance of `nearCollinear`. */
export const NEAR_COLLINEAR = 1e-9;

const same = (p: Vec, q: Vec): boolean => p[0] === q[0] && p[1] === q[1];

/**
 * This function finds two equal end points of a segment pair. It compares the floats.
 *
 * @returns The value is `true` when two of the four end points are equal.
 */
export function sharedVertex(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const ps = [a, b, c, d];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (same(ps[i] as Vec, ps[j] as Vec)) return true;
  return false;
}

/**
 * This function finds an end point near the line of the other segment. The test is exact: `orient(q,r,p)^2` must not
 * be larger than `tol^2 * |r - q|^2`, with the float `tol`.
 *
 * @param tol - The largest distance.
 * @returns The value is `true` when an end point is at a distance of `tol` or less from the line of the other segment.
 */
export function nearLine(a: Vec, b: Vec, c: Vec, d: Vec, tol: number): boolean {
  const f = (p: Vec): [Dyadic, Dyadic] => [D.fromFloat(p[0]), D.fromFloat(p[1])];
  const t = D.fromFloat(tol);
  const t2 = D.mul(t, t);
  const near = (q: Vec, r: Vec, p: Vec): boolean => {
    const [qx, qy] = f(q);
    const [rx, ry] = f(r);
    const [px, py] = f(p);
    const ux = D.sub(rx, qx);
    const uy = D.sub(ry, qy);
    const o = D.sub(D.mul(ux, D.sub(py, qy)), D.mul(uy, D.sub(px, qx)));
    const l2 = D.add(D.mul(ux, ux), D.mul(uy, uy));
    if (D.sign(l2) === 0) return false;
    return D.compare(D.mul(o, o), D.mul(t2, l2)) <= 0;
  };
  return near(c, d, a) || near(c, d, b) || near(a, b, c) || near(a, b, d);
}

/** The predicate of each function of packing. The functions `xAt` and `samePlacements` have no rule of the census. */
export const PACKING_PREDICATES: Readonly<Record<string, Group["predicate"]>> = {
  overlap: "boxPair",
  container: "container",
  edgeRange: "strip",
  xAt: "xAt",
  samePlacements: "samePlacements",
};

/** The counts of one case and function. */
export interface Group {
  readonly case: string;
  readonly fn: string;
  /** The predicate. The names `nearest`, `xAt` and `samePlacements` are tests without a rule of the census. */
  readonly predicate: PredicateName | "nearest" | "xAt" | "samePlacements" | "unknown";
  /**
   * The value is `lines` for input lines, `far` for the far tests of a count line, and `unseen` for near tests without
   * a line. The value `touch` is for the touch inputs of a packing case line: inputs with only values of exactly 0 near.
   */
  readonly source: "lines" | "far" | "unseen" | "touch";
  /** The value is `true` for the segment pairs with an end point that is equal in both segments. */
  readonly sharedEnd: boolean;
  total: number;
  decided: number;
  undecided: number;
  /** The inputs that are undecided with the structural filter. */
  undecidedFiltered: number;
  /** The inputs that the census did not see. They are not decided and not undecided. */
  unseen: number;
  /** The touch inputs of packing. They are decided and not float-wrong. */
  touch: number;
  floatWrong: number;
  /** The float-wrong segment pairs with an end point near the line of the other segment. */
  floatWrongNearCollinear: number;
  /** The inputs whose float answer the census cannot compare with the exact answer. */
  floatUncompared: number;
  /** The decided inputs whose bound answer is not the exact answer. A value other than 0 is a defect. */
  boundWrong: number;
  /** The inputs with an exact value outside its bound. A value other than 0 is a defect of A1. */
  boundViolations: number;
  maxWidth: number;
  maxScale: number;
}

/** The counts of the shared-end segment pairs. */
export interface SharedEndCounts {
  total: number;
  undecided: number;
  undecidedFiltered: number;
}

/** The counts of one case. */
export interface CaseSummary {
  readonly case: string;
  total: number;
  decided: number;
  undecided: number;
  undecidedFiltered: number;
  unseen: number;
  /** The touch inputs of packing. They are in `decided`. */
  touch: number;
  floatWrong: number;
  floatWrongNearCollinear: number;
  /** The lines with no known form. They are not decided and not undecided. */
  unknown: number;
  truncated: boolean;
  /** The near tests without a line of a truncated case, by the near field of the count line. */
  readonly unseenNear: Record<string, number>;
  readonly sharedEnd: SharedEndCounts;
}

/** The raw record of an undecided or a wrong input. */
export interface InputRecord extends Classified {
  readonly file: string;
  readonly line: number;
  readonly case: string;
  readonly fn: string;
  readonly n: number;
  readonly sharedEnd: boolean;
  /** For a segment pair: an end point is near the line of the other segment, and the exact answer is a crossing. */
  readonly nearCollinear?: boolean | undefined;
  /** For a segment pair: two of the four end points are equal floats. */
  readonly sharedVertex?: boolean | undefined;
  readonly input: unknown;
}

/** A line with no known form. */
export interface UnknownRecord {
  readonly file: string;
  readonly line: number;
  readonly error: string;
  readonly input: unknown;
}

/** The check of one near field of a count line against the weight of the lines. */
export interface NearCheck {
  readonly case: string;
  /** The near field, or `near.<fn>` for a function of the field `near`. */
  readonly field: string;
  readonly total: number | null;
  readonly near: number;
  /** The touch inputs of a packing function. The check needs `near + touch` not larger than `total`. */
  readonly touch?: number | undefined;
  /** The weight of the lines of the field. */
  readonly seen: number;
  /** The near tests without a line. Only a truncated case has them. */
  readonly unseen: number;
  /** The value is `true` when the lines agree with the count: `seen` is `near`, or not larger for a truncated case. */
  readonly holds: boolean;
}

/** The counts of one predicate or one function over all cases. */
export interface Rollup {
  readonly key: string;
  /** The predicates of the lines of the function. */
  readonly predicates: string[];
  total: number;
  lines: number;
  far: number;
  /** The touch inputs of packing. */
  touch: number;
  unseen: number;
  undecided: number;
  undecidedFiltered: number;
  floatWrong: number;
  floatWrongNearCollinear: number;
  floatUncompared: number;
  unknown: number;
  readonly sharedEnd: SharedEndCounts;
}

/** The result of a census. */
export interface Census {
  readonly groups: readonly Group[];
  readonly cases: readonly CaseSummary[];
  readonly nearCheck: readonly NearCheck[];
  readonly byPredicate: readonly Rollup[];
  readonly byFn: readonly Rollup[];
  /** The weight of the packing lines of each function and each near reason, for example `overlap` and `x:zero`. */
  readonly nearReasons: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly records: readonly InputRecord[];
  readonly unknown: readonly UnknownRecord[];
}

function point(line: Line): { predicate: Predicate; point: Point } | undefined {
  switch (line.form) {
    case "segmentPair":
      return { predicate: CALL_SITE_RULES[line.line.fn]?.predicate ?? PREDICATES.segmentPair, point: segmentPairPoint(line.line.a, line.line.b, line.line.c, line.line.d) };
    case "segmentBox":
      return { predicate: PREDICATES.segmentBox, point: segmentBoxPoint(line.line.a, line.line.b, line.line.box, line.line.eps) };
    case "segmentRect":
      return { predicate: segmentRect, point: segmentRectPoint(line.line.a, line.line.b, line.line.rect, line.line.eps) };
    case "pointSide":
      return { predicate: CALL_SITE_RULES[line.line.fn]?.predicate ?? PREDICATES.pointSide, point: pointSidePoint(line.line.p, line.line.a, line.line.b) };
    case "boxPair":
      return { predicate: PREDICATES.boxPair, point: boxPairPoint(line.line.a, line.line.b, line.line.eps) };
    case "edgePair":
      return { predicate: edgePair, point: edgePairPoint(line.line.a, line.line.b, line.line.tolerance) };
    case "container":
      return { predicate: containerPredicate(line.line.fixedW, line.line.fixedH), point: containerPoint(line.line) };
    case "strip":
      return { predicate: strip, point: stripPoint(line.line) };
    default:
      return undefined;
  }
}

function field(raw: unknown, name: string): string {
  const x = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>)[name] : undefined;
  return typeof x === "string" ? x : "(none)";
}

/** The counts of the count lines of one case. */
interface Counts {
  readonly total: Partial<Record<CountKind, number>>;
  readonly near: Partial<Record<CountKind, number>>;
  sharedEndNear: number | undefined;
  readonly tests: Record<string, number>;
  readonly nearByFn: Record<string, number>;
  truncated: boolean;
}

/** The weight of the lines of one case. */
interface Seen {
  readonly byKind: Partial<Record<CountKind | PredicateName, number>>;
  sharedEnd: number;
  readonly byFn: Record<string, number>;
  /** The count of the near lines of packing, without their weight. */
  packingLines: number;
}

/** The counts of the case lines of packing for one case. */
interface PackingCounts {
  readonly totals: Record<string, number>;
  readonly near: Record<string, number>;
  readonly touch: Record<string, number>;
  lines: number;
}

const newSeen = (): Seen => ({ byKind: {}, sharedEnd: 0, byFn: {}, packingLines: 0 });

const KINDS = Object.keys(COUNT_FIELDS) as CountKind[];
const inc = <K extends string>(o: Partial<Record<K, number>>, k: K, x: number): void => {
  o[k] = (o[k] ?? 0) + x;
};
const order = <T>(m: Map<string, T>): T[] => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, x]) => x);
const shared = (): SharedEndCounts => ({ total: 0, undecided: 0, undecidedFiltered: 0 });

function emptyGroup(caseName: string, fn: string, predicate: Group["predicate"], source: Group["source"], sharedEnd: boolean): Group {
  return {
    case: caseName,
    fn,
    predicate,
    source,
    sharedEnd,
    total: 0,
    decided: 0,
    undecided: 0,
    undecidedFiltered: 0,
    unseen: 0,
    touch: 0,
    floatWrong: 0,
    floatWrongNearCollinear: 0,
    floatUncompared: 0,
    boundWrong: 0,
    boundViolations: 0,
    maxWidth: 0,
    maxScale: 0,
  };
}

const groupKey = (g: Pick<Group, "case" | "fn" | "predicate" | "source" | "sharedEnd">): string =>
  JSON.stringify([g.case, g.fn, g.predicate, g.source, g.sharedEnd]);

/** The options of a tally. */
export interface TallyOptions {
  /**
   * This function gets each record. With a sink, the tally keeps no record in memory, so the result has no records.
   * A sink lets a census of a large dump write its records to a file one at a time.
   */
  readonly onRecord?: (record: InputRecord) => void;
  /** This function gets each unknown line. With it, the tally keeps no unknown line in memory. */
  readonly onUnknown?: (record: UnknownRecord) => void;
}

/** A census that adds one line at a time. */
export class Tally {
  readonly #groups = new Map<string, Group>();
  readonly #counts = new Map<string, Counts>();
  readonly #packing = new Map<string, PackingCounts>();
  readonly #seen = new Map<string, Seen>();
  readonly #reasons = new Map<string, Record<string, number>>();
  readonly #records: InputRecord[] = [];
  readonly #unknown: UnknownRecord[] = [];
  readonly #onRecord: ((record: InputRecord) => void) | undefined;
  readonly #onUnknown: ((record: UnknownRecord) => void) | undefined;

  /**
   * This constructor makes an empty tally.
   *
   * @param options - The sinks of the records and of the unknown lines.
   */
  constructor(options: TallyOptions = {}) {
    this.#onRecord = options.onRecord;
    this.#onUnknown = options.onUnknown;
  }

  #group(caseName: string, fn: string, predicate: Group["predicate"], source: Group["source"], sharedEnd: boolean): Group {
    const key = groupKey({ case: caseName, fn, predicate, source, sharedEnd });
    let g = this.#groups.get(key);
    if (g === undefined) {
      g = emptyGroup(caseName, fn, predicate, source, sharedEnd);
      this.#groups.set(key, g);
    }
    return g;
  }

  #seenOf(caseName: string): Seen {
    let s = this.#seen.get(caseName);
    if (s === undefined) {
      s = newSeen();
      this.#seen.set(caseName, s);
    }
    return s;
  }

  /** This method adds the weight of a near line of packing to its case and to its near reasons. */
  #addPackingLine(caseName: string, fn: string, near: readonly unknown[], n: number): void {
    this.#seenOf(caseName).packingLines += 1;
    let r = this.#reasons.get(fn);
    if (r === undefined) {
      r = {};
      this.#reasons.set(fn, r);
    }
    for (const reason of near) inc(r, String(reason), n);
  }

  /**
   * This method adds one line of text.
   *
   * @param file - The name of the file, for the records.
   * @param lineNo - The line number, from 1.
   * @param text - The text of the line. An empty line adds nothing.
   */
  addText(file: string, lineNo: number, text: string): void {
    if (text.trim() === "") return;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.#addUnknown(file, lineNo, text, "The line is not JSON.");
      return;
    }
    this.add(file, lineNo, raw);
  }

  /**
   * This method adds one parsed line.
   *
   * @param file - The name of the file, for the records.
   * @param lineNo - The line number, from 1.
   * @param raw - The value of the line.
   */
  add(file: string, lineNo: number, raw: unknown): void {
    const line = parseLine(raw);
    if (line.form === "unknown") return this.#addUnknown(file, lineNo, raw, line.error, line.sender);
    if (line.form === "count") return this.#addCount(line.line);
    if (line.form === "packingCount") return this.#addPackingCount(line.line);
    const { predicate, point: p } = point(line) as { predicate: Predicate; point: Point };
    const { n, floatAnswer, fn } = line.line;
    const isShared = line.form === "segmentPair" && line.line.sharedEnd === true;
    const result = classify(predicate, p, floatAnswer);
    const g = this.#group(line.line.case, fn, predicate.name, "lines", isShared);
    if (line.form === "edgePair" || line.form === "container" || line.form === "strip") this.#addPackingLine(line.line.case, fn, line.line.near, n);
    const seen = this.#seenOf(line.line.case);
    inc(seen.byKind, predicate.name, n);
    inc(seen.byFn, fn, n);
    if (isShared) seen.sharedEnd += n;
    g.total += n;
    if (result.undecided) g.undecided += n;
    else {
      g.decided += n;
      if (result.boundAnswer !== result.exactAnswer) g.boundWrong += n;
    }
    if (result.undecidedFiltered) g.undecidedFiltered += n;
    if (!result.floatCompared) g.floatUncompared += n;
    const violated = result.signs.some((s) => !s.contained);
    if (violated) g.boundViolations += n;
    g.maxWidth = Math.max(g.maxWidth, result.maxWidth);
    g.maxScale = Math.max(g.maxScale, result.scale);
    const boundWrong = !result.undecided && result.boundAnswer !== result.exactAnswer;
    let extra: Pick<InputRecord, "nearCollinear" | "sharedVertex"> = {};
    if (line.form === "segmentPair" && (result.undecided || result.floatWrong)) {
      const { a, b, c, d } = line.line;
      extra = {
        nearCollinear: result.exactAnswer === true && nearLine(a, b, c, d, NEAR_COLLINEAR * result.scale),
        sharedVertex: sharedVertex(a, b, c, d),
      };
    }
    if (result.floatWrong) {
      g.floatWrong += n;
      if (extra.nearCollinear === true) g.floatWrongNearCollinear += n;
    }
    if (result.undecided || result.floatWrong || violated || boundWrong) {
      const record: InputRecord = { file, line: lineNo, case: line.line.case, fn, n, sharedEnd: isShared, ...extra, input: raw, ...result };
      if (this.#onRecord === undefined) this.#records.push(record);
      else this.#onRecord(record);
    }
  }

  #addCount(line: CountLine): void {
    let c = this.#counts.get(line.case);
    if (c === undefined) {
      c = { total: {}, near: {}, sharedEndNear: undefined, tests: {}, nearByFn: {}, truncated: false };
      this.#counts.set(line.case, c);
    }
    const o = line as Record<string, unknown>;
    for (const kind of KINDS) {
      const t = o[COUNT_FIELDS[kind].total];
      const x = o[COUNT_FIELDS[kind].near];
      if (typeof t === "number") inc(c.total, kind, t);
      if (typeof x === "number") inc(c.near, kind, x);
    }
    const se = o[SHARED_END_FIELD];
    if (typeof se === "number") c.sharedEndNear = (c.sharedEndNear ?? 0) + se;
    for (const [fn, x] of Object.entries(line.tests ?? {})) inc(c.tests, fn, x);
    for (const [fn, x] of Object.entries(line.near ?? {})) inc(c.nearByFn, fn, x);
    if (line.truncated === true) c.truncated = true;
  }

  #addPackingCount(line: PackingCountLine): void {
    let c = this.#packing.get(line.case);
    if (c === undefined) {
      c = { totals: {}, near: {}, touch: {}, lines: 0 };
      this.#packing.set(line.case, c);
    }
    for (const [fn, x] of Object.entries(line.totals)) inc(c.totals, fn, x);
    for (const [fn, x] of Object.entries(line.near)) inc(c.near, fn, x);
    for (const [fn, x] of Object.entries(line.touch)) inc(c.touch, fn, x);
    c.lines += line.lines;
  }

  #addUnknown(file: string, lineNo: number, raw: unknown, error: string, sender?: "packing"): void {
    const caseName = field(raw, "case");
    const fn = field(raw, "fn");
    const g = this.#group(caseName, fn, "unknown", "lines", false);
    const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const n = sender === "packing" ? o["times"] : o["n"];
    const weight = typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 1;
    g.total += weight;
    if (sender === "packing") {
      // A near line of packing without a rule still counts in the near check of its function.
      inc(this.#seenOf(caseName).byFn, fn, weight);
      this.#addPackingLine(caseName, fn, Array.isArray(o["near"]) ? o["near"] : [], weight);
    }
    const record: UnknownRecord = { file, line: lineNo, error, input: raw };
    if (this.#onUnknown === undefined) this.#unknown.push(record);
    else this.#onUnknown(record);
  }

  /**
   * This method gives the census so far, with the groups and the cases in a fixed order. The far tests of a kind are
   * `total - near`. Without a near field, `near` is the weight of the lines. A truncated case has `near - seen` unseen
   * tests.
   */
  result(): Census {
    const groups = new Map<string, Group>();
    for (const [k, g] of this.#groups) groups.set(k, { ...g });
    const add = (g: Group): void => {
      const k = groupKey(g);
      const old = groups.get(k);
      if (old === undefined) groups.set(k, g);
      else {
        old.total += g.total;
        old.decided += g.decided;
        old.unseen += g.unseen;
        old.touch += g.touch;
      }
    };
    const checks: NearCheck[] = [];
    const check = (caseName: string, f: string, total: number | null, near: number, seen: number, truncated: boolean, touch?: number): number => {
      const unseen = truncated ? Math.max(0, near - seen) : 0;
      const holds = (truncated ? seen <= near : seen === near) && (total === null || near + (touch ?? 0) <= total);
      checks.push({ case: caseName, field: f, total, near, ...(touch === undefined ? {} : { touch }), seen, unseen, holds });
      return unseen;
    };
    // A packing case line gives far = total - near - touch for each function. The touch and the far inputs are decided.
    for (const [caseName, c] of this.#packing) {
      const seen = this.#seen.get(caseName) ?? newSeen();
      for (const fn of new Set([...Object.keys(c.totals), ...Object.keys(c.near), ...Object.keys(c.touch)])) {
        const total = c.totals[fn] ?? 0;
        const near = c.near[fn] ?? 0;
        const touch = c.touch[fn] ?? 0;
        check(caseName, `near.${fn}`, total, near, seen.byFn[fn] ?? 0, false, touch);
        const predicate = PACKING_PREDICATES[fn] ?? "unknown";
        const far = Math.max(0, total - near - touch);
        for (const [source, x] of [
          ["far", far],
          ["touch", touch],
        ] as const) {
          if (x === 0) continue;
          const g = emptyGroup(caseName, fn, predicate, source, false);
          g.total = x;
          // A function that the census does not know is unknown, not decided.
          g.decided = predicate === "unknown" ? 0 : x;
          if (source === "touch") g.touch = x;
          add(g);
        }
      }
      check(caseName, "lines", null, c.lines, seen.packingLines, false);
    }
    const unseenNear = new Map<string, Record<string, number>>();
    const fnFar = new Map<string, Rollup>();
    for (const [caseName, c] of this.#counts) {
      const seen = this.#seen.get(caseName) ?? newSeen();
      const own: Record<string, number> = {};
      unseenNear.set(caseName, own);
      for (const kind of KINDS) {
        const fields = COUNT_FIELDS[kind];
        const total = c.total[kind];
        const sawn = seen.byKind[kind] ?? 0;
        const near = c.near[kind] ?? sawn;
        const predicate: Group["predicate"] = kind;
        if (c.near[kind] !== undefined || total !== undefined) {
          const unseen = check(caseName, fields.near, total ?? null, near, sawn, c.truncated);
          if (unseen > 0) {
            own[fields.near] = unseen;
            let sharedUnseen = 0;
            if (kind === "segmentPair" && c.sharedEndNear !== undefined) sharedUnseen = Math.min(unseen, Math.max(0, c.sharedEndNear - seen.sharedEnd));
            for (const [isShared, x] of [
              [false, unseen - sharedUnseen],
              [true, sharedUnseen],
            ] as const) {
              if (x === 0) continue;
              const g = emptyGroup(caseName, fields.near, predicate, "unseen", isShared);
              g.total = x;
              g.unseen = x;
              add(g);
            }
          }
        }
        if (total !== undefined) {
          const far = Math.max(0, total - near);
          const g = emptyGroup(caseName, "far", predicate, "far", false);
          g.total = far;
          g.decided = far;
          add(g);
        }
      }
      if (c.sharedEndNear !== undefined) check(caseName, SHARED_END_FIELD, c.near.segmentPair ?? null, c.sharedEndNear, seen.sharedEnd, c.truncated);
      for (const fn of new Set([...Object.keys(c.tests), ...Object.keys(c.nearByFn)])) {
        const total = c.tests[fn];
        const sawn = seen.byFn[fn] ?? 0;
        const near = c.nearByFn[fn] ?? sawn;
        const unseen = check(caseName, `near.${fn}`, total ?? null, near, sawn, c.truncated);
        const r = fnFar.get(fn) ?? rollup(fn);
        r.far += Math.max(0, (total ?? near) - near);
        r.unseen += unseen;
        fnFar.set(fn, r);
      }
    }
    const all = order(groups);
    const cases = new Map<string, CaseSummary>();
    const summary = (caseName: string): CaseSummary => ({
      case: caseName,
      total: 0,
      decided: 0,
      undecided: 0,
      undecidedFiltered: 0,
      unseen: 0,
      touch: 0,
      floatWrong: 0,
      floatWrongNearCollinear: 0,
      unknown: 0,
      truncated: this.#counts.get(caseName)?.truncated ?? false,
      unseenNear: unseenNear.get(caseName) ?? {},
      sharedEnd: shared(),
    });
    for (const g of all) {
      let c = cases.get(g.case);
      if (c === undefined) {
        c = summary(g.case);
        cases.set(g.case, c);
      }
      c.total += g.total;
      c.decided += g.decided;
      c.undecided += g.undecided;
      c.undecidedFiltered += g.undecidedFiltered;
      c.unseen += g.unseen;
      c.touch += g.touch;
      c.floatWrong += g.floatWrong;
      c.floatWrongNearCollinear += g.floatWrongNearCollinear;
      if (g.predicate === "unknown") c.unknown += g.total;
      if (g.sharedEnd) addShared(c.sharedEnd, g);
    }
    for (const caseName of [...this.#counts.keys(), ...this.#packing.keys()]) if (!cases.has(caseName)) cases.set(caseName, summary(caseName));
    const byPredicate = new Map<string, Rollup>();
    const byFn = new Map<string, Rollup>(fnFar);
    for (const g of all) {
      const p = byPredicate.get(g.predicate) ?? rollup(g.predicate);
      addRollup(p, g);
      byPredicate.set(g.predicate, p);
      const mapped = this.#counts.get(g.case);
      const hasMaps = mapped !== undefined && (Object.keys(mapped.tests).length > 0 || Object.keys(mapped.nearByFn).length > 0);
      // A case with the maps `tests` and `near` gives the far and unseen tests of each function in `fnFar`.
      if (g.source !== "lines" && hasMaps) continue;
      const f = byFn.get(g.fn) ?? rollup(g.fn);
      addRollup(f, g);
      byFn.set(g.fn, f);
    }
    for (const r of byFn.values()) r.total = r.lines + r.far + r.touch + r.unseen;
    return {
      groups: all,
      cases: order(cases),
      nearCheck: checks.sort((a, b) => (a.case === b.case ? (a.field < b.field ? -1 : 1) : a.case < b.case ? -1 : 1)),
      byPredicate: order(byPredicate),
      byFn: order(byFn),
      nearReasons: sortKeys(Object.fromEntries([...this.#reasons].map(([fn, r]) => [fn, sortKeys(r)]))),
      records: [...this.#records],
      unknown: [...this.#unknown],
    };
  }
}

function sortKeys<T>(r: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function rollup(key: string): Rollup {
  return {
    key,
    predicates: [],
    total: 0,
    lines: 0,
    far: 0,
    touch: 0,
    unseen: 0,
    undecided: 0,
    undecidedFiltered: 0,
    floatWrong: 0,
    floatWrongNearCollinear: 0,
    floatUncompared: 0,
    unknown: 0,
    sharedEnd: shared(),
  };
}

function addShared(s: SharedEndCounts, g: Group): void {
  s.total += g.total;
  s.undecided += g.undecided;
  s.undecidedFiltered += g.undecidedFiltered;
}

function addRollup(r: Rollup, g: Group): void {
  if (!r.predicates.includes(g.predicate)) r.predicates.push(g.predicate);
  r.total += g.total;
  if (g.source === "lines") r.lines += g.total;
  if (g.source === "far") r.far += g.total;
  if (g.source === "touch") r.touch += g.total;
  r.unseen += g.unseen;
  r.undecided += g.undecided;
  r.undecidedFiltered += g.undecidedFiltered;
  r.floatWrong += g.floatWrong;
  r.floatWrongNearCollinear += g.floatWrongNearCollinear;
  r.floatUncompared += g.floatUncompared;
  if (g.predicate === "unknown") r.unknown += g.total;
  if (g.sharedEnd) addShared(r.sharedEnd, g);
}
