import { describe, expect, it } from "vitest";
import { buildForm, cellOffset, cellPoint, cellSigns, decode, encode, exactLine, fillRows, floatSign, tally, ulp } from "./grid.ts";
import type { CellSigns, GridJob } from "./grid.ts";
import { CLASSROOM } from "./presets.ts";
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
          const cell: CellSigns = { float, exact, bound };
          expect(decode(encode(cell))).toEqual(cell);
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
