/**
 * The presets of the explorer: the classroom input, two in-circle inputs, and the real float-wrong records of the A13
 * census.
 *
 * @packageDocumentation
 */
import { PREDICATES, pointSidePoint, segmentBoxPoint, segmentPairPoint } from "./census.ts";
import type { Box, Point, PointVars, Vec } from "./census.ts";
import type { FormSpec, View } from "./grid.ts";

/** One sign of a record whose float sign is not the exact sign. */
export interface Flip {
  readonly name: string;
  readonly exactSign: -1 | 0 | 1;
  readonly floatSign: -1 | 0 | 1;
  readonly bounds: readonly [number, number];
}

/** One float-wrong record of the census, as `data/near-misses.json` keeps it. */
export interface NearMiss {
  readonly set: string;
  readonly case: string;
  readonly fn: string;
  readonly via: string;
  readonly weight: number;
  readonly predicate: "segmentPair" | "segmentBox" | "pointSide";
  readonly input: Readonly<Record<string, unknown>>;
  readonly floatAnswer: boolean | -1 | 0 | 1;
  readonly exactAnswer: boolean | -1 | 0 | 1;
  readonly flips: readonly Flip[];
  readonly source: { readonly census: string; readonly dump: string; readonly line: number };
}

/** The file of the records: its note of provenance and the records. */
export interface NearMissFile {
  readonly note: string;
  readonly records: readonly NearMiss[];
}

/** A named point of a scene. */
export interface ScenePoint {
  readonly name: string;
  readonly at: Vec;
}

/** The geometry of an input at its own scale: its segments, its boxes, its points and its circles. */
export interface Scene {
  readonly segments: readonly (readonly [Vec, Vec])[];
  readonly boxes: readonly Box[];
  readonly points: readonly ScenePoint[];
  /** The circles through three points, for an in-circle sign. */
  readonly circles?: readonly (readonly [Vec, Vec, Vec])[];
}

/** A point that the reader can move: its label and its two variables. */
export interface Movable {
  readonly label: string;
  readonly vars: PointVars;
}

/** A sign that the reader can show. */
export interface SignChoice {
  readonly label: string;
  readonly form: FormSpec;
  /** The point that the grid moves first for this sign. */
  readonly move: PointVars;
  /** The points that the reader can move for this sign. */
  readonly movable: readonly Movable[];
}

/** A preset of the explorer. */
export interface Preset {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly vars: Point;
  readonly signs: readonly SignChoice[];
  readonly view: View;
  readonly scene: Scene;
  readonly record?: NearMiss;
  /** The source of an input that is not a record, for the note of the page. */
  readonly cite?: string;
}

const xy = (name: string): PointVars => [`${name}x`, `${name}y`];

function orientChoice(p: string, q: string, r: string, move: string): SignChoice {
  return {
    label: `orient(${p},${q},${r})`,
    form: { kind: "orient", name: `orient(${p},${q},${r})`, points: [xy(p), xy(q), xy(r)] },
    move: xy(move),
    movable: [p, q, r].map((name) => ({ label: name, vars: xy(name) })),
  };
}

function classroom(id: string, title: string, summary: string, p: Vec, q: Vec, r: Vec): Preset {
  return {
    id,
    title,
    summary,
    vars: { px: p[0], py: p[1], qx: q[0], qy: q[1], rx: r[0], ry: r[1] },
    signs: [orientChoice("p", "q", "r", "p")],
    // The grid of the paper starts at p and goes up and to the right, so its center is 128 ulps from p.
    view: { ox: 128, oy: 128, step: 1, n: 256 },
    scene: {
      segments: [[q, r]],
      boxes: [],
      points: [
        { name: "p", at: p },
        { name: "q", at: q },
        { name: "r", at: r },
      ],
    },
    cite: "This picture is in Kettner, Mehlhorn, Pion, Schirra and Yap, <em>Classroom examples of robustness problems in geometric computations</em> (2008).",
  };
}

function incircleChoice(): SignChoice {
  const names = ["a", "b", "c", "d"] as const;
  return {
    label: "incircle(a,b,c,d)",
    form: { kind: "incircle", name: "incircle(a,b,c,d)", points: [xy("a"), xy("b"), xy("c"), xy("d")] },
    move: xy("d"),
    movable: names.map((name) => ({ label: name, vars: xy(name) })),
  };
}

function circlePreset(id: string, title: string, summary: string, a: Vec, b: Vec, c: Vec, d: Vec): Preset {
  return {
    id,
    title,
    summary,
    vars: { ax: a[0], ay: a[1], bx: b[0], by: b[1], cx: c[0], cy: c[1], dx: d[0], dy: d[1] },
    signs: [incircleChoice()],
    view: { ox: 0, oy: 0, step: 1, n: 256 },
    scene: {
      segments: [],
      boxes: [],
      points: [
        { name: "a", at: a },
        { name: "b", at: b },
        { name: "c", at: c },
        { name: "d", at: d },
      ],
      circles: [[a, b, c]],
    },
    cite: "The A5 in-circle test decides the sign of each cell: its float filter first, then the exact stage.",
  };
}

/**
 * The in-circle inputs. The point d moves by ulps. The first input has four points with integer coordinates on one
 * circle. In the second input, d is the float nearest to a point of the unit circle.
 */
export const INCIRCLE: readonly Preset[] = [
  circlePreset(
    "incircle-integers",
    "Four integer points on one circle",
    "The points a = (15, 10), b = (13, 14), c = (6, 13) and d = (14, 7) are on the circle of radius 5 about (10, 10).",
    [15, 10],
    [13, 14],
    [6, 13],
    [14, 7],
  ),
  circlePreset(
    "incircle-unit",
    "A rounded point of the unit circle",
    "The points a = (1, 0), b = (0, 1) and c = (−1, 0) are on the unit circle. The point d is the float pair nearest to (√½, √½).",
    [1, 0],
    [0, 1],
    [-1, 0],
    [Math.SQRT1_2, Math.SQRT1_2],
  ),
];

/** The classroom input (a) of Kettner, Mehlhorn, Pion, Schirra and Yap (2008). The point p moves by ulps. */
export const CLASSROOM: readonly Preset[] = [
  classroom(
    "classroom-a",
    "Three points on the line y = x",
    "The classroom input (a): p = (0.5, 0.5), q = (12, 12), r = (24, 24). The exact line goes through the grid on the diagonal.",
    [0.5, 0.5],
    [12, 12],
    [24, 24],
  ),
];

function isVec(v: unknown): v is Vec {
  return Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

function vec(input: Readonly<Record<string, unknown>>, name: string): Vec {
  const v = input[name];
  if (!isVec(v)) throw new TypeError(`The input has no point ${name}.`);
  return v;
}

function box(input: Readonly<Record<string, unknown>>): Box {
  const b = input["box"] as Partial<Box> | undefined;
  const ok = b !== undefined && (["x", "y", "w", "h"] as const).every((k) => typeof b[k] === "number" && Number.isFinite(b[k]));
  if (!ok) throw new TypeError("The input has no box with x, y, w and h.");
  return b as Box;
}

/**
 * This function reads the file of the records and checks the fields that the explorer uses.
 *
 * @param json - The parsed JSON of `data/near-misses.json`.
 * @returns The file.
 * @throws {TypeError} A record has no field that the explorer needs.
 */
export function parseNearMisses(json: unknown): NearMissFile {
  const file = json as Partial<NearMissFile> | null;
  if (file === null || typeof file !== "object" || typeof file.note !== "string" || !Array.isArray(file.records)) {
    throw new TypeError("The file of the records needs a note and a list of records.");
  }
  (file.records as NearMiss[]).forEach((r, k) => {
    if (!(r.predicate in PREDICATES)) throw new TypeError(`Record ${k} has the unknown predicate ${String(r.predicate)}.`);
    if (!Array.isArray(r.flips) || r.flips.length === 0) throw new TypeError(`Record ${k} has no sign that flips.`);
    for (const flip of r.flips) {
      if (!PREDICATES[r.predicate].signs.some((s) => s.name === flip.name)) {
        throw new TypeError(`Record ${k} has the sign ${flip.name}, but ${r.predicate} has no such sign.`);
      }
    }
    presetOfRecord(r, k);
  });
  return file as NearMissFile;
}

/** This function gives the names of the three points of an orientation name, for example `c`, `d` and `a` of `orient(c,d,a)`. */
export function orientNames(name: string): [string, string, string] | null {
  const m = /^orient\((\w),(\w),(\w)\)$/.exec(name);
  return m === null ? null : [m[1] as string, m[2] as string, m[3] as string];
}

/**
 * This function makes the preset of one record. The grid shows each sign that flips. For an orientation, the grid
 * moves its third point first. For a sign of the segment-box test, the grid moves the start `a` of the segment.
 *
 * @param record - The record.
 * @param index - The index of the record in the file.
 * @returns The preset.
 */
export function presetOfRecord(record: NearMiss, index: number): Preset {
  const input = record.input;
  let vars: Point;
  let scene: Scene;
  if (record.predicate === "segmentPair") {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((n) => vec(input, n)) as [Vec, Vec, Vec, Vec];
    vars = segmentPairPoint(a, b, c, d);
    scene = { segments: [[a, b], [c, d]], boxes: [], points: [{ name: "a", at: a }, { name: "b", at: b }, { name: "c", at: c }, { name: "d", at: d }] };
  } else if (record.predicate === "segmentBox") {
    const [a, b] = [vec(input, "a"), vec(input, "b")];
    const bx = box(input);
    const eps = typeof input["eps"] === "number" ? input["eps"] : 0;
    vars = segmentBoxPoint(a, b, bx, eps);
    scene = { segments: [[a, b]], boxes: [bx], points: [{ name: "a", at: a }, { name: "b", at: b }] };
  } else {
    const [p, a, b] = [vec(input, "p"), vec(input, "a"), vec(input, "b")];
    vars = pointSidePoint(p, a, b);
    scene = { segments: [[a, b]], boxes: [], points: [{ name: "p", at: p }, { name: "a", at: a }, { name: "b", at: b }] };
  }
  const signs: SignChoice[] = record.flips.map((flip) => {
    const names = orientNames(flip.name);
    const form: FormSpec = { kind: "sign", predicate: record.predicate, name: flip.name };
    if (names !== null) {
      const choice = orientChoice(...names, names[2]);
      return { ...choice, form };
    }
    return { label: flip.name, form, move: xy("a"), movable: [{ label: "a", vars: xy("a") }, { label: "b", vars: xy("b") }] };
  });
  return {
    id: `record-${index}`,
    title: `${record.case}, ${record.fn}`,
    summary: `${record.fn} at ${record.via}`,
    vars,
    signs,
    view: { ox: 0, oy: 0, step: 1, n: 256 },
    scene,
    record,
  };
}
