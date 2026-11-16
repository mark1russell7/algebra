/**
 * The exact location of a point against polygon rings in the plane, with the even-odd rule. The rings can move by a
 * translation `t = (tx, ty)`, with no rounding. A test across the antimeridian is an example: it moves a polygon by 360
 * degrees.
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

/** This function gives `true` when the value `v` is in the range from `a + t` to `b + t`, in either order, with no rounding. */
function betweenMoved(v: number, a: number, b: number, t: number): boolean {
  return compareShifted(Math.min(a, b), t, v) <= 0 && compareShifted(Math.max(a, b), t, v) >= 0;
}

/**
 * This function gives the exact location of the point `(x, y)` against the rings moved by `t = (tx, ty)`. The result
 * has no error: it is the location against the exact moved rings, also when a float sum of a position and `t` rounds.
 *
 * The rule is the even-odd rule over all rings. A point on an edge or a vertex of a ring is on the boundary. For a
 * polygon with holes in its exterior ring, a point in a hole is outside. Each edge goes from a position to the next
 * position, and the last edge goes back to the first position. The test moves the point by `-t` in place of the rings,
 * because a translation does not change an orientation.
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
    // The half-open rule: an edge crosses the ray when one end is at or below y and the other end is above y.
    let aLow = compareShifted(ay, ty, y) <= 0;
    for (let index = 0; index < count; index += 1) {
      const b = ring[index] as readonly number[];
      const bx = b[0] as number;
      const by = b[1] as number;
      // Each position is the end b of one edge, so the loop examines each position one time.
      if (bx * 0 + by * 0 !== 0) requireFinite([bx, by]);
      const bLow = compareShifted(by, ty, y) <= 0;
      const crosses = aLow !== bLow;
      // A point on an edge that does not cross is in the box of the edge. The test of y comes first.
      if (crosses || (betweenMoved(y, ay, by, ty) && betweenMoved(x, ax, bx, tx))) {
        const sign = orient2dShiftedSign(ax, ay, bx, by, x, y, backX, backY);
        // A crossing edge is not horizontal. So a point on its line at the height y is in its box, and it is on the edge.
        if (sign === 0) return "boundary";
        // The ray goes to the east. An upward edge is east of the point when the point is on its left side.
        if (crosses && (aLow ? sign > 0 : sign < 0)) inside = !inside;
      }
      ax = bx;
      ay = by;
      aLow = bLow;
    }
  }
  return inside ? "inside" : "outside";
}
