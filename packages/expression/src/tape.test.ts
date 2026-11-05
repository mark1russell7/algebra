import { checkWorld } from "@mark1russell7/coeval";
import { describe, expect, it } from "vitest";
import { compileClosures, compileFloat, compileTape, type Document, type Expression, expressionMachine, type FloatFunction, nodesOf, random, summarize, TAPE, TAPE_ABOVE } from "./index.ts";
import { docs, POINTS, randomPoint, RUNS, VARS } from "./oracle.test-helper.ts";

const pair = (doc: Document): readonly [FloatFunction, FloatFunction] => {
  // The closures, by name: compileFloat gives the tape to a large document, and a tape against a tape tests nothing.
  const f = compileClosures(doc, { variables: VARS });
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

describe("the choice of compileFloat", () => {
  const sumOf = (count: number): Expression => ({ type: "add", value: Array.from({ length: count }, () => x) });
  const nodes = (doc: Expression): number => {
    const s = summarize(doc);
    if (!s.ok) throw new Error(s.error.reason);
    return nodesOf(s.value);
  };
  const made = (doc: Expression): FloatFunction => {
    const f = compileFloat(doc, { variables: VARS });
    if (!f.ok) throw new Error(f.error.reason);
    return f.value;
  };

  it("uses the closures up to TAPE_ABOVE nodes, and the tape above", () => {
    const sizes = Array.from({ length: 29 }, (_, i) => sumOf(i + 2)).map((doc) => ({ doc, size: nodes(doc) }));
    expect(sizes.map((s) => s.size)).toEqual(expect.arrayContaining([TAPE_ABOVE, TAPE_ABOVE + 1]));
    for (const { doc, size } of sizes) expect(made(doc).engine, `${size} nodes`).toBe(size > TAPE_ABOVE ? "tape" : "closures");
  });

  it("gives the value and the bound of the closures on each side of the line", () => {
    for (const count of [2, 5, 9, 10, 20]) {
      const doc = sumOf(count);
      const closures = compileClosures(doc, { variables: VARS });
      if (!closures.ok) throw new Error(closures.error.reason);
      same(doc, [closures.value, made(doc)], VARS.map((_, i) => 0.1 * (i + 1)));
    }
  });

  it("names the form of each compile", () => {
    const closures = compileClosures(sumOf(2), { variables: VARS });
    const tape = compileTape(sumOf(2), { variables: VARS });
    expect(closures.ok && closures.value.engine).toBe("closures");
    expect(tape.ok && tape.value.engine).toBe("tape");
  });

  it("refuses a variable with no position on each side of the line", () => {
    for (const doc of [sumOf(2), sumOf(20)]) expect(compileFloat(doc, { variables: [] }).ok).toBe(false);
  });
});

describe("the verb tape", () => {
  it("has an evaluator of each kind", () => {
    expect(checkWorld(expressionMachine, [TAPE])).toEqual([]);
  });

  it("gives the value and the bound of the closures on random documents", () => {
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

  it("gives the value and the bound of the closures at the values with no real result", () => {
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
