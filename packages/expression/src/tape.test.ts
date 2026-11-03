import { checkWorld } from "@mark1russell7/coeval";
import { describe, expect, it } from "vitest";
import { compileFloat, compileTape, type Document, type Expression, expressionMachine, type FloatFunction, random, TAPE } from "./index.ts";
import { docs, POINTS, randomPoint, RUNS, VARS } from "./oracle.test-helper.ts";

const pair = (doc: Document): readonly [FloatFunction, FloatFunction] => {
  const f = compileFloat(doc, { variables: VARS });
  const t = compileTape(doc, { variables: VARS });
  if (!f.ok || !t.ok) throw new Error("The document does not compile.");
  return [f.value, t.value];
};

/** This function expects the same value and the same bound, with `Object.is`, at one point. */
function same(doc: Document, [f, t]: readonly [FloatFunction, FloatFunction], values: readonly number[]): void {
  const a = f.evaluate(values);
  const b = t.evaluate(values);
  const where = `${JSON.stringify(doc)} at ${values.join(", ")}`;
  expect(Object.is(a.value, b.value), `value of ${where}: ${a.value}, ${b.value}`).toBe(true);
  expect(Object.is(a.error, b.error), `bound of ${where}: ${a.error}, ${b.error}`).toBe(true);
}

const x: Expression = { type: "var", value: VARS[0] as string };
const y: Expression = { type: "var", value: VARS[1] as string };
const num = (value: number): Expression => ({ type: "num", value });

describe("the verb tape", () => {
  it("has an evaluator of each kind", () => {
    expect(checkWorld(expressionMachine, [TAPE])).toEqual([]);
  });

  it("gives the value and the bound of compileFloat on random documents", () => {
    const r = random(202);
    for (const doc of docs(29, RUNS)) {
      const fns = pair(doc);
      for (let i = 0; i < POINTS; i++) {
        const at = randomPoint(r);
        same(doc, fns, VARS.map((v) => at[v] as number));
      }
    }
  });

  const special = [0, -0, 1, -1, 2 ** -1074, 2 ** 1023, Infinity, -Infinity, Number.NaN];
  const shapes: readonly Document[] = [
    num(3),
    x,
    { type: "add", value: [x] },
    { type: "add", value: [x, y, num(0.1), x] },
    { type: "mul", value: [x, y, y] },
    { type: "min", value: [x, y, num(1)] },
    { type: "max", value: [y, x] },
    { type: "neg", value: x },
    { type: "sub", value: [x, y] },
    { type: "div", value: [x, y] },
    { type: "pow", value: { base: x, exp: 0 } },
    { type: "pow", value: { base: x, exp: 1 } },
    { type: "pow", value: { base: x, exp: 13 } },
    { type: "pow", value: { base: x, exp: -7 } },
    { type: "root", value: { radicand: x, index: 2 } },
    { type: "root", value: { radicand: x, index: 3 } },
    { type: "root", value: { radicand: x, index: 4 } },
    { type: "lt", value: [x, y] },
    { type: "le", value: [x, y] },
    { type: "eq", value: [x, y] },
  ];

  it("gives the value and the bound of compileFloat at the values with no real result", () => {
    for (const doc of shapes) {
      const fns = pair(doc);
      for (const a of special) {
        for (const b of special) same(doc, fns, VARS.map((_, i) => (i === 0 ? a : i === 1 ? b : 0)));
      }
    }
  });

  it("gives the same answer on a second call, because a call writes each register again", () => {
    const [, t] = pair({ type: "add", value: [{ type: "mul", value: [x, num(3)] }, y] });
    const values = VARS.map((_, i) => i + 1.5);
    const first = t.evaluate(values);
    t.evaluate(VARS.map(() => Number.NaN));
    expect(t.evaluate(values)).toEqual(first);
  });

  it("refuses a call with too few values, and a document with a variable that has no position", () => {
    const made = compileTape(x, { variables: [VARS[0] as string] });
    if (!made.ok) throw new Error(made.error.reason);
    expect(() => made.value.evaluate([])).toThrow(RangeError);
    expect(compileTape(y, { variables: [VARS[0] as string] }).ok).toBe(false);
  });
});
