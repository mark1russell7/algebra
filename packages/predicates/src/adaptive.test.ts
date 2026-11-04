import { describe, expect, it } from "vitest";
import { random } from "@mark1russell7/expression";
import type { Random } from "@mark1russell7/expression";
import * as D from "./dyadic.ts";
import {
  crossExpansion,
  EXPANSION_MAX,
  EXPANSION_MIN,
  estimate,
  expansionSign,
  inExpansionRange,
  RESULT_BOUND,
  scaleExpansion,
  sumExpansions,
  twoDiffTail,
  twoProductTail,
  twoSumTail,
} from "./expansion.ts";
import {
  INCIRCLE_COMPONENTS,
  INCIRCLE_STAGE_B,
  INCIRCLE_STAGE_C,
  incircleAdaptive,
  incircleExact,
  incircleFirstOrder,
  incirclePermanent,
  incircleStageB,
  UNDECIDED,
} from "./incircle.ts";
import { ORIENT_STAGE_B, ORIENT_STAGE_C, orient2dExact, orientAdaptive, orientFirstOrder } from "./orient.ts";
import { incircle, orient2d } from "./index.ts";
import * as C from "./corpus.test-helper.ts";
import type { Eight, Family, Six } from "./corpus.test-helper.ts";

const U = 2 ** -53;
const F = D.fromFloat;

/** The exact value of an expansion. */
function value(n: number, e: Float64Array): D.Dyadic {
  let sum = F(0);
  for (let i = 0; i < n; i++) sum = D.add(sum, F(e[i] as number));
  return sum;
}

const same = (x: D.Dyadic, y: D.Dyadic): boolean => D.compare(x, y) === 0;
const magnitude = (x: D.Dyadic): D.Dyadic => (D.sign(x) < 0 ? D.neg(x) : x);

/** A float of a wide range of exponents in the guard, with a full mantissa. */
function wide(rnd: Random): number {
  return (rnd() - 0.5) * 2 ** Math.floor(rnd() * 120 - 60);
}

/** The value `true` when the expansion has no zero and strictly increasing magnitudes. */
function ordered(n: number, e: Float64Array): boolean {
  for (let i = 0; i < n; i++) {
    if (e[i] === 0) return false;
    if (i > 0 && Math.abs(e[i] as number) <= Math.abs(e[i - 1] as number)) return false;
  }
  return true;
}

/** The families of the corpus inside the guard. The family `scale` is out of the guard in most points. */
const GUARDED: readonly Family[] = ["random", "grid", "near", "ties"];

const inGuard = (p: readonly number[]): boolean => p.every(inExpansionRange);

/** Points at very different scales, near a line through 0: the differences have tails, and the value is near 0. */
function mixedOrient(rnd: Random): Six {
  const t = rnd() * 2 - 1;
  const [x, y] = [wide(rnd), wide(rnd)];
  const big = 2 ** Math.floor(rnd() * 40);
  const a = [x, y];
  const b = [x + big, y + big];
  const c = [x + t * big, y + t * big];
  const order = Math.floor(rnd() * 3);
  const near = (v: number): number => C.moveUlps(v, Math.floor(rnd() * 5) - 2);
  const [p, q, r] = [a, b, c].map((v) => [near(v[0] as number), near(v[1] as number)]) as [number[], number[], number[]];
  return (order === 0 ? [...p, ...q, ...r] : order === 1 ? [...r, ...p, ...q] : [...q, ...r, ...p]) as Six;
}

/** Corners of a box and points of a circle with a far center: the differences have tails, and the value is near 0. */
function mixedIncircle(rnd: Random): Eight {
  const [x0, y0, x1, y1] = [wide(rnd), wide(rnd), wide(rnd), wide(rnd)];
  const box: Eight = [x0, y0, x1, y0, x1, y1, x0, y1];
  if (rnd() < 0.5) return box;
  const i = Math.floor(rnd() * 8);
  box[i] = C.moveUlps(box[i] as number, Math.floor(rnd() * 5) - 2);
  return box;
}

/**
 * Hard points of the orientation: `b = 2 a`, and `c` is a convergent of the fraction `ax / ay`, at a far scale. The value
 * is `ax cy - ay cx`, far below the unit roundoff of its terms. So stage C has only noise, and stage D must answer.
 */
function convergentOrient(rnd: Random): Six {
  const full = (): bigint => (BigInt(Math.floor(rnd() * 2 ** 26)) << 27n) | BigInt(Math.floor(rnd() * 2 ** 27)) | 1n;
  const [ax, ay] = [full(), full()];
  let [r0, r1, p0, p1, q0, q1] = [ax, ay, 0n, 1n, 1n, 0n];
  const convergents: [bigint, bigint][] = [];
  while (r1 !== 0n) {
    const k = r0 / r1;
    [r0, r1] = [r1, r0 - k * r1];
    [p0, p1] = [p1, k * p1 + p0];
    [q0, q1] = [q1, k * q1 + q0];
    if (q1 !== 0n && r1 !== 0n) convergents.push([p1, q1]);
  }
  const [p, q] = convergents[Math.max(0, convergents.length - 1 - Math.floor(rnd() * 4))] as [bigint, bigint];
  const scale = 2 ** -Math.floor(rnd() * 40);
  return [Number(ax), Number(ay), 2 * Number(ax), 2 * Number(ay), Number(p) * scale, Number(q) * scale];
}

/**
 * Points whose differences have a relative error near the unit roundoff. Each coordinate of `a`, `b` and `c` is 1 or -1
 * with an ulp up, and `d` is near the half ulp of 1. So each difference rounds by almost `u` of its value.
 */
function alignedIncircle(rnd: Random): Eight {
  const unit = (): number => (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.5 ? 1 : 1 + 2 ** -52);
  const small = (): number => (rnd() < 0.5 ? -1 : 1) * (1 - rnd() * 2 ** -6) * 2 ** -53;
  return [unit(), unit(), unit(), unit(), unit(), unit(), small(), small()];
}

describe("the float pairs of Shewchuk", () => {
  it("give the exact error of each operation", () => {
    const rnd = random(11);
    for (let i = 0; i < C.RUNS; i++) {
      const [a, b] = [wide(rnd), wide(rnd)];
      const sum = a + b;
      expect(same(D.add(F(sum), F(twoSumTail(a, b, sum))), D.add(F(a), F(b)))).toBe(true);
      const difference = a - b;
      expect(same(D.add(F(difference), F(twoDiffTail(a, b, difference))), D.sub(F(a), F(b)))).toBe(true);
      const product = a * b;
      expect(same(D.add(F(product), F(twoProductTail(a, b, product))), D.mul(F(a), F(b)))).toBe(true);
    }
  });
});

describe("the expansions", () => {
  it("are the exact value of a b - c d, in order", () => {
    const rnd = random(12);
    const h = new Float64Array(4);
    for (let i = 0; i < C.RUNS; i++) {
      const [a, b, c] = [wide(rnd), wide(rnd), wide(rnd)];
      // A value of d near a b / c gives a small value, with cancellation.
      const d = rnd() < 0.5 ? (a * b) / c : wide(rnd);
      const n = crossExpansion(a, b, c, d, h);
      expect(same(value(n, h), D.sub(D.mul(F(a), F(b)), D.mul(F(c), F(d))))).toBe(true);
      expect(ordered(n, h)).toBe(true);
    }
    expect(crossExpansion(3, 4, 6, 2, h)).toBe(0);
  });

  it("keep the exact value in a scale and in a sum, and the estimate keeps its bound", () => {
    const rnd = random(13);
    const [e, f, x, y, sum] = [new Float64Array(4), new Float64Array(4), new Float64Array(8), new Float64Array(8), new Float64Array(16)];
    for (let i = 0; i < C.RUNS; i++) {
      const [a, b, c] = [wide(rnd), wide(rnd), wide(rnd)];
      const d = (a * b) / c;
      const [p, q] = [wide(rnd), wide(rnd)];
      const m = crossExpansion(a, b, c, d, e);
      const n = crossExpansion(a, q, c, p, f);
      const scaledE = scaleExpansion(m, e, p, x);
      const scaledF = scaleExpansion(n, f, q, y);
      expect(same(value(scaledE, x), D.mul(value(m, e), F(p)))).toBe(true);
      expect(ordered(scaledE, x)).toBe(true);
      const total = sumExpansions(scaledE, x, scaledF, y, sum);
      const exact = D.add(value(scaledE, x), value(scaledF, y));
      expect(same(value(total, sum), exact)).toBe(true);
      expect(ordered(total, sum)).toBe(true);
      expect(expansionSign(total, sum)).toBe(D.sign(exact));
      const est = estimate(total, sum);
      expect(Math.sign(est) + 0).toBe(D.sign(exact));
      if (total > 0) {
        const error = magnitude(D.sub(F(est), exact));
        // |V - est| <= 17u |V|: the exact test of the bound of the TSDoc.
        expect(D.compare(error, D.mul(F(17 * U), magnitude(exact)))).toBeLessThanOrEqual(0);
      }
    }
  });

  it("give the sign 0 for no components", () => {
    const h = new Float64Array(1);
    expect(expansionSign(0, h)).toBe(0);
    expect(estimate(0, h)).toBe(0);
    expect(sumExpansions(0, h, 0, h, new Float64Array(1))).toBe(0);
    expect(scaleExpansion(0, h, 3, new Float64Array(1))).toBe(0);
  });
});

describe("the guard of the expansion stages", () => {
  it("accepts 0 and its range, and refuses all else", () => {
    expect(inExpansionRange(0)).toBe(true);
    expect(inExpansionRange(-0)).toBe(true);
    expect(inExpansionRange(EXPANSION_MIN)).toBe(true);
    expect(inExpansionRange(-EXPANSION_MAX)).toBe(true);
    expect(inExpansionRange(EXPANSION_MIN / 2)).toBe(false);
    expect(inExpansionRange(EXPANSION_MAX * 2)).toBe(false);
    expect(inExpansionRange(Number.MIN_VALUE)).toBe(false);
  });

  it("sends the tiny and huge scales to the exact stage, and their signs stay exact", () => {
    let refused = 0;
    for (const p of C.points("scale", 4, C.orientInput)) {
      if (!inGuard(p)) refused++;
      expect(orient2d(...p).sign).toBe(C.orientOracle(...p));
    }
    for (const p of C.points("scale", 5, C.incircleInput)) expect(incircle(...p).sign).toBe(C.incircleOracle(...p));
    expect(refused).toBeGreaterThan(C.RUNS / 2);
  });

  it("keeps the signs at the ends of the range", () => {
    const [t, h] = [EXPANSION_MIN, EXPANSION_MAX];
    expect(orientAdaptive(0, 0, t, 0, 0, t)).toBe(1);
    expect(orientAdaptive(0, 0, h, h, -h, -h)).toBe(0);
    expect(orientAdaptive(-h, -h, h, h, h, C.moveUlps(h, -1))).toBe(orient2dExact(-h, -h, h, h, h, C.moveUlps(h, -1)));
    expect(incircleAdaptive(0, 0, 2 * t, 0, 0, 2 * t, t, t)).toBe(1);
    expect(incircleAdaptive(-h, 0, h, 0, 0, h, 0, C.moveUlps(-h, 1))).toBe(incircleExact(-h, 0, h, 0, 0, h, 0, C.moveUlps(-h, 1)));
  });
});

describe("the adaptive stage of orient2d", () => {
  it.each(GUARDED)("gives the sign of the exact stage on the family %s", (family) => {
    for (const p of C.points(family, 6, C.orientInput)) {
      if (inGuard(p)) expect(orientAdaptive(...p), `orientAdaptive(${p.join(", ")})`).toBe(orient2dExact(...p));
    }
  });

  it("gives the sign of the exact stage and of the oracle at mixed scales near a line", () => {
    const rnd = random(14);
    for (let i = 0; i < C.RUNS; i++) {
      const p = mixedOrient(rnd);
      if (!inGuard(p)) continue;
      const s = orientAdaptive(...p);
      expect(s, `orientAdaptive(${p.join(", ")})`).toBe(orient2dExact(...p));
      expect(s).toBe(C.orientOracle(...p));
    }
  });

  it("gives the sign of the exact stage on points with a value of 0 and tails", () => {
    const rnd = random(15);
    let zeros = 0;
    for (let i = 0; i < C.RUNS; i++) {
      // Three points of the diagonal: the value is 0, and the differences of floats of far scales have tails.
      const [x, y, z] = [wide(rnd) * 2 ** 40, wide(rnd) * 2 ** -40, wide(rnd)];
      const exactZero: Six = [x, x, y, y, z, z];
      if (orient2dExact(...exactZero) === 0) zeros++;
      expect(orientAdaptive(...exactZero)).toBe(0);
      // One ulp on one coordinate gives a value far below stage C, so stage D must answer.
      const moved: Six = [...exactZero];
      const i = Math.floor(rnd() * 6);
      moved[i] = C.moveUlps(moved[i] as number, 1);
      expect(orientAdaptive(...moved), `orientAdaptive(${moved.join(", ")})`).toBe(orient2dExact(...moved));
      expect(orientAdaptive(...moved)).toBe(C.orientOracle(...moved));
    }
    expect(zeros).toBe(C.RUNS);
  });

  it("gives the sign of the exact stage and of the oracle at convergents, where stage C has only noise", () => {
    const rnd = random(19);
    let tiny = 0;
    for (let i = 0; i < C.RUNS; i++) {
      const p = convergentOrient(rnd);
      const [ax, ay, , , cx, cy] = p;
      const s = orientAdaptive(...p);
      expect(s, `orientAdaptive(${p.join(", ")})`).toBe(orient2dExact(...p));
      expect(s).toBe(C.orientOracle(...p));
      const value = D.sub(D.mul(F(ax), F(cy)), D.mul(F(ay), F(cx)));
      if (ratio(magnitude(value), Math.abs(ax * cy)) < U) tiny++;
    }
    // Most points must have a value below the roundoff of its terms, or this test does not reach stage D.
    expect(tiny).toBeGreaterThan(C.RUNS / 2);
  });

  it("keeps the error of stage B and stage C inside the stated bounds", () => {
    const rnd = random(16);
    const h = new Float64Array(4);
    let worstB = 0;
    let worstC = 0;
    const inputs = [...C.points("near", 7, C.orientInput), ...C.points("ties", 8, C.orientInput), ...Array.from({ length: C.RUNS }, () => mixedOrient(rnd))];
    for (const p of inputs.filter(inGuard)) {
      const [ax, ay, bx, by, cx, cy] = p;
      const [acx, bcx, acy, bcy] = [ax - cx, bx - cx, ay - cy, by - cy];
      const sum = Math.abs(acx * bcy) + Math.abs(acy * bcx);
      const exact = D.sub(D.mul(D.sub(F(ax), F(cx)), D.sub(F(by), F(cy))), D.mul(D.sub(F(ay), F(cy)), D.sub(F(bx), F(cx))));
      const stageB = value(crossExpansion(acx, bcy, acy, bcx, h), h);
      // Stage B: the error of the expansion, against the bound without the estimate.
      const errorB = magnitude(D.sub(exact, stageB));
      expect(D.compareBound(ORIENT_STAGE_B * sum, errorB)).toBeGreaterThanOrEqual(0);
      if (sum > 0) worstB = Math.max(worstB, ratio(errorB, ORIENT_STAGE_B * sum));

      const [t1, t2, t3, t4] = [twoDiffTail(ax, cx, acx), twoDiffTail(bx, cx, bcx), twoDiffTail(ay, cy, acy), twoDiffTail(by, cy, bcy)];
      const est = estimate(crossExpansion(acx, bcy, acy, bcx, h), h);
      const r = est + orientFirstOrder(acx, bcx, acy, bcy, t1, t2, t3, t4);
      const bound = ORIENT_STAGE_C * sum + RESULT_BOUND * Math.abs(r);
      const errorC = magnitude(D.sub(exact, F(r)));
      expect(D.compareBound(bound, errorC)).toBeGreaterThanOrEqual(0);
      if (bound > 0) worstC = Math.max(worstC, ratio(errorC, bound));
    }
    console.log(`orient2d: the largest error over its bound: stage B ${worstB.toFixed(4)}, stage C ${worstC.toFixed(4)}`);
    expect(worstB).toBeGreaterThan(0);
    expect(worstC).toBeGreaterThan(0);
  });
});

/** This function gives `x / bound` as a float, through logarithms. Each value has more bits and more range than a float. */
function ratio(x: D.Dyadic, bound: number): number {
  if (x.m === 0n) return 0;
  const bits = x.m.toString(2).length;
  const shift = Math.max(0, bits - 60);
  return 2 ** (Math.log2(Number(x.m >> BigInt(shift))) + x.e + shift - Math.log2(bound));
}

describe("the adaptive stage of incircle", () => {
  const check = (p: Eight): number => {
    const s = incircleAdaptive(...p);
    if (s === UNDECIDED) return 1;
    expect(s, `incircleAdaptive(${p.join(", ")})`).toBe(incircleExact(...p));
    return 0;
  };

  it.each(GUARDED)("gives the sign of the exact stage on the family %s, or no answer", (family) => {
    let open = 0;
    let count = 0;
    for (const p of C.points(family, 9, C.incircleInput)) {
      if (!inGuard(p)) continue;
      count++;
      open += check(p);
    }
    console.log(`incircleAdaptive ${family}: ${count - open} of ${count} decided`);
  });

  it("gives the sign of the exact stage and of the oracle on boxes with tails", () => {
    const rnd = random(17);
    let open = 0;
    for (let i = 0; i < C.RUNS; i++) {
      const p = mixedIncircle(rnd);
      if (!inGuard(p)) continue;
      open += check(p);
      expect(incircle(...p).sign).toBe(C.incircleOracle(...p));
    }
    console.log(`incircleAdaptive boxes: ${C.RUNS - open} of ${C.RUNS} decided`);
  });

  it("gives no answer for an exact 0 with tails, and the exact stage answers", () => {
    const [x0, y0, x1, y1] = [1.1, 2.3, 1e6 + 0.7, 3e6 + 0.9];
    const box: Eight = [x0, y0, x1, y0, x1, y1, x0, y1];
    expect(incircleExact(...box)).toBe(0);
    expect(incircleAdaptive(...box)).toBe(UNDECIDED);
    expect(incircle(...box)).toEqual({ sign: 0, stage: "exact" });
  });

  it("decides a repeated point in the slow path", () => {
    const [ax, ay, bx, by, dx, dy] = [0.1, 0.7, 1e6 + 0.3, 0.9, 5.3, 1e-3];
    expect(incircle(ax, ay, bx, by, ax, ay, dx, dy)).toEqual({ sign: 0, stage: "filter" });
    expect(incircle(ax, ay, ax, ay, bx, by, dx, dy).sign).toBe(0);
    expect(incircle(ax, ay, bx, by, bx, by, dx, dy).sign).toBe(0);
    expect(incircle(ax, ay, bx, by, dx, dy, ax, ay).sign).toBe(0);
    expect(incircle(bx, by, ax, ay, dx, dy, ax, ay).sign).toBe(0);
    expect(incircle(bx, by, dx, dy, ax, ay, ax, ay).sign).toBe(0);
    expect(C.incircleOracle(ax, ay, bx, by, ax, ay, dx, dy)).toBe(0);
  });

  it("keeps the error of stage B and stage C inside the stated bounds", () => {
    const rnd = random(18);
    const h = new Float64Array(INCIRCLE_COMPONENTS);
    let worstB = 0;
    let worstC = 0;
    const inputs = [...C.points("near", 10, C.incircleInput), ...C.points("ties", 11, C.incircleInput), ...Array.from({ length: C.RUNS }, () => mixedIncircle(rnd)), ...Array.from({ length: 20 * C.RUNS }, () => alignedIncircle(rnd))];
    for (const p of inputs.filter(inGuard)) {
      const [ax, ay, bx, by, cx, cy, dx, dy] = p;
      const [adx, bdx, cdx, ady, bdy, cdy] = [ax - dx, bx - dx, cx - dx, ay - dy, by - dy, cy - dy];
      const permanent = incirclePermanent(adx, bdx, cdx, ady, bdy, cdy);
      const n = incircleStageB(adx, bdx, cdx, ady, bdy, cdy, h);
      const stageB = value(n, h);
      expect(same(stageB, determinant(F(adx), F(ady), F(bdx), F(bdy), F(cdx), F(cdy)))).toBe(true);
      const [x, y] = [F(dx), F(dy)];
      const exact = determinant(D.sub(F(ax), x), D.sub(F(ay), y), D.sub(F(bx), x), D.sub(F(by), y), D.sub(F(cx), x), D.sub(F(cy), y));
      const errorB = magnitude(D.sub(exact, stageB));
      expect(D.compareBound(INCIRCLE_STAGE_B * permanent, errorB)).toBeGreaterThanOrEqual(0);
      if (permanent > 0) worstB = Math.max(worstB, ratio(errorB, INCIRCLE_STAGE_B * permanent));

      const tails = [twoDiffTail(ax, dx, adx), twoDiffTail(bx, dx, bdx), twoDiffTail(cx, dx, cdx), twoDiffTail(ay, dy, ady), twoDiffTail(by, dy, bdy), twoDiffTail(cy, dy, cdy)] as const;
      const r = estimate(n, h) + incircleFirstOrder(adx, bdx, cdx, ady, bdy, cdy, ...tails);
      const bound = INCIRCLE_STAGE_C * permanent + RESULT_BOUND * Math.abs(r);
      const errorC = magnitude(D.sub(exact, F(r)));
      expect(D.compareBound(bound, errorC)).toBeGreaterThanOrEqual(0);
      if (bound > 0) worstC = Math.max(worstC, ratio(errorC, bound));
    }
    console.log(`incircle: the largest error over its bound: stage B ${worstB.toFixed(4)}, stage C ${worstC.toFixed(4)}`);
    // The aligned points reach a third of the stated bound. So this test sees a bound of a quarter of the stated value.
    expect(worstB).toBeGreaterThan(0.3);
    expect(worstC).toBeGreaterThan(0);
  });

  it("states a bound of stage C below the bound of stage B", () => {
    expect(INCIRCLE_STAGE_C).toBeLessThan(INCIRCLE_STAGE_B);
    expect(ORIENT_STAGE_C).toBeLessThan(ORIENT_STAGE_B);
  });
});

/** The in-circle determinant of three rows, over dyadic numbers. */
function determinant(adx: D.Dyadic, ady: D.Dyadic, bdx: D.Dyadic, bdy: D.Dyadic, cdx: D.Dyadic, cdy: D.Dyadic): D.Dyadic {
  const lift = (u: D.Dyadic, v: D.Dyadic): D.Dyadic => D.add(D.mul(u, u), D.mul(v, v));
  const cross = (p: D.Dyadic, q: D.Dyadic, r: D.Dyadic, s: D.Dyadic): D.Dyadic => D.sub(D.mul(p, q), D.mul(r, s));
  return D.add(D.add(D.mul(lift(adx, ady), cross(bdx, cdy, cdx, bdy)), D.mul(lift(bdx, bdy), cross(cdx, ady, adx, cdy))), D.mul(lift(cdx, cdy), cross(adx, bdy, bdx, ady)));
}
