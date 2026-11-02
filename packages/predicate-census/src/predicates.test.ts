import { random, summarize } from "@mark1russell7/expression";
import { describe, expect, it } from "vitest";
import { boundSign, classify, dyadic as D, PREDICATES, structuralZero } from "./index.ts";
import type { SignForm } from "./index.ts";
import { boxPairPoint, pointSidePoint, segmentBoxPoint, segmentPairPoint, segmentRect, segmentRectPoint } from "./predicates.ts";
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

describe("the structural filter", () => {
  it("gives the sign 0 to an orientation with two equal points, and to no other sign", () => {
    const [abc, , , cdb] = PREDICATES.segmentPair.signs as [SignForm, SignForm, SignForm, SignForm];
    const shared = segmentPairPoint([0.1, 0.7], [0.37, 0.91], [0.37, 0.91], [0.2, 0.3]);
    expect(structuralZero(abc, shared)).toBe(true);
    expect(structuralZero(cdb, shared)).toBe(true);
    expect(abc.bounds(shared)).not.toEqual([0, 0]);
    expect(structuralZero(abc, segmentPairPoint([0.1, 0.7], [0.37, 0.91], [0.37, 0.9100000000000001], [0.2, 0.3]))).toBe(false);
    for (const form of PREDICATES.segmentBox.signs) expect(structuralZero(form, segmentBoxPoint([0, 0], [0, 0], { x: 0, y: 0, w: 0, h: 0 }))).toBe(false);
  });

  it("decides a shared end that the bound does not decide", () => {
    const r = classify("segmentPair", segmentPairPoint([0.1, 0.2], [0.7, 0.3], [0.7, 0.3], [0.2, 0.9]));
    expect(r.undecided).toBe(true);
    expect(r.undecidedFiltered).toBe(false);
    expect(r.exactAnswer).toBe(false);
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

  it("for a segment and a box: the sign rule gives the answer of the highways clip with eps", () => {
    const rnd = random(29);
    let hits = 0;
    let decided = 0;
    const epsOf = (): number => [0, 1e-6, 0.05, 0.5][Math.floor(rnd() * 4)] as number;
    for (let i = 0; i < RUNS; i++) {
      const v = (): [number, number] => [coordinate(rnd), coordinate(rnd)];
      const a = v();
      const b = rnd() < 0.05 ? a : v();
      const eps = epsOf();
      const box = { x: coordinate(rnd), y: coordinate(rnd), w: coordinate(rnd), h: coordinate(rnd) };
      const want = O.hitsBox(a, b, box, eps);
      if (want) hits++;
      const r = classify("segmentBox", segmentBoxPoint(a, b, box, eps));
      expect([a, b, box, eps, r.exactAnswer]).toEqual([a, b, box, eps, want]);
      if (!r.undecided) {
        decided++;
        expect(r.boundAnswer).toBe(want);
      }
      expect(r.signs.every((s) => s.contained)).toBe(true);
    }
    expect(hits).toBeGreaterThan(RUNS / 10);
    expect(decided).toBeGreaterThan(RUNS / 2);
  });

  it("for a segment and a rectangle, a reversed rectangle too", () => {
    const rnd = random(37);
    let hits = 0;
    for (let i = 0; i < RUNS; i++) {
      const v = (): [number, number] => [coordinate(rnd), coordinate(rnd)];
      const a = v();
      const b = rnd() < 0.05 ? a : v();
      const rect = [coordinate(rnd), coordinate(rnd), coordinate(rnd), coordinate(rnd)] as const;
      const eps = rnd() < 0.5 ? 0 : 1e-6;
      const want = O.hitsRect(a, b, rect, eps);
      if (want) hits++;
      const r = classify(segmentRect, segmentRectPoint(a, b, rect, eps));
      expect([a, b, rect, r.exactAnswer]).toEqual([a, b, rect, want]);
      if (!r.undecided) expect(r.boundAnswer).toBe(want);
    }
    expect(hits).toBeGreaterThan(RUNS / 20);
  });

  it("for a point and a line: the exact sign", () => {
    const rnd = random(41);
    for (let i = 0; i < RUNS; i++) {
      const v = (): [number, number] => [coordinate(rnd), coordinate(rnd)];
      const [p, a, b] = [v(), v(), v()];
      const r = classify("pointSide", pointSidePoint(p, a, b));
      expect(r.exactAnswer).toBe(O.orient(a, b, p));
      if (!r.undecided) expect(r.boundAnswer).toBe(r.exactAnswer);
    }
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
