import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { a5Of, buildForm, cellOffset, cellPoint, cellSigns, decode, encode, exactLine, fillRows, floatSign, tally, ulp } from "./grid.ts";
import type { CellSigns, GridJob } from "./grid.ts";
import { CLASSROOM, INCIRCLE, parseNearMisses, presetOfRecord } from "./presets.ts";
import type { Preset, SignChoice } from "./presets.ts";

const classroom = CLASSROOM[0] as Preset;
const sign = classroom.signs[0] as SignChoice;

function job(n: number, step = 1): GridJob {
  return { vars: classroom.vars, form: sign.form, move: sign.move, view: { ox: n / 2, oy: n / 2, step, n } };
}

describe("ulp", () => {
  it("gives the gap to the next float", () => {
    expect(ulp(1)).toBe(2 ** -52);
    expect(ulp(0.5)).toBe(2 ** -53);
    expect(ulp(-12)).toBe(2 ** -49);
  });
});

describe("the grid of ulp steps", () => {
  it("puts the offset of the view at the center cell", () => {
    const view = { ox: 3, oy: -5, step: 4, n: 8 };
    expect(cellOffset(view, 4, 3)).toEqual([3, -5]);
    expect(cellOffset(view, 5, 3)).toEqual([7, -5]);
    expect(cellOffset(view, 4, 2)).toEqual([3, -1]);
  });

  it("moves only the chosen point, by whole ulps", () => {
    const j = job(8);
    const point = cellPoint(j, 0, 7);
    const [kx, ky] = cellOffset(j.view, 0, 7);
    expect(point["px"]).toBe(0.5 + kx * ulp(0.5));
    expect(point["py"]).toBe(0.5 + ky * ulp(0.5));
    expect(point["qx"]).toBe(12);
    expect(point["ry"]).toBe(24);
  });
});

describe("the sign compare", () => {
  it("packs and unpacks each set of signs", () => {
    const signs = [-1, 0, 1] as const;
    for (const float of signs) {
      for (const exact of signs) {
        for (const bound of [...signs, null]) {
          for (const stage of ["filter", "exact", null] as const) {
            for (const a5Wrong of [false, true]) {
              const cell: CellSigns = { float, exact, bound, stage, a5Wrong };
              const code = encode(cell);
              expect(code).toBeLessThan(256);
              expect(decode(code)).toEqual(cell);
            }
          }
        }
      }
    }
  });

  it("gives the float sign of a value", () => {
    expect([floatSign(-2), floatSign(0), floatSign(3)]).toEqual([-1, 0, 1]);
  });

  it("finds wrong float signs, and the interval fixes none of them", () => {
    const j = job(64);
    const form = buildForm(j.form);
    const codes = new Uint8Array(64 * 64);
    fillRows(j, form, 0, 64, codes);
    const counts = tally(codes);
    expect(counts.cells).toBe(64 * 64);
    expect(counts.floatWrong).toBeGreaterThan(0);
    expect(counts.wrongButDecided).toBe(0);
    expect(counts.undecided).toBeGreaterThanOrEqual(counts.floatWrong);
  });

  it("gives the sign 0 at the input point of the classroom, where each value is exact", () => {
    const signs = cellSigns(buildForm(sign.form), classroom.vars);
    expect(signs.exact).toBe(0);
    expect(signs.float).toBe(0);
    expect(signs.bound).toBe(0);
  });

  it("puts the exact zero line of the classroom on the diagonal", () => {
    const j = job(256);
    expect(exactLine(j, buildForm(j.form))).toEqual({ x0: 0, y0: 256, x1: 256, y1: 0 });
  });
});

describe("the A5 predicates on the grid", () => {
  const json: unknown = JSON.parse(readFileSync(new URL("../data/near-misses.json", import.meta.url), "utf8"));
  const records = parseNearMisses(json).records.map((r, k) => presetOfRecord(r, k));

  /** This function fills a grid of 32 x 32 cells at 1 ulp about the input of each sign of a preset. */
  function grids(preset: Preset) {
    return preset.signs.map((choice) => {
      const j: GridJob = { vars: preset.vars, form: choice.form, move: choice.move, view: { ox: 0, oy: 0, step: 1, n: 32 } };
      const codes = new Uint8Array(32 * 32);
      fillRows(j, buildForm(j.form), 0, 32, codes);
      return { choice, counts: tally(codes) };
    });
  }

  it("gives the exact sign, and its filter decides no float-wrong cell", () => {
    // The monthly study selects the records again, so the test asks for staged signs of both kinds, not a count.
    let staged = 0;
    let stagedRecords = 0;
    for (const preset of [...CLASSROOM, ...INCIRCLE, ...records]) {
      for (const { choice, counts } of grids(preset)) {
        const form = buildForm(choice.form);
        if (a5Of(choice.form, form) === null) continue;
        expect(counts.filter + counts.exactStage, `${preset.id} ${choice.label}`).toBe(counts.cells);
        expect(counts.a5Wrong, `${preset.id} ${choice.label}`).toBe(0);
        expect(counts.wrongButFiltered, `${preset.id} ${choice.label}`).toBe(0);
        staged++;
        if (records.includes(preset)) stagedRecords++;
      }
    }
    expect(stagedRecords).toBeGreaterThan(0);
    expect(staged).toBeGreaterThan(stagedRecords);
  });

  it("has no A5 predicate for a sign of the segment-box test", () => {
    const box = records.find((p) => p.record?.predicate === "segmentBox");
    if (!box) throw new Error("No record of the segment-box test.");
    const choice = box.signs[0] as SignChoice;
    expect(a5Of(choice.form, buildForm(choice.form))).toBeNull();
  });

  it("sends the cells near the circle to the exact stage of incircle", () => {
    for (const preset of INCIRCLE) {
      const choice = preset.signs[0] as SignChoice;
      const form = buildForm(choice.form);
      const pred = a5Of(choice.form, form);
      expect(pred?.(preset.vars).sign).toBe(cellSigns(form, preset.vars).exact);
      const counts = (grids(preset)[0] as { counts: ReturnType<typeof tally> }).counts;
      expect(counts.exactStage).toBeGreaterThan(0);
      expect(counts.filter).toBeGreaterThan(0);
    }
  });

  it("puts the four integer points on one circle", () => {
    const preset = INCIRCLE[0] as Preset;
    const choice = preset.signs[0] as SignChoice;
    const signs = cellSigns(buildForm(choice.form), preset.vars, a5Of(choice.form, buildForm(choice.form)));
    expect(signs.exact).toBe(0);
    expect(signs.a5Wrong).toBe(false);
  });
});
