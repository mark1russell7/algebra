import { describe, expect, it } from "vitest";
import { random } from "@mark1russell7/expression";
import type { Random } from "@mark1russell7/expression";
import { dyadic as D, locateInRings, rayEdge } from "./index.ts";
import type { PointLocation, PolygonRing, RayEdge } from "./index.ts";
import { RUNS } from "./corpus.test-helper.ts";
import { fine, nextTo, shift, wide } from "./moved.test-helper.ts";

const F = D.fromFloat;

/** A case: the rings, the point and the move of the rings. */
interface Case {
  readonly rings: readonly PolygonRing[];
  readonly x: number;
  readonly y: number;
  readonly tx: number;
  readonly ty: number;
}

/**
 * The oracle of one edge: the half-open rule over dyadic numbers, on the point moved by `-t`. A crossing counts when
 * the x of the edge at the height of the point is east of the point. This test is not the orientation rule of the code.
 */
function edgeOracle(a: readonly number[], b: readonly number[], x: number, y: number, tx: number, ty: number): RayEdge {
  const qx = D.sub(F(x), F(tx));
  const qy = D.sub(F(y), F(ty));
  const [ax, ay, bx, by] = [F(a[0] as number), F(a[1] as number), F(b[0] as number), F(b[1] as number)];
  const cross = D.sign(D.sub(D.mul(D.sub(ax, qx), D.sub(by, qy)), D.mul(D.sub(ay, qy), D.sub(bx, qx))));
  const [cax, cbx, cay, cby] = [D.compare(ax, qx), D.compare(bx, qx), D.compare(ay, qy), D.compare(by, qy)];
  const inBox = Math.min(cax, cbx) <= 0 && Math.max(cax, cbx) >= 0 && Math.min(cay, cby) <= 0 && Math.max(cay, cby) >= 0;
  if (cross === 0 && inBox) return "boundary";
  if (cay <= 0 !== cby <= 0) {
    // The x of the edge at the height qy, less qx, times (by - ay).
    const east = D.add(D.mul(D.sub(ax, qx), D.sub(by, ay)), D.mul(D.sub(qy, ay), D.sub(bx, ax)));
    if (D.sign(east) * D.sign(D.sub(by, ay)) > 0) return "crosses";
  }
  return "misses";
}

/** The edges of the rings: each position and the next position, and the last position and the first. */
function* edgesOf(rings: readonly PolygonRing[]): Generator<readonly [readonly number[], readonly number[]]> {
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index++) yield [ring[index] as readonly number[], ring[(index + 1) % ring.length] as readonly number[]];
  }
}

/** The oracle: the even-odd rule over all edges, with the oracle of one edge. */
function locateOracle({ rings, x, y, tx, ty }: Case): PointLocation {
  let inside = false;
  for (const [a, b] of edgesOf(rings)) {
    const edge = edgeOracle(a, b, x, y, tx, ty);
    if (edge === "boundary") return "boundary";
    if (edge === "crosses") inside = !inside;
  }
  return inside ? "inside" : "outside";
}

/** The base: the float ray cast of the rounded moved rings, as in layout-contract. It has no boundary result. */
function floatRayCast({ rings, x, y, tx, ty }: Case): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [pi, pj] = [ring[i] as readonly number[], ring[j] as readonly number[]];
      const [xi, yi, xj, yj] = [(pi[0] as number) + tx, (pi[1] as number) + ty, (pj[0] as number) + tx, (pj[1] as number) + ty];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** The base of one edge: the float test of the rounded moved edge, as in the ray cast of layout-contract. */
function floatCrosses(a: readonly number[], b: readonly number[], { x, y, tx, ty }: Case): boolean {
  const [xi, yi, xj, yj] = [(a[0] as number) + tx, (a[1] as number) + ty, (b[0] as number) + tx, (b[1] as number) + ty];
  return yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
}

/** The ring with its first position again at its end, or without it when the ring has it. */
function toggleClosed(ring: PolygonRing): PolygonRing {
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (ring.length > 1 && first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return first === undefined ? ring : [...ring, first];
}

/** A star ring about the center, with 3 to 12 positions with fine values. */
function star(rnd: Random, cx: number, cy: number, size: number): number[][] {
  const count = 3 + Math.floor(rnd() * 10);
  const angles = Array.from({ length: count }, () => fine(rnd) * 2 * Math.PI).sort((p, q) => p - q);
  return angles.map((angle) => {
    const radius = size * (0.2 + fine(rnd));
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

/** A value on a grid of quarters. Its sum with a multiple of 360 has no rounding. */
const coarse = (rnd: Random, scale: number): number => Math.round(wide(rnd, scale) * 4) / 4;

/** A move across the antimeridian on the x axis, and sometimes a move with fine bits on the y axis. */
const move = (rnd: Random): readonly [number, number] => [shift(rnd), rnd() < 0.7 ? 0 : wide(rnd, 100)];

/** One of the values, at random. */
const pick = <T>(rnd: Random, values: readonly T[]): T => values[Math.floor(rnd() * values.length)] as T;

/**
 * The families: star rings with fine values, rectilinear rings with points on the edges and the vertices, points one
 * float step from a moved vertex or edge, and rings with holes. Each ring is open or closed at random.
 */
function draw(rnd: Random): Case {
  const family = Math.floor(rnd() * 4);
  const close = (rings: number[][][]): PolygonRing[] => rings.map((ring) => (rnd() < 0.5 ? toggleClosed(ring) : ring));
  if (family === 0) {
    const [cx, cy] = [wide(rnd, 400), wide(rnd, 200)];
    const [tx, ty] = move(rnd);
    return { rings: close([star(rnd, cx, cy, 40)]), x: cx + tx + wide(rnd, 120), y: cy + ty + wide(rnd, 120), tx, ty };
  }
  if (family === 1) {
    // An L shape on a grid of quarters. The point is often on an edge or a vertex, because it takes the same values.
    const [x0, xm, x1] = [coarse(rnd, 200), coarse(rnd, 200), coarse(rnd, 200)].sort((p, q) => p - q) as [number, number, number];
    const [y0, ym, y1] = [coarse(rnd, 200), coarse(rnd, 200), coarse(rnd, 200)].sort((p, q) => p - q) as [number, number, number];
    const ring = [[x0, y0], [x1, y0], [x1, ym], [xm, ym], [xm, y1], [x0, y1]];
    const tx = 360 * (Math.floor(rnd() * 5) - 2);
    const ty = rnd() < 0.7 ? 0 : coarse(rnd, 100);
    const px = pick(rnd, [x0, xm, x1, (x0 + x1) / 2, coarse(rnd, 200)]);
    const py = pick(rnd, [y0, ym, y1, (y0 + y1) / 2, coarse(rnd, 200)]);
    return { rings: close([ring]), x: px + tx, y: py + ty, tx, ty };
  }
  if (family === 2) {
    // A point at the float sum of a moved vertex or edge point, or one float step from it. The sums round.
    const [tx, ty] = move(rnd);
    const step = Math.floor(rnd() * 3) - 1;
    if (rnd() < 0.5) {
      // A box with fine values: the point is near its east edge, at a height in the middle of the edge.
      const [x0, x1] = [wide(rnd, 400), wide(rnd, 400)].sort((p, q) => p - q) as [number, number];
      const [y0, y1] = [wide(rnd, 200), wide(rnd, 200)].sort((p, q) => p - q) as [number, number];
      const ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      return { rings: close([ring]), x: nextTo(x1 + tx, step), y: (y0 + y1) / 2 + ty, tx, ty };
    }
    const ring = star(rnd, wide(rnd, 400), wide(rnd, 200), 40);
    const a = pick(rnd, ring) as number[];
    const b = ring[(ring.indexOf(a) + 1) % ring.length] as number[];
    const [px, py] = rnd() < 0.5 ? [a[0] as number, a[1] as number] : [((a[0] as number) + (b[0] as number)) / 2, ((a[1] as number) + (b[1] as number)) / 2];
    return { rings: close([ring]), x: nextTo(px + tx, step), y: py + ty, tx, ty };
  }
  // A square with one or two square holes.
  const [cx, cy] = [wide(rnd, 400), wide(rnd, 200)];
  const square = (x: number, y: number, half: number): number[][] => [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]];
  const holes = rnd() < 0.5 ? [square(cx - 10, cy, 4 + fine(rnd) * 4)] : [square(cx - 10, cy, 4 + fine(rnd) * 4), square(cx + 10, cy, 4 + fine(rnd) * 4)];
  const [tx, ty] = move(rnd);
  return { rings: close([square(cx, cy, 25), ...holes]), x: cx + tx + wide(rnd, 60), y: cy + ty + wide(rnd, 30), tx, ty };
}

// Two longitudes with a float sum with 360 that rounds, as in the tests of geo.
// UP + 360 rounds up to 290. DOWN + 360 rounds down to EDGE.
const UP = -70 - 2 ** -46;
const DOWN = -70 - 3 * 2 ** -46;
const EDGE = 290 - 2 ** -44;
// A ring with a notch: the edge x = EDGE goes from y = 10 to y = 20, and east of it, the notch is outside.
const NOTCH: PolygonRing = [[100, 10], [EDGE, 10], [EDGE, 20], [300, 20], [300, 30], [100, 30]];

describe("locateInRings", () => {
  it("is the even-odd rule on the exact moved rings, for open and closed rings", () => {
    const rnd = random(41);
    const seen: Record<PointLocation, number> = { inside: 0, boundary: 0, outside: 0 };
    // The base: the float ray cast of the rounded moved rings, on the points that are not on the boundary.
    let floatWrong = 0;
    let disagree = 0;
    let openClosedDiffer = 0;
    for (let i = 0; i < RUNS; i++) {
      const c = draw(rnd);
      const expected = locateOracle(c);
      const found = locateInRings(c.rings, c.x, c.y, c.tx, c.ty);
      if (found !== expected) disagree += 1;
      if (locateInRings(c.rings.map(toggleClosed), c.x, c.y, c.tx, c.ty) !== found) openClosedDiffer += 1;
      if (expected !== "boundary" && floatRayCast(c) !== (expected === "inside")) floatWrong += 1;
      seen[expected] += 1;
    }
    console.log(`A28 rings: ${RUNS} cases, ${JSON.stringify(seen)}, disagreements ${disagree}, open and closed differ ${openClosedDiffer}, float ray cast wrong ${floatWrong}`);
    expect(disagree).toBe(0);
    expect(openClosedDiffer).toBe(0);
    expect(floatWrong).toBeGreaterThan(0);
    for (const where of ["inside", "boundary", "outside"] as const) expect(seen[where], where).toBeGreaterThan(0);
  });

  it("is exact when the float sum of a position and the move rounds", () => {
    expect(UP + 360).toBe(290);
    expect(DOWN + 360).toBe(EDGE);
    const box: PolygonRing = [[100, 10], [290, 10], [290, 30], [100, 30]];
    // Moved by -360, the east edge is x = -70, and UP is west of it. The float sum UP + 360 is on that edge.
    expect(locateInRings([box], UP, 20, -360)).toBe("inside");
    // Moved by -360, the edge of the notch is x = EDGE - 360, and DOWN is east of it, in the notch.
    expect(locateInRings([NOTCH], DOWN, 15, -360)).toBe("outside");
    expect(locateInRings([NOTCH], EDGE - 360, 15, -360)).toBe("boundary");
    // The move on the y axis is exact too: the bottom edge moves to y = 0.1 + 360, which is not a float.
    const flat: PolygonRing = [[0, 0.1], [10, 0.1], [10, 1], [0, 1]];
    const low = 0.1 + 360;
    const order = D.compare(F(low), D.add(F(0.1), F(360)));
    expect(order).not.toBe(0);
    const below = order < 0;
    expect(locateInRings([flat], 5, low, 0, 360)).toBe(below ? "outside" : "inside");
  });

  it("gives a hole as outside and its edges as the boundary", () => {
    const outer: PolygonRing = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole: PolygonRing = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    expect(locateInRings([outer, hole], 2, 2)).toBe("inside");
    expect(locateInRings([outer, hole], 5, 5)).toBe("outside");
    expect(locateInRings([outer, hole], 6, 5)).toBe("boundary");
    expect(locateInRings([outer, hole], 4, 4)).toBe("boundary");
    expect(locateInRings([outer, hole], 10, 3)).toBe("boundary");
    expect(locateInRings([outer, hole], 11, 3)).toBe("outside");
    expect(locateInRings([outer, hole], 5 + 360, 5, 360)).toBe("outside");
    expect(locateInRings([outer, hole], 2 + 360, 2, 360, 0)).toBe(locateInRings([outer, hole], 2, 2));
  });

  it("gives outside for no ring and for empty rings", () => {
    expect(locateInRings([], 0, 0)).toBe("outside");
    expect(locateInRings([[]], 0, 0)).toBe("outside");
    expect(locateInRings([[[1, 1]]], 1, 1)).toBe("boundary");
  });

  it("refuses a value that is not finite", () => {
    const ring: PolygonRing = [[0, 0], [1, 0], [0, 1]];
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => locateInRings([ring], bad, 0)).toThrow(RangeError);
      expect(() => locateInRings([ring], 0, bad)).toThrow(RangeError);
      expect(() => locateInRings([ring], 0, 0, bad)).toThrow(RangeError);
      expect(() => locateInRings([ring], 0, 0, 0, bad)).toThrow(RangeError);
      expect(() => locateInRings([[[0, 0], [bad, 0], [0, 1]]], 0.25, 0.25)).toThrow(RangeError);
      // The edges of this position are far from the point, and the function still refuses it.
      expect(() => locateInRings([[[0, 0], [1, 0], [1, 1], [bad, 50]]], 0.5, 0.25)).toThrow(RangeError);
      expect(() => locateInRings([[[0, 0], [1, 0], [1, 1], [0]]], 0.5, 0.25)).toThrow(RangeError);
    }
  });
});

type EdgeArgs = [number, number, number, number, number, number, number, number];

describe("rayEdge", () => {
  it("is the exact test of one moved edge, in both directions, and its fold is locateInRings", () => {
    const rnd = random(43);
    const seen: Record<RayEdge, number> = { boundary: 0, crosses: 0, misses: 0 };
    let edges = 0;
    let disagree = 0;
    let asymmetric = 0;
    let foldDiffers = 0;
    // The base: the float test of the rounded moved edge, on the edges that are not on the boundary.
    let floatWrong = 0;
    for (let i = 0; i < RUNS; i++) {
      const c = draw(rnd);
      let inside = false;
      let boundary = false;
      for (const [a, b] of edgesOf(c.rings)) {
        const [ax, ay, bx, by] = [a[0] as number, a[1] as number, b[0] as number, b[1] as number];
        const found = rayEdge(ax, ay, bx, by, c.x, c.y, c.tx, c.ty);
        const expected = edgeOracle(a, b, c.x, c.y, c.tx, c.ty);
        edges += 1;
        seen[expected] += 1;
        if (found !== expected) disagree += 1;
        if (rayEdge(bx, by, ax, ay, c.x, c.y, c.tx, c.ty) !== found) asymmetric += 1;
        if (expected !== "boundary" && floatCrosses(a, b, c) !== (expected === "crosses")) floatWrong += 1;
        if (found === "boundary") boundary = true;
        if (found === "crosses") inside = !inside;
      }
      const fold: PointLocation = boundary ? "boundary" : inside ? "inside" : "outside";
      if (fold !== locateInRings(c.rings, c.x, c.y, c.tx, c.ty)) foldDiffers += 1;
    }
    console.log(`A29 edges: ${RUNS} cases, ${edges} edges, ${JSON.stringify(seen)}, disagreements ${disagree}, asymmetric ${asymmetric}, fold differs ${foldDiffers}, float test wrong ${floatWrong}`);
    expect(disagree).toBe(0);
    expect(asymmetric).toBe(0);
    expect(foldDiffers).toBe(0);
    expect(floatWrong).toBeGreaterThan(0);
    for (const result of ["boundary", "crosses", "misses"] as const) expect(seen[result], result).toBeGreaterThan(0);
  });

  it("follows the half-open rule at a vertex and on a horizontal edge", () => {
    // Each test uses the ray from the point to the east.
    expect(rayEdge(2, 0, 2, 10, 0, 5)).toBe("crosses");
    expect(rayEdge(-2, 0, -2, 10, 0, 5)).toBe("misses");
    // An end at the height of the point is below it for the rule. So only the edge that goes above it crosses.
    expect(rayEdge(2, 5, 2, 10, 0, 5)).toBe("crosses");
    expect(rayEdge(2, 0, 2, 5, 0, 5)).toBe("misses");
    // A horizontal edge at the height of the point does not cross. The point is on it, or it misses.
    expect(rayEdge(2, 5, 8, 5, 0, 5)).toBe("misses");
    expect(rayEdge(-2, 5, 8, 5, 0, 5)).toBe("boundary");
    expect(rayEdge(0, 0, 4, 10, 2, 5)).toBe("boundary");
    expect(rayEdge(0, 5, 0, 5, 0, 5)).toBe("boundary");
  });

  it("is exact when the float sum of an end and the move rounds", () => {
    // Moved by -360, the edge x = 290 is x = -70, and UP is west of it. The float sum UP + 360 is on the edge.
    expect(rayEdge(290, 10, 290, 30, UP, 20, -360)).toBe("crosses");
    // Moved by -360, the edge x = EDGE is west of DOWN.
    expect(rayEdge(EDGE, 10, EDGE, 20, DOWN, 15, -360)).toBe("misses");
    expect(rayEdge(EDGE, 10, EDGE, 20, EDGE - 360, 15, -360)).toBe("boundary");
    // The move on the y axis is exact too: the low end moves to y = 0.1 + 360, which is not a float.
    const low = 0.1 + 360;
    const below = D.compare(F(low), D.add(F(0.1), F(360))) < 0;
    expect(rayEdge(0, 0.1, 10, 0.1, 5, low, 0, 360)).toBe("misses");
    expect(rayEdge(10, 0.1, 10, 1, 5, low, 0, 360)).toBe(below ? "misses" : "crosses");
  });

  it("refuses a value that is not finite", () => {
    const good: EdgeArgs = [0, 0, 1, 1, 0.25, 0.5, 0, 0];
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (let index = 0; index < good.length; index++) {
        const values = good.map((value, at) => (at === index ? bad : value)) as EdgeArgs;
        expect(() => rayEdge(...values), `index ${index}`).toThrow(RangeError);
      }
    }
    expect(rayEdge(...good)).toBe("crosses");
  });
});
