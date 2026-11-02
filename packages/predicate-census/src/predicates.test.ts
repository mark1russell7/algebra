import { random, summarize } from "@mark1russell7/expression";
import { describe, expect, it } from "vitest";
import { boundSign, classify, dyadic as D, PREDICATES } from "./index.ts";
import { boxPairPoint, segmentBoxPoint, segmentPairPoint } from "./predicates.ts";
import * as O from "./oracle.test-helper.ts";

const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 1000);

/** A coordinate with many ties: a whole number, a tenth or a float of the unit square. */
function coordinate(rnd: () => number): number {
  const k = Math.floor(rnd() * 3);
  if (k === 0) return Math.floor(rnd() * 5);
  if (k === 1) return Math.floor(rnd() * 11) / 10;
  return rnd();
}

describe("the sign of a bound", () => {
  it("fixes a sign only for a bound that is entirely positive, entirely negative or exactly zero", () => {
    expect(boundSign([1e-300, 1])).toBe(1);
    expect(boundSign([-1, -1e-300])).toBe(-1);
    expect(boundSign([0, 0])).toBe(0);
    expect(boundSign([0, 1e-17])).toBeNull();
    expect(boundSign([-1e-17, 0])).toBeNull();
    expect(boundSign([-1, 1])).toBeNull();
    expect(boundSign(null)).toBeNull();
  });
});

describe("the dyadic numbers", () => {
  it("give the exact value of each float, as the rational oracle does", () => {
    const rnd = random(7);
    for (let i = 0; i < RUNS; i++) {
      const x = (rnd() - 0.5) * 10 ** Math.floor(rnd() * 40 - 20);
      const y = (rnd() - 0.5) * 10 ** Math.floor(rnd() * 40 - 20);
      const exact = O.sub(O.mul(O.fromFloat(x), O.fromFloat(y)), O.fromFloat(y));
      expect(D.sign(D.sub(D.mul(D.fromFloat(x), D.fromFloat(y)), D.fromFloat(y)))).toBe(O.sign(exact));
    }
    expect(D.fromFloat(5e-324)).toEqual({ m: 1n, e: -1074 });
    expect(D.compareBound(Infinity, D.fromFloat(1))).toBe(1);
    expect(D.compareBound(-Infinity, D.fromFloat(1))).toBe(-1);
  });
});

describe("the compiled signs", () => {
  it("give the same bound as summarize of A1", () => {
    const rnd = random(11);
    for (let i = 0; i < 50; i++) {
      const p = segmentBoxPoint([rnd(), rnd()], [rnd(), rnd()], { x: rnd(), y: rnd(), w: rnd(), h: rnd() });
      const bounds = Object.fromEntries(Object.entries(p).map(([k, x]) => [k, [x, x] as const]));
      for (const form of PREDICATES.segmentBox.signs) {
        const r = summarize(form.doc, { bounds });
        expect(r.ok).toBe(true);
        if (r.ok) expect(form.bounds(p)).toEqual(r.value.bounds);
      }
    }
  });
});

describe("the exact answers agree with the rational oracle", () => {
  it("for segment pairs", () => {
    const rnd = random(23);
    for (let i = 0; i < RUNS; i++) {
      const v = (): [number, number] => [coordinate(rnd), coordinate(rnd)];
      const [a, b, c, d] = [v(), v(), v(), v()];
      expect(classify("segmentPair", segmentPairPoint(a, b, c, d)).exactAnswer).toBe(O.crosses(a, b, c, d));
    }
  });

  it("for a segment and a box: the sign rule gives the answer of the Liang-Barsky clip", () => {
    const rnd = random(29);
    let hits = 0;
    for (let i = 0; i < RUNS; i++) {
      const v = (): [number, number] => [coordinate(rnd), coordinate(rnd)];
      const a = v();
      const b = rnd() < 0.05 ? a : v();
      const box = { x: coordinate(rnd), y: coordinate(rnd), w: coordinate(rnd), h: coordinate(rnd) };
      const want = O.hitsOpenBox(a, b, box);
      if (want) hits++;
      expect([a, b, box, classify("segmentBox", segmentBoxPoint(a, b, box)).exactAnswer]).toEqual([a, b, box, want]);
    }
    expect(hits).toBeGreaterThan(RUNS / 10);
  });

  it("for box pairs", () => {
    const rnd = random(31);
    for (let i = 0; i < RUNS; i++) {
      const box = () => ({ x: coordinate(rnd), y: coordinate(rnd), w: coordinate(rnd), h: coordinate(rnd) });
      const [a, b] = [box(), box()];
      const eps = rnd() < 0.3 ? 1e-9 : 0;
      expect(classify("boxPair", boxPairPoint(a, b, eps)).exactAnswer).toBe(O.overlaps(a, b, eps));
    }
  });
});
