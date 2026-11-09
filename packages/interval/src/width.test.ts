import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as B from "./ball.ts";
import * as I from "./interval.ts";
import { BALL_OPS, type BallOps, INTERVAL_OPS, type IntervalOps } from "./laws.test-helper.ts";
import { measureWidths, widthFindings, type WidthRecord } from "./width.test-helper.ts";

const RECORD = new URL("../test/width-record.json", import.meta.url);

/** `INTERVAL_WIDTH_RECORD=update` writes a new record. Commit it with the change that moves a width. */
const update = process.env["INTERVAL_WIDTH_RECORD"] === "update";

describe("the width gate", () => {
  const measured = measureWidths(INTERVAL_OPS, BALL_OPS);
  if (update) writeFileSync(RECORD, `${JSON.stringify(measured, null, 2)}\n`);
  const kept = JSON.parse(readFileSync(RECORD, "utf8")) as WidthRecord;

  it("each width of the fixed family equals the kept record", () => {
    expect(widthFindings(measured, kept)).toEqual([]);
  });

  it("each chain has a finite width, for intervals and for balls", () => {
    for (const [name, row] of Object.entries(measured.rows)) expect(row.max, name).toBeLessThan(Infinity);
  });

  it("fails a planted sum of intervals with each end one step wider", () => {
    const wider: IntervalOps = {
      ...INTERVAL_OPS,
      add: (x, y) => {
        const s = I.add(x, y);
        return s === null ? s : [I.nextDown(s[0]), I.nextUp(s[1])];
      },
    };
    const findings = widthFindings(measureWidths(wider, BALL_OPS), kept);
    expect(findings.some((f) => /^interval\.sum32 median loosens/.test(f))).toBe(true);
    expect(findings.every((f) => f.startsWith("interval."))).toBe(true);
  });

  it("fails a planted product of balls with a radius one step larger", () => {
    const wider: BallOps = { ...BALL_OPS, mul: (x, y) => { const p = B.mul(x, y); return { mid: p.mid, rad: I.nextUp(p.rad) }; } };
    const findings = widthFindings(measureWidths(INTERVAL_OPS, wider), kept);
    expect(findings.some((f) => /^ball\.product16 median loosens/.test(f))).toBe(true);
    expect(findings.every((f) => f.startsWith("ball.") && f.includes("loosens"))).toBe(true);
  });

  it("asks for a new record when a width is smaller", () => {
    const tighter: WidthRecord = { ...kept, rows: { ...kept.rows, "ball.sum32": { median: Infinity, max: Infinity } } };
    expect(widthFindings(measured, tighter)).toEqual([
      expect.stringMatching(/^ball\.sum32 median is tighter/),
      expect.stringMatching(/^ball\.sum32 max is tighter/),
    ]);
  });
});
