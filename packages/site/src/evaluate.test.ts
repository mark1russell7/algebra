import * as Q from "@mark1russell7/rational";
import { describe, expect, it } from "vitest";
import { decisions, evaluateAll, variables, widthOf } from "./evaluate.ts";
import { readExpression, writeExpression } from "./syntax.ts";

function read(text: string) {
  const r = readExpression(text);
  if (!r.ok) throw new Error(r.message);
  return r.doc;
}

describe("the syntax", () => {
  it("reads an expression and writes it back", () => {
    const doc = read("(a + b) - a");
    expect(readExpression(writeExpression(doc))).toEqual({ ok: true, doc });
  });

  it("gives a message for a bad text", () => {
    const r = readExpression("(a + ");
    expect(r.ok).toBe(false);
  });
});

describe("the evaluators", () => {
  it("shows the cancellation of (a + b) - a", () => {
    const e = evaluateAll(read("(a + b) - a"), { a: 1e16, b: 1 });
    expect(e.float.ok && e.float.value.value).toBe(0);
    expect(e.float.ok && e.float.value.error).toBeGreaterThanOrEqual(1);
    expect(e.boundHolds).toBe(true);
    expect(e.exact.ok && Q.toNumber(e.exact.value)).toBe(1);
    expect(e.interval.ok && e.interval.value).toEqual([-2, 2]);
    expect(e.contained).toBe(true);
  });

  it("finds a wrong float sign of a difference of squares", () => {
    const e = evaluateAll(read("(x + y) * (x - y) - (x * x - y * y)"), { x: 100000001, y: 100000000 });
    expect(e.float.ok && e.float.value.value).toBe(1);
    expect(e.boundHolds).toBe(true);
    expect(e.exact.ok && Q.sign(e.exact.value)).toBe(0);
    expect(e.contained).toBe(true);
  });

  it("names a kind that an evaluator does not know", () => {
    const e = evaluateAll(read("root(x, 2) * root(x, 2) - x"), { x: 2 });
    expect(e.float.ok && Number.isFinite(e.float.value.error)).toBe(true);
    expect(e.exact.ok).toBe(false);
    expect(e.boundHolds).toBeNull();
    expect(e.interval.ok).toBe(true);
  });

  it("gives the A4 interval and ball, and their widths", () => {
    const e = evaluateAll(read("(a + b) - a"), { a: 1e16, b: 1 });
    const en = e.enclosure.ok ? e.enclosure.value : null;
    expect(Array.isArray(en)).toBe(true);
    const [lo, hi] = en as readonly [number, number];
    expect(lo).toBeLessThanOrEqual(1);
    expect(hi).toBeGreaterThanOrEqual(1);
    expect(widthOf([lo, hi])).toBeGreaterThanOrEqual(hi - lo);
    const ball = e.ball.ok ? e.ball.value : null;
    expect(ball?.mid).toBe(0);
    expect(ball !== null && ball.rad >= 1).toBe(true);
    expect(decisions(e)).toEqual({ float: "undecided", enclosure: "undecided", ball: "undecided", interval: "undecided", exact: 1 });
  });

  it("proves the sign of an orientation of the census with each bound evaluator", () => {
    const point = { px: 129.4905948334925, py: 438.382847321023, qx: 97.32557977413207, qy: 374.54016591532275, rx: 90, ry: 360 };
    const d = decisions(evaluateAll(read("(qx - px) * (ry - py) - (qy - py) * (rx - px)"), point));
    expect(d.exact).toBe(1);
    for (const x of [d.float, d.enclosure, d.ball, d.interval]) expect(x === "undecided" || x === 1).toBe(true);
  });

  it("decides a comparison with decideInterval and decideBall, or leaves it undecided", () => {
    const wrong = decisions(evaluateAll(read("(a + b) - a < 1"), { a: 1e16, b: 1 }));
    expect(wrong.exact).toBe(false);
    expect(wrong.enclosure).toBe("undecided");
    expect(wrong.ball).toBe("undecided");
    const easy = decisions(evaluateAll(read("x * x < 2"), { x: 1 }));
    expect(easy).toMatchObject({ enclosure: true, ball: true, exact: true });
  });

  it("gives the A4 claim of no real value for a quotient by 0", () => {
    const e = evaluateAll(read("1 / x"), { x: 0 });
    expect(e.enclosure.ok && e.enclosure.value).toBeNull();
    expect(decisions(e).enclosure).toBe("no value");
  });

  it("lists the variables of a document", () => {
    expect(variables(read("(qx - px) * (ry - py)"))).toEqual(["px", "py", "qx", "ry"]);
  });
});
