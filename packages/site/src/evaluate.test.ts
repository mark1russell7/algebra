import * as Q from "@mark1russell7/rational";
import { describe, expect, it } from "vitest";
import { evaluateAll, variables } from "./evaluate.ts";
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

  it("lists the variables of a document", () => {
    expect(variables(read("(qx - px) * (ry - py)"))).toEqual(["px", "py", "qx", "ry"]);
  });
});
