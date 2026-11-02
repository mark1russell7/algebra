import { check, checkWorld } from "@mark1russell7/coeval";
import { describe, expect, it } from "vitest";
import { cmpBound, exact, fromFloat, type Rat } from "./exact.test-helper.ts";
import {
  combine,
  costMonoid,
  type Document,
  documentSchema,
  type Expression,
  expressionMachine,
  freeMonoid,
  interval,
  numSummary,
  random,
  randomComparison,
  randomExpression,
  type Random,
  SUMMARY,
  type Summary,
  summarize,
  varSummary,
} from "./index.ts";

/** The count of random cases of each property. CI sets it. The default is 1000. */
const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 1000);
const VARS = ["x", "y", "z"];

function docs(seed: number, n = RUNS, make = (r: Random) => randomExpression(r) as Document): Document[] {
  const rnd = random(seed);
  return Array.from({ length: n }, () => (rnd() < 0.2 ? randomComparison(rnd) : make(rnd)));
}

/** A direct structural recursion over the document with `combine`, with no coeval. */
function direct(doc: Document, bounds: Record<string, readonly [number, number]> = {}): Summary {
  switch (doc.type) {
    case "num":
      return numSummary(doc.value);
    case "var":
      return varSummary(doc.value, bounds[doc.value]);
    case "neg":
      return combine("neg", [direct(doc.value, bounds)]);
    case "pow":
      return combine("pow", [direct(doc.value.base, bounds)], { exp: doc.value.exp });
    case "root":
      return combine("root", [direct(doc.value.radicand, bounds)], { index: doc.value.index });
    default:
      return combine(doc.type, doc.value.map((d) => direct(d, bounds)));
  }
}

function children(doc: Document): readonly Expression[] {
  switch (doc.type) {
    case "num":
    case "var":
      return [];
    case "neg":
      return [doc.value];
    case "pow":
      return [doc.value.base];
    case "root":
      return [doc.value.radicand];
    default:
      return doc.value;
  }
}

function nodes(doc: Document): Document[] {
  return [doc, ...children(doc).flatMap(nodes)];
}

function summaryOk(doc: Document, bounds?: Record<string, readonly [number, number]>): Summary {
  const r = summarize(doc, bounds ? { bounds } : {});
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

const hasRoot = (doc: Document): boolean => nodes(doc).some((d) => d.type === "root");

function contains(bounds: interval.Interval, r: Rat): boolean {
  return bounds !== null && cmpBound(bounds[0], r) <= 0 && cmpBound(bounds[1], r) >= 0;
}

describe("the schema", () => {
  it("accepts each generated document and keeps it the same after a JSON round trip", () => {
    for (const doc of docs(1)) {
      const back = JSON.parse(JSON.stringify(doc)) as unknown;
      expect(documentSchema.parse(back)).toEqual(doc);
    }
  });

  it.each([
    ["-0", { type: "num", value: -0 }],
    ["NaN", { type: "num", value: Number.NaN }],
    ["infinity", { type: "num", value: Infinity }],
    ["a bare child", { type: "add", value: [1, { type: "num", value: 2 }] }],
    ["an add of one part", { type: "add", value: [{ type: "num", value: 1 }] }],
    ["a sub of three parts", { type: "sub", value: [{ type: "num", value: 1 }, { type: "num", value: 1 }, { type: "num", value: 1 }] }],
    ["a root of index 1", { type: "root", value: { radicand: { type: "num", value: 4 }, index: 1 } }],
    ["a pow of exponent 0.5", { type: "pow", value: { base: { type: "num", value: 4 }, exp: 0.5 } }],
    ["an extra field", { type: "num", value: 1, name: "a" }],
    ["a bad variable name", { type: "var", value: "1x" }],
    ["an unknown kind", { type: "sin", value: { type: "num", value: 1 } }],
    ["a comparison inside an add", { type: "add", value: [{ type: "lt", value: [{ type: "num", value: 1 }, { type: "num", value: 2 }] }, { type: "num", value: 1 }] }],
  ])("refuses %s", (_, doc) => {
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
});

describe("the coeval world", () => {
  it("has an evaluator for the verb summary of each kind", () => {
    expect(checkWorld(expressionMachine, [SUMMARY])).toEqual([]);
  });

  it("checks each generated document with no issue", () => {
    for (const doc of docs(2, Math.min(RUNS, 300))) expect(check(expressionMachine, doc, { verb: SUMMARY })).toEqual([]);
  });
});

describe("the monoids", () => {
  const rnd = random(3);
  const names = (): string[] => [...new Set(Array.from({ length: Math.floor(rnd() * 4) }, () => VARS[Math.floor(rnd() * 3)] as string))].sort();
  const costs = (): Record<string, number> => costMonoid.combine({}, Object.fromEntries(names().map((k) => [k, 1 + Math.floor(rnd() * 3)])));

  it("free: identity, associativity, commutativity and idempotence", () => {
    for (let i = 0; i < RUNS; i++) {
      const [a, b, c] = [names(), names(), names()];
      expect(freeMonoid.combine(freeMonoid.empty, a)).toEqual(a);
      expect(freeMonoid.combine(a, freeMonoid.empty)).toEqual(a);
      expect(freeMonoid.combine(freeMonoid.combine(a, b), c)).toEqual(freeMonoid.combine(a, freeMonoid.combine(b, c)));
      expect(freeMonoid.combine(a, b)).toEqual(freeMonoid.combine(b, a));
      expect(freeMonoid.combine(a, a)).toEqual(a);
    }
  });

  it("cost: identity, associativity and commutativity", () => {
    for (let i = 0; i < RUNS; i++) {
      const [a, b, c] = [costs(), costs(), costs()];
      expect(costMonoid.combine(costMonoid.empty, a)).toEqual(a);
      expect(costMonoid.combine(a, costMonoid.empty)).toEqual(a);
      expect(costMonoid.combine(costMonoid.combine(a, b), c)).toEqual(costMonoid.combine(a, costMonoid.combine(b, c)));
      expect(costMonoid.combine(a, b)).toEqual(costMonoid.combine(b, a));
    }
  });
});

describe("the summary", () => {
  it("of coeval equals the combine of the summaries of the children", () => {
    for (const doc of docs(4)) expect(summaryOk(doc)).toEqual(direct(doc));
  });

  it("names each variable of the document and counts each node", () => {
    for (const doc of docs(5)) {
      const s = summaryOk(doc);
      const all = nodes(doc);
      expect(s.free).toEqual([...new Set(all.flatMap((d) => (d.type === "var" ? [d.value] : [])))].sort());
      expect(Object.values(s.cost).reduce((a, b) => a + b, 0)).toBe(all.length);
    }
  });

  it("gives bounds that contain the exact value at a point inside the variable bounds", () => {
    const rnd = random(6);
    let decided = 0;
    for (const doc of docs(7)) {
      if (hasRoot(doc)) continue;
      const bounds: Record<string, readonly [number, number]> = {};
      const point: Record<string, number> = {};
      for (const v of VARS) {
        const [a, b] = [randomExpression(rnd, { maxDepth: 0, variables: [] }), randomExpression(rnd, { maxDepth: 0, variables: [] })].map((d) => (d as { value: number }).value) as [number, number];
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const t = rnd();
        const p = t < 0.25 ? lo : t < 0.5 ? hi : Math.min(hi, Math.max(lo, lo + (hi - lo) * rnd()));
        bounds[v] = [lo, hi];
        point[v] = Number.isFinite(p) ? p : lo;
      }
      const s = summaryOk(doc, bounds);
      const value = exact(doc, point);
      if (value === "root") continue;
      if (s.bounds === null) expect(value).toBeUndefined();
      if (value !== undefined) {
        expect(contains(s.bounds, value), JSON.stringify({ doc, point, bounds: s.bounds })).toBe(true);
        decided++;
      }
    }
    expect(decided).toBeGreaterThan(RUNS / 4);
  });
});

describe("the degree", () => {
  const x: Expression = { type: "var", value: "x" };
  const y: Expression = { type: "var", value: "y" };
  const one: Expression = { type: "num", value: 1 };
  const degree = (doc: Document): number | null => summaryOk(doc).degree;

  it.each<[string, Document, number | null]>([
    ["a constant", one, 0],
    ["a variable", x, 1],
    ["x * y + 1", { type: "add", value: [{ type: "mul", value: [x, y] }, one] }, 2],
    ["(x - y) ** 3", { type: "pow", value: { base: { type: "sub", value: [x, y] }, exp: 3 } }, 3],
    ["x / 2", { type: "div", value: [x, { type: "num", value: 2 }] }, 1],
    ["1 / x", { type: "div", value: [one, x] }, null],
    ["x ** -1", { type: "pow", value: { base: x, exp: -1 } }, null],
    ["sqrt(4)", { type: "root", value: { radicand: { type: "num", value: 4 }, index: 2 } }, 0],
    ["sqrt(x)", { type: "root", value: { radicand: x, index: 2 } }, null],
    ["min(x, 1)", { type: "min", value: [x, one] }, null],
    ["x < 1", { type: "lt", value: [x, one] }, null],
  ])("of %s", (_, doc, d) => {
    expect(degree(doc)).toBe(d);
  });
});

describe("the intervals", () => {
  it("step to the next float", () => {
    expect(interval.nextUp(1)).toBe(1 + Number.EPSILON);
    expect(interval.nextDown(1)).toBe(1 - Number.EPSILON / 2);
    expect(interval.nextUp(0)).toBe(Number.MIN_VALUE);
    expect(interval.nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(interval.nextUp(-Number.MIN_VALUE)).toBe(-0);
    expect(interval.nextUp(Number.MAX_VALUE)).toBe(Infinity);
    expect(interval.nextDown(Infinity)).toBe(Number.MAX_VALUE);
  });

  it("keep an exact sum as a point and widen an inexact sum", () => {
    expect(interval.add([1, 1], [2, 2])).toEqual([3, 3]);
    const s = interval.add([0.1, 0.1], [0.2, 0.2]);
    expect(s).not.toBeNull();
    const exactSum = { n: 0n, d: 1n };
    const a = fromFloat(0.1);
    const b = fromFloat(0.2);
    Object.assign(exactSum, { n: a.n * b.d + b.n * a.d, d: a.d * b.d });
    expect(contains(s, exactSum)).toBe(true);
    expect(s?.[0]).toBeLessThan(s?.[1] as number);
  });

  it("give the empty interval for no real value", () => {
    expect(interval.div([1, 1], [0, 0])).toBeNull();
    expect(interval.root([-2, -1], 2)).toBeNull();
    expect(interval.pow([0, 0], -1)).toBeNull();
    expect(interval.div([1, 1], [-1, 1])).toEqual(interval.WHOLE);
  });

  it("give roots that contain the real root", () => {
    const sqrt2 = interval.root([2, 2], 2);
    expect(sqrt2).not.toBeNull();
    const [lo, hi] = sqrt2 as [number, number];
    expect(lo * lo <= 2 && hi * hi >= 2).toBe(true);
    expect(interval.root([4, 4], 2)).toEqual([2, 2]);
    expect(interval.root([27, 27], 3)).toEqual([1, 27]);
    expect(interval.root([-8, -8], 3)).toEqual([-8, -1]);
    expect(interval.root([-4, 9], 2)).toEqual([0, 3]);
  });

  it("decide a comparison only when the intervals decide it", () => {
    expect(interval.lt([0, 1], [2, 3])).toEqual([1, 1]);
    expect(interval.lt([2, 3], [0, 2])).toEqual([0, 0]);
    expect(interval.lt([0, 2], [1, 3])).toEqual([0, 1]);
    expect(interval.eq([1, 1], [1, 1])).toEqual([1, 1]);
    expect(interval.le([1, 1], [1, 1])).toEqual([1, 1]);
  });
});
