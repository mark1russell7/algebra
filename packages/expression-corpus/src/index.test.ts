import { compileFloat, documentSchema } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import { fnv1a32 } from "@mark1russell7/rigor-generators";
import { median } from "@mark1russell7/rigor-statistics";
import { describe, expect, it } from "vitest";
import {
  condition,
  corpus,
  corpusCase,
  exactValue,
  FAMILIES,
  type Family,
  isPolynomial,
  LARGE_NODES,
  nodeCount,
  POINTS,
  POLYNOMIAL_FAMILIES,
  SEEDS,
  SMALL_NODES,
} from "./index.ts";

/** The FNV-1a hash of the JSON of the default corpus. A change of a family changes it, so the change is on purpose. */
const PINNED = 4199859827;

const all = corpus();
const ofFamily = (family: Family) => all.filter((c) => c.family === family);
const conditions = (family: Family): number[] =>
  ofFamily(family).flatMap((c) => c.points.map((p) => condition(c.document, c.variables, p) as number));

describe("the corpus", () => {
  it("has one case for each family and seed, each with a new name", () => {
    expect(all).toHaveLength(FAMILIES.length * SEEDS.length);
    expect(new Set(all.map((c) => c.name)).size).toBe(all.length);
  });

  it("gives valid documents and finite points with one value for each variable", () => {
    for (const c of all) {
      expect(documentSchema.safeParse(c.document).success, c.name).toBe(true);
      expect(c.points, c.name).toHaveLength(POINTS);
      for (const p of c.points) {
        expect(p, c.name).toHaveLength(c.variables.length);
        expect(p.every(Number.isFinite), c.name).toBe(true);
      }
    }
  });

  it("keeps the counts of nodes of the families small and large", () => {
    for (const c of ofFamily("small")) expect(nodeCount(c.document)).toBeLessThanOrEqual(SMALL_NODES);
    for (const c of ofFamily("large")) {
      expect(nodeCount(c.document)).toBeGreaterThanOrEqual(LARGE_NODES[0]);
      expect(nodeCount(c.document)).toBeLessThanOrEqual(LARGE_NODES[1]);
    }
  });

  it("has a polynomial document in each case of the polynomial families", () => {
    for (const f of POLYNOMIAL_FAMILIES) for (const c of ofFamily(f)) expect(isPolynomial(c.document), c.name).toBe(true);
  });

  it("compiles each document with compileFloat, in the order of its variables", () => {
    for (const c of all) {
      const made = compileFloat(c.document);
      expect(made.ok, c.name).toBe(true);
      if (made.ok) expect(made.value.variables).toEqual(c.variables);
    }
  });
});

describe("the condition numbers", () => {
  it("are 1 in the family well", () => {
    expect(conditions("well").every((k) => k === 1)).toBe(true);
  });

  it("are at least 1e9 in the family ill", () => {
    const ks = conditions("ill");
    console.log(`ill: the smallest condition is ${Math.min(...ks).toExponential(2)}`);
    expect(ks.every((k) => k >= 1e9)).toBe(true);
  });

  it("have a median of at most 1e3 on the random geometric inputs, and at least 1e8 on the near-degenerate inputs", () => {
    const medians = Object.fromEntries(
      (["orient-random", "incircle-random", "orient-near", "incircle-near"] as const).map((f) => [f, median(conditions(f))]),
    );
    console.log(`median conditions: ${JSON.stringify(medians)}`);
    expect(medians["orient-random"]).toBeLessThanOrEqual(1e3);
    expect(medians["incircle-random"]).toBeLessThanOrEqual(1e3);
    expect(medians["orient-near"]).toBeGreaterThanOrEqual(1e8);
    expect(medians["incircle-near"]).toBeGreaterThanOrEqual(1e8);
  });

  it("are undefined for a document that is not a polynomial", () => {
    const doc = { type: "div", value: [{ type: "var", value: "x" }, { type: "num", value: 3 }] } as const;
    expect(isPolynomial(doc)).toBe(false);
    expect(condition(doc, ["x"], [1])).toBeUndefined();
  });

  it("are Infinity at a root with cancellation, and 1 at a zero without it", () => {
    const x = { type: "var", value: "x" } as const;
    expect(condition({ type: "sub", value: [x, { type: "num", value: 1 }] }, ["x"], [1])).toBe(Infinity);
    expect(condition({ type: "mul", value: [x, x] }, ["x"], [0])).toBe(1);
  });
});

describe("the seed", () => {
  it("gives the same corpus two times", () => {
    expect(corpus()).toEqual(all);
  });

  it("gives another case for another seed", () => {
    for (const f of FAMILIES) expect(JSON.stringify(corpusCase(f, 9)), f).not.toBe(JSON.stringify(corpusCase(f, 1)));
  });

  it("gives the pinned hash on each platform", () => {
    expect(fnv1a32(JSON.stringify(all))).toBe(PINNED);
  });
});

describe("the A3 bound", () => {
  it("contains the distance from the float value to the exact value at each point of the polynomial families", () => {
    let checked = 0;
    let open = 0;
    for (const f of POLYNOMIAL_FAMILIES) {
      for (const c of ofFamily(f)) {
        const made = compileFloat(c.document);
        if (!made.ok) throw new Error(c.name);
        for (const p of c.points) {
          const r = made.value.evaluate(p);
          if (!(r.error < Infinity)) {
            open++;
            continue;
          }
          const exact = (exactValue(c.document, c.variables, p) as { value: Q.Rational }).value;
          const distance = Q.abs(Q.sub(Q.fromFloat(r.value), exact));
          expect(Q.compare(distance, Q.fromFloat(r.error)) <= 0, `${c.name} at ${p.join(", ")}`).toBe(true);
          checked++;
        }
      }
    }
    console.log(`the A3 bound: ${checked} points checked, ${open} points with no claim`);
    expect(checked).toBeGreaterThan(0.9 * (checked + open));
  });
});
