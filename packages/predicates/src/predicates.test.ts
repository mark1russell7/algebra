import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { incircle as rpIncircle, orient2d as rpOrient2d } from "robust-predicates";
import { random } from "@mark1russell7/expression";
import {
  dyadic as D,
  INCIRCLE_BOUND,
  incircle,
  incircleExact,
  incircleSign,
  ORIENT_BOUND,
  orient2d,
  orient2dExact,
  orient2dSign,
  classifySegments,
  UNDERFLOW_TERM,
} from "./index.ts";
import type { SegmentRelation, Sign } from "./index.ts";
import * as C from "./corpus.test-helper.ts";
import type { Eight, Family, Six } from "./corpus.test-helper.ts";

const sign = (x: number): Sign => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** The agreement corpus: each family but `scale`, where the float stage of robust-predicates can underflow. */
const AGREEMENT: readonly Family[] = ["random", "grid", "near", "ties"];

/** The segment rule of this package, built on the orientation of robust-predicates. Its sign convention is the negative one. */
function rpSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): SegmentRelation {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number): Sign => sign(-rpOrient2d(px, py, qx, qy, rx, ry));
  const [o1, o2, o3, o4] = [o(ax, ay, bx, by, cx, cy), o(ax, ay, bx, by, dx, dy), o(cx, cy, dx, dy, ax, ay), o(cx, cy, dx, dy, bx, by)];
  if (o1 * o2 > 0 || o3 * o4 > 0) return "disjoint";
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return classifySegments(ax, ay, bx, by, cx, cy, dx, dy).relation;
  return o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0 ? "touch" : "cross";
}

describe("the constants", () => {
  it("are the bounds of Shewchuk with a larger second term", () => {
    const u = 2 ** -53;
    expect(ORIENT_BOUND).toBeGreaterThan((3 + 16 * u) * u);
    expect(INCIRCLE_BOUND).toBeGreaterThan((10 + 96 * u) * u);
    expect(UNDERFLOW_TERM).toBe(32 * Number.MIN_VALUE);
  });
});

describe("orient2d", () => {
  it("gives the counterclockwise sign of Shewchuk", () => {
    expect(orient2d(0, 0, 1, 0, 0, 1)).toEqual({ sign: 1, stage: "filter" });
    expect(orient2d(0, 0, 0, 1, 1, 0)).toEqual({ sign: -1, stage: "filter" });
    expect(orient2d(0, 0, 1, 1, 2, 2)).toEqual({ sign: 0, stage: "exact" });
    expect(orient2d(1, 2, 1, 2, 5, 7)).toEqual({ sign: 0, stage: "filter" });
    expect(orient2d(0, 3, 1, 3, 9, 3)).toEqual({ sign: 0, stage: "filter" });
  });

  it("decides the classic near-diagonal points of 0.5 exactly", () => {
    const x = 0.5 + 2 ** -53;
    expect(orient2d(x, 0.5, 12, 12, 24, 24)).toEqual({ sign: orientOracle6([x, 0.5, 12, 12, 24, 24]), stage: "exact" });
  });

  it("decides the subnormal points that underflow the float products", () => {
    // Each product is below 2^-1075 and rounds to 0, but the exact sign is not 0.
    const t = 2 ** -540;
    expect(orient2d(0, 0, t, 0, 0, t).sign).toBe(1);
    expect(orient2d(0, 0, t, 0, 0, t).stage).toBe("exact");
    expect(orient2dSign(0, 0, Number.MIN_VALUE, 0, 0, Number.MIN_VALUE)).toBe(1);
  });

  it("refuses an input that is not finite", () => {
    expect(() => orient2d(Number.NaN, 0, 1, 0, 0, 1)).toThrow(RangeError);
    expect(() => orient2d(Infinity, 0, 1, 0, 0, 1)).toThrow(RangeError);
    expect(() => orient2dSign(1, 2, 1, 2, Infinity, 7)).toThrow(RangeError);
  });

  it.each(C.FAMILIES)("gives the exact sign of the rational oracle on the family %s", (family) => {
    let exact = 0;
    for (const p of C.points(family, 1, C.orientInput)) {
      const r = orient2d(...p);
      expect(r.sign, `orient2d(${p.join(", ")})`).toBe(orientOracle6(p));
      expect(orient2dSign(...p)).toBe(r.sign);
      expect(orient2dExact(...p)).toBe(r.sign);
      if (r.stage === "exact") exact++;
    }
    console.log(`orient2d ${family}: ${C.RUNS - exact} of ${C.RUNS} decided by the filter`);
  });

  it.each(AGREEMENT)("agrees with robust-predicates on the family %s", (family) => {
    for (const p of C.points(family, 1, C.orientInput)) expect(orient2dSign(...p), `orient2d(${p.join(", ")})`).toBe(sign(-rpOrient2d(...p)));
  });
});

const orientOracle6 = (p: Six): Sign => C.orientOracle(...p);

describe("incircle", () => {
  it("gives the sign of Shewchuk: positive inside a counterclockwise circle", () => {
    expect(incircle(0, 0, 2, 0, 0, 2, 1, 1)).toEqual({ sign: 1, stage: "filter" });
    expect(incircle(0, 0, 2, 0, 0, 2, 5, 5)).toEqual({ sign: -1, stage: "filter" });
    expect(incircle(0, 0, 0, 2, 2, 0, 1, 1).sign).toBe(-1);
    expect(incircle(0, 0, 1, 0, 1, 1, 0, 1)).toEqual({ sign: 0, stage: "exact" });
  });

  it("refuses an input that is not finite", () => {
    expect(() => incircle(0, 0, 2, 0, 0, 2, Number.NaN, 1)).toThrow(RangeError);
    expect(() => incircleSign(0, 0, 2, 0, 0, -Infinity, 1, 1)).toThrow(RangeError);
  });

  it.each(C.FAMILIES)("gives the exact sign of the rational oracle on the family %s", (family) => {
    let exact = 0;
    for (const p of C.points(family, 2, C.incircleInput)) {
      const r = incircle(...p);
      expect(r.sign, `incircle(${p.join(", ")})`).toBe(C.incircleOracle(...p));
      expect(incircleSign(...p)).toBe(r.sign);
      expect(incircleExact(...p)).toBe(r.sign);
      if (r.stage === "exact") exact++;
    }
    console.log(`incircle ${family}: ${C.RUNS - exact} of ${C.RUNS} decided by the filter`);
  });

  it.each(AGREEMENT)("agrees with robust-predicates on the family %s", (family) => {
    for (const p of C.points(family, 2, C.incircleInput)) expect(incircleSign(...p), `incircle(${p.join(", ")})`).toBe(sign(rpIncircle(...p)));
  });
});

describe("classifySegments", () => {
  const rel = (...p: Eight): string => {
    const r = classifySegments(...p);
    return `${r.relation}${r.collinear ? " collinear" : ""}`;
  };

  it("gives the touch and the collinear cases as explicit answers", () => {
    expect(rel(0, 0, 2, 2, 0, 2, 2, 0)).toBe("cross");
    expect(rel(0, 0, 2, 0, 1, 0, 1, 5)).toBe("touch");
    expect(rel(0, 0, 2, 0, 2, 0, 3, 3)).toBe("touch");
    expect(rel(0, 0, 2, 0, 3, 0, 3, 3)).toBe("disjoint");
    expect(rel(0, 0, 2, 0, 1, 0, 3, 0)).toBe("overlap collinear");
    expect(rel(0, 0, 2, 0, 2, 0, 3, 0)).toBe("touch collinear");
    expect(rel(0, 0, 2, 0, 3, 0, 4, 0)).toBe("disjoint collinear");
    expect(rel(1, 1, 1, 1, 0, 0, 2, 2)).toBe("touch collinear");
    expect(rel(1, 1, 1, 1, 1, 1, 1, 1)).toBe("touch collinear");
    expect(rel(1, 1, 1, 1, 0, 0, 2, 0)).toBe("disjoint");
    expect(classifySegments(0, 0, 2, 2, 0, 2, 2, 0).stage).toBe("filter");
  });

  it.each(C.FAMILIES)("gives the relation of the rational oracle on the family %s", (family) => {
    let exact = 0;
    const seen = new Set<string>();
    for (const p of C.points(family, 3, C.segmentInput)) {
      const r = classifySegments(...p);
      const o = C.segmentOracle(...p);
      expect({ relation: r.relation, collinear: r.collinear }, `classifySegments(${p.join(", ")})`).toEqual(o);
      seen.add(r.relation);
      if (r.stage === "exact") exact++;
    }
    console.log(`classifySegments ${family}: ${C.RUNS - exact} of ${C.RUNS} decided by the filter, relations ${[...seen].sort().join(", ")}`);
  });

  it.each(AGREEMENT)("agrees with the same rule on robust-predicates on the family %s", (family) => {
    for (const p of C.points(family, 3, C.segmentInput)) expect(classifySegments(...p).relation, `segment(${p.join(", ")})`).toBe(rpSegment(...p));
  });
});

describe("the 42 real records of the A13 census", () => {
  // The site keeps the records in packages/site/data/near-misses.json.
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site/data/near-misses.json");
  const records = (JSON.parse(fs.readFileSync(file, "utf8")) as { records: C.NearMiss[] }).records;
  const v = (x: unknown): [number, number] => x as [number, number];

  it("are 42: 33 segment pairs, 6 segment-box tests and 3 point sides", () => {
    expect(records).toHaveLength(42);
    expect(records.filter((r) => r.predicate === "segmentPair")).toHaveLength(33);
  });

  it("get the exact answer of the census", () => {
    for (const r of records) {
      if (r.predicate === "segmentPair") {
        const [a, b, c, d] = [v(r.input["a"]), v(r.input["b"]), v(r.input["c"]), v(r.input["d"])];
        const s = classifySegments(...a, ...b, ...c, ...d);
        // geom.segmentsCross and routes.segmentsCrossInside are proper crossings: a touch is not a crossing.
        expect(s.relation === "cross", `${r.fn} ${JSON.stringify(r.input)}`).toBe(r.exactAnswer);
        expect(s).toEqual({ ...C.segmentOracle(...a, ...b, ...c, ...d), stage: s.stage });
      } else if (r.predicate === "pointSide") {
        const [p, a, b] = [v(r.input["p"]), v(r.input["a"]), v(r.input["b"])];
        // physics.outOf gives 1 for a positive sign and -1 for a zero or a negative sign.
        const s = orient2dSign(...a, ...b, ...p);
        expect(s > 0 ? 1 : -1).toBe(r.exactAnswer);
        expect(s).toBe(C.orientOracle(...a, ...b, ...p));
      } else {
        // The segment-box records: the orientation of the segment against each corner of the box.
        const [a, b] = [v(r.input["a"]), v(r.input["b"])];
        const box = r.input["box"] as { x: number; y: number; w: number; h: number };
        for (const [x, y] of [
          [box.x, box.y],
          [box.x + box.w, box.y],
          [box.x, box.y + box.h],
          [box.x + box.w, box.y + box.h],
        ] as const) {
          expect(orient2dSign(...a, ...b, x, y)).toBe(C.orientOracle(...a, ...b, x, y));
        }
      }
    }
  });
});

describe("the share that the filter decides", () => {
  const COUNT = 100_000;
  it.each([
    ["orient2d", (rnd: () => number) => orient2d(...C.orientInput("random", rnd)).stage],
    ["incircle", (rnd: () => number) => incircle(...C.incircleInput("random", rnd)).stage],
    ["classifySegments", (rnd: () => number) => classifySegments(...C.segmentInput("random", rnd)).stage],
  ] as const)("is at least 0.999 of %s on 100 000 random points", (name, stage) => {
    const rnd = random(2026);
    let filter = 0;
    for (let i = 0; i < COUNT; i++) if (stage(rnd) === "filter") filter++;
    console.log(`filter share ${name} random: ${filter} of ${COUNT} = ${(filter / COUNT).toFixed(6)}`);
    expect(filter / COUNT).toBeGreaterThanOrEqual(0.999);
  });
});

describe("the dyadic numbers", () => {
  it("are the exact values of the floats", () => {
    expect(D.fromFloat(5e-324)).toEqual({ m: 1n, e: -1074 });
    expect(D.sign(D.sub(D.fromFloat(0.1), D.fromFloat(0.1)))).toBe(0);
    expect(() => D.fromFloat(Infinity)).toThrow(RangeError);
  });
});

describe("robust-predicates on the family scale", () => {
  it("gives wrong signs where its float stage underflows or overflows, and this package does not", () => {
    let orientWrong = 0;
    let incircleWrong = 0;
    for (const p of C.points("scale", 1, C.orientInput)) if (sign(-rpOrient2d(...p)) !== C.orientOracle(...p)) orientWrong++;
    for (const p of C.points("scale", 2, C.incircleInput)) if (sign(rpIncircle(...p)) !== C.incircleOracle(...p)) incircleWrong++;
    console.log(`robust-predicates wrong on the family scale: orient2d ${orientWrong} of ${C.RUNS}, incircle ${incircleWrong} of ${C.RUNS}`);
    expect(orientWrong).toBeGreaterThan(0);
    expect(incircleWrong).toBeGreaterThan(0);
  });
});
