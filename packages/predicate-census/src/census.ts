/**
 * The census: it classifies each input line and adds the counts of each case and function.
 *
 * @packageDocumentation
 */
import * as D from "./dyadic.ts";
import { boundSign, exactValue, floatValue } from "./expressions.ts";
import type { Point, Sign } from "./expressions.ts";
import { FAR_FIELDS, parseLine, unseenNear } from "./input.ts";
import type { CountLine, Line } from "./input.ts";
import { boxPairPoint, PREDICATES, segmentBoxPoint, segmentPairPoint } from "./predicates.ts";
import type { PredicateName } from "./predicates.ts";

/** The A1 bound, the bound sign, the exact sign and the float sign of one sign expression of an input. */
export interface SignRecord {
  readonly name: string;
  readonly bounds: readonly [number, number] | null;
  /** The sign that the bound fixes, or `null`. */
  readonly boundSign: Sign | null;
  readonly exactSign: Sign;
  readonly floatSign: Sign;
  /** The value is `false` when the exact value is outside the bound. Then A1 has a defect. */
  readonly contained: boolean;
}

/** The classification of one input. */
export interface Classified {
  readonly predicate: PredicateName;
  readonly signs: readonly SignRecord[];
  /** The value is `true` when the bound does not fix one sign or more. */
  readonly undecided: boolean;
  readonly exactAnswer: boolean;
  readonly floatAnswer: boolean;
  /** The value is `input` when the line gave the float answer, and `census` when the census computed it. */
  readonly floatSource: "input" | "census";
  readonly floatWrong: boolean;
  /** The answer of the bound signs, or `null` when the input is undecided. */
  readonly boundAnswer: boolean | null;
  /** The largest width of a bound of the input. */
  readonly maxWidth: number;
  /** The largest magnitude of a variable of the input. */
  readonly scale: number;
}

const floatSign = (x: number): Sign => (x > 0 ? 1 : x < 0 ? -1 : 0);

/**
 * This function classifies one input of a predicate.
 *
 * @param predicate - The name of the predicate.
 * @param point - The value of each variable of the predicate.
 * @param given - The float answer of the sender, if the line has one.
 * @returns The classification.
 */
export function classify(predicate: PredicateName, point: Point, given?: boolean): Classified {
  const p = PREDICATES[predicate];
  const signs = p.signs.map((form): SignRecord => {
    const bounds = form.bounds(point);
    const exact = exactValue(form.doc, point);
    const contained = bounds !== null && D.compareBound(bounds[0], exact) <= 0 && D.compareBound(bounds[1], exact) >= 0;
    return {
      name: form.name,
      bounds,
      boundSign: boundSign(bounds),
      exactSign: D.sign(exact),
      floatSign: floatSign(floatValue(form.doc, point)),
      contained,
    };
  });
  const undecided = signs.some((s) => s.boundSign === null);
  const exactAnswer = p.answer(signs.map((s) => s.exactSign));
  const floatAnswer = given ?? p.answer(signs.map((s) => s.floatSign));
  let maxWidth = 0;
  for (const s of signs) if (s.bounds !== null) maxWidth = Math.max(maxWidth, s.bounds[1] - s.bounds[0]);
  return {
    predicate,
    signs,
    undecided,
    exactAnswer,
    floatAnswer,
    floatSource: given === undefined ? "census" : "input",
    floatWrong: floatAnswer !== exactAnswer,
    boundAnswer: undecided ? null : p.answer(signs.map((s) => s.boundSign as Sign)),
    maxWidth,
    scale: Math.max(...Object.values(point).map(Math.abs)),
  };
}

/** The counts of one case and function. */
export interface Group {
  readonly case: string;
  readonly fn: string;
  readonly predicate: PredicateName | "unknown";
  /** The value is `lines` for input lines, `far` for the far count of a count line, and `unseen` for near inputs without a line. */
  readonly source: "lines" | "far" | "unseen";
  total: number;
  decided: number;
  undecided: number;
  /** The inputs that the census did not see. They are not decided and not undecided. */
  unseen: number;
  floatWrong: number;
  /** The decided inputs whose bound answer is not the exact answer. A value other than 0 is a defect. */
  boundWrong: number;
  /** The inputs with an exact value outside its bound. A value other than 0 is a defect of A1. */
  boundViolations: number;
  maxWidth: number;
  maxScale: number;
}

/** The counts of one case. */
export interface CaseSummary {
  readonly case: string;
  total: number;
  decided: number;
  undecided: number;
  unseen: number;
  floatWrong: number;
  /** The lines with no known form. They are not decided and not undecided. */
  unknown: number;
  truncated: boolean;
  /** The near inputs without a line of a truncated case, by the field of the count line. */
  readonly unseenNear: Record<string, number>;
}

/** The raw record of an undecided or a wrong input. */
export interface InputRecord extends Classified {
  readonly file: string;
  readonly line: number;
  readonly case: string;
  readonly fn: string;
  readonly n: number;
  readonly input: unknown;
}

/** A line with no known form. */
export interface UnknownRecord {
  readonly file: string;
  readonly line: number;
  readonly error: string;
  readonly input: unknown;
}

/** The result of a census. */
export interface Census {
  readonly groups: readonly Group[];
  readonly cases: readonly CaseSummary[];
  readonly records: readonly InputRecord[];
  readonly unknown: readonly UnknownRecord[];
}

const NEAR_PREDICATE: Readonly<Record<string, PredicateName>> = {
  nearSegmentPairs: "segmentPair",
  nearBoxTests: "segmentBox",
  nearPairs: "boxPair",
};

function point(line: Line): Point | undefined {
  switch (line.form) {
    case "segmentPair":
      return segmentPairPoint(line.line.a, line.line.b, line.line.c, line.line.d);
    case "segmentBox":
      return segmentBoxPoint(line.line.a, line.line.b, line.line.box);
    case "boxPair":
      return boxPairPoint(line.line.a, line.line.b, line.line.eps);
    default:
      return undefined;
  }
}

function field(raw: unknown, name: string): string {
  const x = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>)[name] : undefined;
  return typeof x === "string" ? x : "(none)";
}

/** A census that adds one line at a time. */
export class Tally {
  readonly #groups = new Map<string, Group>();
  readonly #cases = new Map<string, CaseSummary>();
  readonly #records: InputRecord[] = [];
  readonly #unknown: UnknownRecord[] = [];

  #group(caseName: string, fn: string, predicate: Group["predicate"], source: Group["source"]): Group {
    const key = JSON.stringify([caseName, fn, predicate, source]);
    let g = this.#groups.get(key);
    if (g === undefined) {
      g = { case: caseName, fn, predicate, source, total: 0, decided: 0, undecided: 0, unseen: 0, floatWrong: 0, boundWrong: 0, boundViolations: 0, maxWidth: 0, maxScale: 0 };
      this.#groups.set(key, g);
    }
    return g;
  }

  #case(caseName: string): CaseSummary {
    let c = this.#cases.get(caseName);
    if (c === undefined) {
      c = { case: caseName, total: 0, decided: 0, undecided: 0, unseen: 0, floatWrong: 0, unknown: 0, truncated: false, unseenNear: {} };
      this.#cases.set(caseName, c);
    }
    return c;
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
    if (line.form === "unknown") return this.#addUnknown(file, lineNo, raw, line.error);
    if (line.form === "count") return this.#addCount(line.line);
    const p = point(line) as Point;
    const { n, floatAnswer, fn } = line.line;
    const result = classify(line.form, p, floatAnswer);
    const g = this.#group(line.line.case, fn, line.form, "lines");
    const c = this.#case(line.line.case);
    g.total += n;
    c.total += n;
    if (result.undecided) {
      g.undecided += n;
      c.undecided += n;
    } else {
      g.decided += n;
      c.decided += n;
      if (result.boundAnswer !== result.exactAnswer) g.boundWrong += n;
    }
    if (result.floatWrong) {
      g.floatWrong += n;
      c.floatWrong += n;
    }
    const violated = result.signs.some((s) => !s.contained);
    if (violated) g.boundViolations += n;
    g.maxWidth = Math.max(g.maxWidth, result.maxWidth);
    g.maxScale = Math.max(g.maxScale, result.scale);
    if (result.undecided || result.floatWrong || violated || (!result.undecided && result.boundAnswer !== result.exactAnswer)) {
      this.#records.push({ file, line: lineNo, case: line.line.case, fn, n, input: raw, ...result });
    }
  }

  #addCount(line: CountLine): void {
    const c = this.#case(line.case);
    for (const [k, predicate] of Object.entries(FAR_FIELDS)) {
      const x = (line as Record<string, unknown>)[k];
      if (typeof x !== "number") continue;
      const g = this.#group(line.case, "far", predicate, "far");
      g.total += x;
      g.decided += x;
      c.total += x;
      c.decided += x;
    }
    if (line.truncated === true) c.truncated = true;
    for (const [k, x] of Object.entries(unseenNear(line))) {
      const g = this.#group(line.case, k, NEAR_PREDICATE[k] ?? "unknown", "unseen");
      g.total += x;
      g.unseen += x;
      c.total += x;
      c.unseen += x;
      c.unseenNear[k] = (c.unseenNear[k] ?? 0) + x;
    }
  }

  #addUnknown(file: string, lineNo: number, raw: unknown, error: string): void {
    const caseName = field(raw, "case");
    const g = this.#group(caseName, field(raw, "fn"), "unknown", "lines");
    const n = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>)["n"] : undefined;
    const weight = typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 1;
    const c = this.#case(caseName);
    g.total += weight;
    c.total += weight;
    c.unknown += weight;
    this.#unknown.push({ file, line: lineNo, error, input: raw });
  }

  /** This method gives the census so far, with the groups and the cases in a fixed order. */
  result(): Census {
    const byKey = <T>(m: Map<string, T>): T[] => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, x]) => x);
    return { groups: byKey(this.#groups), cases: byKey(this.#cases), records: [...this.#records], unknown: [...this.#unknown] };
  }
}
