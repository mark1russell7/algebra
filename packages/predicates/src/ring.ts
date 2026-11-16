/**
 * The exact location of a point against polygon rings in the plane, with the even-odd rule. The rings can move by a
 * translation `t = (tx, ty)`, with no rounding. A test across the antimeridian is an example: it moves a polygon by 360
 * degrees. The test of one edge and a ray is for an index that examines only some edges of a ring.
 *
 * @packageDocumentation
 */
import { compareShifted, orient2dShiftedSign } from "./shifted.ts";
import { requireFinite } from "./sign.ts";

/** The location of a point against rings: in the interior, on an edge or a vertex, or in the exterior. */
export type PointLocation = "inside" | "boundary" | "outside";

/**
 * A polygon ring: a list of positions. Each position has `x` at index 0 and `y` at index 1, and the next values are
 * free. The ring closes from its last position to its first. A ring that repeats its first position at its end, as in
 * GeoJSON, is the same ring.
 */
export type PolygonRing = readonly (readonly number[])[];

/**
 * This type is the result of the test of one edge and the ray from a point to the east. The point is on the edge, the
 * edge crosses the ray, or the edge misses the ray.
 */
export type RayEdge = "boundary" | "crosses" | "misses";

/** The internal codes of the result of an edge test. */
const MISSES = 0;
const CROSSES = 1;
const BOUNDARY = 2;

/** This function gives `true` when the value `v` is in the range from `a + t` to `b + t`, in either order, with no rounding. */
function betweenMoved(v: number, a: number, b: number, t: number): boolean {
  return compareShifted(Math.min(a, b), t, v) <= 0 && compareShifted(Math.max(a, b), t, v) >= 0;
}

/**
 * This function is the one copy of the edge rule. It gives the code of the edge from `a` to `b` and the ray from the point
 * `(x, y)`, with the edge moved by `t`. The flags `aLow` and `bLow` tell if each end is at or below `y`. The values
 * `backX` and `backY` are `-tx` and `-ty`.
 */
function edgeCode(
  ax: number,
  ay: number,
  aLow: boolean,
  bx: number,
  by: number,
  bLow: boolean,
  x: number,
  y: number,
  tx: number,
  ty: number,
  backX: number,
  backY: number,
): number {
  // The half-open rule: an edge crosses the ray when one end is at or below y and the other end is above y.
  const crosses = aLow !== bLow;
  // A point on an edge that does not cross is in the box of the edge. The test of y comes first.
  if (crosses || (betweenMoved(y, ay, by, ty) && betweenMoved(x, ax, bx, tx))) {
    const sign = orient2dShiftedSign(ax, ay, bx, by, x, y, backX, backY);
    // A crossing edge is not horizontal. So a point on its line at the height y is in its box, and it is on the edge.
    if (sign === 0) return BOUNDARY;
    // The ray goes to the east. An upward edge is east of the point when the point is on its left side.
    if (crosses && (aLow ? sign > 0 : sign < 0)) return CROSSES;
  }
  return MISSES;
}

/**
 * This function gives the exact test of the edge from `a` to `b`, moved by `t = (tx, ty)`, and the ray from `(x, y)`
 * to the east. The result has no error, also when a float sum of a position and `t` rounds.
 *
 * The result is `"boundary"` when the point is on the moved edge. It is `"crosses"` when the edge crosses the ray
 * with the half-open rule. With this rule, one end is at or below `y`, the other end is above `y`, and the crossing
 * is east of the point. Each other edge gives `"misses"`. The order of the ends does not change the result.
 *
 * The rule is the rule of `locateInRings`. Thus a point that is not on the boundary is in a ring when an odd count of
 * its edges crosses the ray. An index can examine only the edges that have the height `y` in their range of y. Each
 * other edge misses.
 *
 * @param ax - The x of the end `a`.
 * @param ay - The y of the end `a`.
 * @param bx - The x of the end `b`.
 * @param by - The y of the end `b`.
 * @param x - The x of the point.
 * @param y - The y of the point.
 * @param tx - The move of the edge on the x axis. The default is 0.
 * @param ty - The move of the edge on the y axis. The default is 0.
 * @returns `"boundary"`, `"crosses"` or `"misses"`.
 * @throws RangeError - The function refuses a value that is not finite.
 */
export function rayEdge(ax: number, ay: number, bx: number, by: number, x: number, y: number, tx: number = 0, ty: number = 0): RayEdge {
  // A finite float times 0 is 0. An infinite float or NaN times 0 is NaN.
  if (ax * 0 + ay * 0 + bx * 0 + by * 0 + x * 0 + y * 0 + tx * 0 + ty * 0 !== 0) requireFinite([ax, ay, bx, by, x, y, tx, ty]);
  const aLow = compareShifted(ay, ty, y) <= 0;
  const bLow = compareShifted(by, ty, y) <= 0;
  const code = edgeCode(ax, ay, aLow, bx, by, bLow, x, y, tx, ty, 0 - tx, 0 - ty);
  return code === BOUNDARY ? "boundary" : code === CROSSES ? "crosses" : "misses";
}

/**
 * This function gives the exact location of the point `(x, y)` against the rings moved by `t = (tx, ty)`. The result
 * has no error: it is the location against the exact moved rings, also when a float sum of a position and `t` rounds.
 *
 * The rule is the even-odd rule over all rings. A point on an edge or a vertex of a ring is on the boundary. For a
 * polygon with holes in its exterior ring, a point in a hole is outside. Each edge goes from a position to the next
 * position, and the last edge goes back to the first position. The test moves the point by `-t` in place of the rings,
 * because a translation does not change an orientation. The test of each edge is the test of `rayEdge`.
 *
 * @param rings - The rings. Each position has `x` and `y` first.
 * @param x - The x of the point.
 * @param y - The y of the point.
 * @param tx - The move of the rings on the x axis. The default is 0.
 * @param ty - The move of the rings on the y axis. The default is 0.
 * @returns `"inside"`, `"boundary"` or `"outside"`.
 * @throws RangeError - The function refuses a position, a point or a move that is not finite.
 */
export function locateInRings(rings: readonly PolygonRing[], x: number, y: number, tx: number = 0, ty: number = 0): PointLocation {
  // A finite float times 0 is 0. An infinite float or NaN times 0 is NaN.
  if (x * 0 + y * 0 + tx * 0 + ty * 0 !== 0) requireFinite([x, y, tx, ty]);
  const backX = 0 - tx;
  const backY = 0 - ty;
  let inside = false;
  for (const ring of rings) {
    const count = ring.length;
    if (count === 0) continue;
    const last = ring[count - 1] as readonly number[];
    let ax = last[0] as number;
    let ay = last[1] as number;
    let aLow = compareShifted(ay, ty, y) <= 0;
    for (let index = 0; index < count; index += 1) {
      const b = ring[index] as readonly number[];
      const bx = b[0] as number;
      const by = b[1] as number;
      // Each position is the end b of one edge, so the loop examines each position one time.
      if (bx * 0 + by * 0 !== 0) requireFinite([bx, by]);
      const bLow = compareShifted(by, ty, y) <= 0;
      const code = edgeCode(ax, ay, aLow, bx, by, bLow, x, y, tx, ty, backX, backY);
      if (code === BOUNDARY) return "boundary";
      if (code === CROSSES) inside = !inside;
      ax = bx;
      ay = by;
      aLow = bLow;
    }
  }
  return inside ? "inside" : "outside";
}
