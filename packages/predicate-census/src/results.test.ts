import { readdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { wrongClassOf } from "./census.ts";
import type { Classified, WrongClass } from "./census.ts";
import { clippedLengthIsEps } from "./oracle.test-helper.ts";

// The monthly study keeps one census of highways, in a folder named by its day.
const RESULTS = new URL("../results/", import.meta.url);
const HIGHWAYS = readdirSync(RESULTS).filter((name) => /^\d{4}-\d{2}-\d{2}-highways$/.test(name));
const FOLDER = new URL(`${HIGHWAYS.sort().at(-1) ?? "none"}/`, RESULTS);
const SETS = ["exact-v1", "exact-v1-bounds", "fixtures", "fixtures-large", "screen-v1", "screen-v2", "screen-v3"];

interface Kept extends Pick<Classified, "predicate" | "signs"> {
  readonly n: number;
  readonly input: {
    readonly a: [number, number];
    readonly b: [number, number];
    readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
    readonly eps: number;
  };
}

type Counts = Record<WrongClass, { tests: number; records: number }>;

function kept(set: string): Kept[] {
  const text = gunzipSync(readFileSync(new URL(`float-wrong-${set}.jsonl.gz`, FOLDER))).toString("utf8");
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Kept);
}

function reported(set: string): Counts {
  return (JSON.parse(readFileSync(new URL(`report-${set}.json`, FOLDER), "utf8")) as { floatWrongClasses: Counts }).floatWrongClasses;
}

describe("the kept float-wrong records of the census", () => {
  it("are in one folder of highways", () => {
    expect(HIGHWAYS).toHaveLength(1);
  });

  it.each(SETS)("give the classes of the report of %s", (set) => {
    const counts: Counts = {
      "1": { tests: 0, records: 0 },
      "2": { tests: 0, records: 0 },
      "3": { tests: 0, records: 0 },
      "4": { tests: 0, records: 0 },
    };
    for (const record of kept(set)) {
      const entry = counts[wrongClassOf(record, record.input)];
      entry.tests += record.n;
      entry.records += 1;
    }
    expect(counts).toEqual(reported(set));
  });

  it.each(SETS)("have only exact ties at the tolerance in class 4 of %s", (set) => {
    const ties = kept(set).filter((record) => wrongClassOf(record, record.input) === "4");
    expect(ties.length).toBe(reported(set)["4"].records);
    for (const { input } of ties) expect(clippedLengthIsEps(input.a, input.b, input.box, input.eps)).toBe(true);
  });

  it("gives a length that is not a tie the answer false", () => {
    expect(clippedLengthIsEps([5, -1], [5, 0.25], { x: 0, y: 0, w: 10, h: 10 }, 0.5)).toBe(false);
    expect(clippedLengthIsEps([5, -1], [5, 0.5], { x: 0, y: 0, w: 10, h: 10 }, 0.5)).toBe(true);
  });
});
