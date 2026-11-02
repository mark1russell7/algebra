import { random } from "@mark1russell7/expression";
import { describe, expect, it } from "vitest";
import { segmentPair } from "./predicates.ts";
import * as O from "./oracle.test-helper.ts";

const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 1000);
const orient = segmentPair.signs[0];
if (orient === undefined) throw new Error("segmentPair has no orientation sign");

type V = [number, number];

/** A random triple: a uniform one, a near-collinear one, one on a grid of tenths, or one far from the origin. */
function triple(rnd: () => number): [V, V, V] {
  const k = Math.floor(rnd() * 4);
  const u = (): V => [rnd() * 2 - 1, rnd() * 2 - 1];
  if (k === 0) return [u(), u(), u()];
  if (k === 1) {
    const [p, q] = [u(), u()];
    const t = rnd() * 3 - 1;
    return [p, q, [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]];
  }
  if (k === 2) {
    const g = (): V => [Math.floor(rnd() * 21 - 10) / 10, Math.floor(rnd() * 21 - 10) / 10];
    return [g(), g(), g()];
  }
  const far = (): V => [1e6 + rnd() * 1000, 2e6 + rnd() * 1000];
  return [far(), far(), far()];
}

describe("the orientation sign (property)", () => {
  it("agrees with the exact sign each time that the bound decides it", () => {
    const rnd = random(42);
    let decided = 0;
    let undecided = 0;
    for (let i = 0; i < RUNS; i++) {
      const [p, q, r] = triple(rnd);
      const point = { ax: p[0], ay: p[1], bx: q[0], by: q[1], cx: r[0], cy: r[1] };
      const bounds = orient.bounds(point);
      const lo = bounds?.[0] ?? -Infinity;
      const hi = bounds?.[1] ?? Infinity;
      const [px, py, qx, qy, rx, ry] = [p[0], p[1], q[0], q[1], r[0], r[1]].map(O.fromFloat) as [O.Rat, O.Rat, O.Rat, O.Rat, O.Rat, O.Rat];
      const value = O.sub(O.mul(O.sub(qx, px), O.sub(ry, py)), O.mul(O.sub(qy, py), O.sub(rx, px)));
      const exact = O.sign(value);
      expect(exact).toBe(O.orient(p, q, r));
      // The bound contains the exact value: this confirms the bound itself, not only its sign.
      if (Number.isFinite(lo)) expect(O.cmp(O.fromFloat(lo), value)).toBeLessThanOrEqual(0);
      if (Number.isFinite(hi)) expect(O.cmp(O.fromFloat(hi), value)).toBeGreaterThanOrEqual(0);
      if (lo > 0 || hi < 0 || (lo === 0 && hi === 0)) {
        decided++;
        expect([p, q, r, exact]).toEqual([p, q, r, lo > 0 ? 1 : hi < 0 ? -1 : 0]);
      } else {
        undecided++;
      }
    }
    expect(decided).toBeGreaterThan(RUNS / 2);
    expect(undecided).toBeGreaterThan(0);
  });
});
