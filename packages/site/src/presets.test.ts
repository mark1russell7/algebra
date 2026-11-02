import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { orientNames, parseNearMisses, presetOfRecord } from "./presets.ts";

const json: unknown = JSON.parse(readFileSync(new URL("../data/near-misses.json", import.meta.url), "utf8"));

describe("the preset loader", () => {
  it("reads the 42 records of the census", () => {
    const file = parseNearMisses(json);
    expect(file.records).toHaveLength(42);
    expect(file.note.length).toBeGreaterThan(0);
  });

  it("makes a preset of each record", () => {
    const file = parseNearMisses(json);
    file.records.forEach((record, k) => {
      const preset = presetOfRecord(record, k);
      expect(preset.id).toBe(`record-${k}`);
      expect(preset.signs).toHaveLength(record.flips.length);
      expect(preset.view).toEqual({ ox: 0, oy: 0, step: 1, n: 256 });
    });
  });

  it("moves the third point of an orientation", () => {
    expect(orientNames("orient(c,d,a)")).toEqual(["c", "d", "a"]);
    expect(orientNames("diff(x1,y1)")).toBeNull();
    const file = parseNearMisses(json);
    const k = file.records.findIndex((r) => r.flips[0]?.name === "orient(c,d,a)");
    const record = file.records[k];
    if (!record) throw new Error("No record has the sign orient(c,d,a).");
    expect(presetOfRecord(record, k).signs[0]?.move).toEqual(["ax", "ay"]);
  });

  it("refuses a bad file", () => {
    expect(() => parseNearMisses(null)).toThrow(TypeError);
    expect(() => parseNearMisses({ note: "x", records: [{ predicate: "nothing", flips: [{ name: "a" }] }] })).toThrow(/unknown predicate/);
    expect(() => parseNearMisses({ note: "x", records: [{ predicate: "segmentPair", flips: [{ name: "orient(z,z,z)" }] }] })).toThrow(/no such sign/);
  });
});
