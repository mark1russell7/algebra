import { random, summarize } from "@mark1russell7/expression";
import { describe, expect, it } from "vitest";
import { boundSign, CALL_SITE_RULES, checkRuleSources, classify, dyadic as D, pointSideTieLow, PREDICATES, segmentPairClosed, structuralZero } from "./index.ts";
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

describe("the rules of the call sites", () => {
  const v = (x: number, y: number): [number, number] => [x, y];
  it("gives -1 for the zero side of outOf, as highways does", () => {
    // The input of screen-v1/hub-chain/s0: p is the exact midpoint of the chord a b.
    const point = pointSidePoint(v(2984, 102), v(2000, 182.71875), v(3968, 21.28125));
    expect(classify(PREDICATES.pointSide, point).exactAnswer).toBe(0);
    const r = classify(CALL_SITE_RULES["physics.outOf"]!.predicate, point, -1);
    expect(r.exactAnswer).toBe(-1);
    expect(r.floatWrong).toBe(false);
  });

  it("counts a touch as a crossing of the mesh, as highways does", () => {
    // The input of screen-v1/tiny-uniform/s0: the end d of c d is on the segment a b.
    const point = segmentPairPoint(v(10, 42), v(10, 237), v(90, 169.842811927414), v(10, 132.157188072586));
    expect(classify(PREDICATES.segmentPair, point).exactAnswer).toBe(false);
    const r = classify(CALL_SITE_RULES["mesh.crossing"]!.predicate, point, true);
    expect(r.exactAnswer).toBe(true);
    expect(r.floatWrong).toBe(false);
  });

  it("does not cross two collinear segments of the mesh", () => {
    const point = segmentPairPoint(v(0, 0), v(2, 0), v(1, 0), v(3, 0));
    expect(classify(segmentPairClosed, point).exactAnswer).toBe(false);
  });

  it("gives the same answer as the default rules away from a zero sign", () => {
    const pairs = [
      segmentPairPoint(v(0, 0), v(2, 2), v(0, 2), v(2, 0)),
      segmentPairPoint(v(0, 0), v(1, 0), v(0, 1), v(1, 1)),
    ];
    for (const p of pairs) expect(classify(segmentPairClosed, p).exactAnswer).toBe(classify(PREDICATES.segmentPair, p).exactAnswer);
    expect(classify(pointSideTieLow, pointSidePoint(v(0, 1), v(0, 0), v(1, 0))).exactAnswer).toBe(1);
    expect(classify(pointSideTieLow, pointSidePoint(v(0, -1), v(0, 0), v(1, 0))).exactAnswer).toBe(-1);
  });
});

describe("the check of the rule sources", () => {
  const sources = Object.values(CALL_SITE_RULES).flatMap((r) => r.sources);
  const tree = (shift: number, drop?: string) => (file: string) => {
    const mine = sources.filter((s) => s.file === file && s.text !== drop);
    if (mine.length === 0 && !sources.some((s) => s.file === file)) return null;
    const lines: string[] = Array.from({ length: 200 }, () => "");
    for (const s of mine) lines[s.line - 1 + shift] = `    ${s.text}`;
    return lines.join("\n");
  };

  it("holds for each line at its place", () => {
    const checks = checkRuleSources(tree(0));
    expect(checks).toHaveLength(sources.length);
    expect(checks.every((c) => c.holds && c.foundAt === c.line)).toBe(true);
  });

  it("holds, with the new line, for a line that moved", () => {
    expect(checkRuleSources(tree(3)).every((c) => c.holds && c.foundAt === c.line + 3)).toBe(true);
  });

  it("fails for a line that highways no longer has", () => {
    const checks = checkRuleSources(tree(0, "const k = cross > 0 ? 1 : -1;"));
    expect(checks.filter((c) => !c.holds).map((c) => c.fn)).toEqual(["physics.outOf"]);
    expect(checkRuleSources(() => null).some((c) => c.holds)).toBe(false);
  });
});
