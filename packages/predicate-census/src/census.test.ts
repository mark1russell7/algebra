import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { censusOfFiles, classify, containerPoint, containerPredicate, edgePair, edgePairPoint, PACKING_UNMODELED, parseLine, Tally } from "./index.ts";
import type { Census, Group, Predicate } from "./index.ts";
import { boxPairPoint, PREDICATES, pointSidePoint, segmentBoxPoint, segmentPairPoint, segmentRect, segmentRectPoint } from "./predicates.ts";
import type { Point } from "./expressions.ts";
import * as O from "./oracle.test-helper.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const synthetic = path.join(here, "../corpus/synthetic");

interface Planted {
  readonly id: string;
  readonly n?: number;
  readonly expect: {
    readonly undecided: boolean;
    readonly undecidedFiltered?: boolean;
    readonly exact: boolean | number;
    readonly floatWrong: boolean;
    readonly floatCompared?: boolean;
    readonly nearCollinear?: boolean;
    readonly sharedVertex?: boolean;
  };
  readonly [k: string]: unknown;
}

function planted(): Planted[] {
  const out: Planted[] = [];
  for (const name of fs.readdirSync(synthetic).sort()) {
    for (const text of fs.readFileSync(path.join(synthetic, name), "utf8").split(/\r?\n/)) {
      if (text.trim() === "") continue;
      const o = JSON.parse(text) as Planted;
      if (o.expect !== undefined) out.push(o);
    }
  }
  return out;
}

type V = readonly [number, number];
type B = { x: number; y: number; w: number; h: number };
type R = readonly [number, number, number, number];

/** The exact answer of the oracle, which does not use the code of the package. */
function oracle(o: Planted): boolean | number {
  const eps = (o["eps"] as number | undefined) ?? 0;
  if ("c" in o) return O.crosses(o["a"] as V, o["b"] as V, o["c"] as V, o["d"] as V);
  if ("box" in o) return O.hitsBox(o["a"] as V, o["b"] as V, o["box"] as B, eps);
  if ("rect" in o) return O.hitsRect(o["a"] as V, o["b"] as V, o["rect"] as R, eps);
  if ("p" in o) return O.orient(o["a"] as V, o["b"] as V, o["p"] as V);
  return O.overlaps(o["a"] as B, o["b"] as B, eps);
}

function pointOf(o: Planted): { predicate: Predicate; point: Point; given: unknown } {
  const line = parseLine(o);
  switch (line.form) {
    case "segmentPair":
      return { predicate: PREDICATES.segmentPair, point: segmentPairPoint(line.line.a, line.line.b, line.line.c, line.line.d), given: line.line.floatAnswer };
    case "segmentBox":
      return { predicate: PREDICATES.segmentBox, point: segmentBoxPoint(line.line.a, line.line.b, line.line.box, line.line.eps), given: line.line.floatAnswer };
    case "segmentRect":
      return { predicate: segmentRect, point: segmentRectPoint(line.line.a, line.line.b, line.line.rect, line.line.eps), given: line.line.floatAnswer };
    case "pointSide":
      return { predicate: PREDICATES.pointSide, point: pointSidePoint(line.line.p, line.line.a, line.line.b), given: line.line.floatAnswer };
    case "boxPair":
      return { predicate: PREDICATES.boxPair, point: boxPairPoint(line.line.a, line.line.b, line.line.eps), given: line.line.floatAnswer };
    default:
      throw new Error(`no form: ${o.id}`);
  }
}

const weight = (os: readonly Planted[]): number => os.reduce((k, o) => k + (o.n ?? 1), 0);
const sum = (gs: readonly Group[], f: (g: Group) => number): number => gs.reduce((k, g) => k + f(g), 0);
const ofCase = (r: Census, c: string): Group[] => r.groups.filter((g) => g.case === c);

describe("the census of the synthetic corpus", () => {
  const report = censusOfFiles([synthetic], here);
  const lines = planted();
  const ids = (xs: readonly Planted[]): string[] => xs.map((o) => o.id).sort();

  it("has planted inputs of each kind", () => {
    expect(lines.filter((o) => o.expect.undecided).length).toBeGreaterThanOrEqual(8);
    expect(lines.filter((o) => !o.expect.undecided).length).toBeGreaterThanOrEqual(8);
    expect(lines.filter((o) => o.expect.floatWrong).length).toBeGreaterThanOrEqual(4);
  });

  it("reports exactly the planted undecided inputs", () => {
    const reported = report.records.filter((r) => r.undecided).map((r) => (r.input as Planted).id).sort();
    expect(reported).toEqual(ids(lines.filter((o) => o.expect.undecided)));
  });

  it("reports exactly the planted float-wrong inputs, and no far input", () => {
    const reported = report.records.map((r) => (r.input as Planted).id).sort();
    expect(reported).toEqual(ids(lines.filter((o) => o.expect.undecided || o.expect.floatWrong)));
    expect(report.records.filter((r) => r.floatWrong).map((r) => (r.input as Planted).id).sort()).toEqual(
      ids(lines.filter((o) => o.expect.floatWrong)),
    );
  });

  it("gives the known exact answer of each planted input, and the oracle agrees", () => {
    for (const o of lines) {
      const { predicate, point, given } = pointOf(o);
      const r = classify(predicate, point, given as never);
      expect([o.id, r.exactAnswer]).toEqual([o.id, o.expect.exact]);
      expect([o.id, oracle(o)]).toEqual([o.id, o.expect.exact]);
      expect([o.id, r.undecided]).toEqual([o.id, o.expect.undecided]);
      expect([o.id, r.undecidedFiltered]).toEqual([o.id, o.expect.undecidedFiltered ?? o.expect.undecided]);
      expect([o.id, r.floatWrong]).toEqual([o.id, o.expect.floatWrong]);
      expect([o.id, r.floatCompared]).toEqual([o.id, o.expect.floatCompared ?? true]);
      if (!r.undecided) expect([o.id, r.boundAnswer]).toEqual([o.id, r.exactAnswer]);
      expect(r.signs.every((s) => s.contained)).toBe(true);
    }
  });

  it("confirms each undecided sign with the exact value inside its bound", () => {
    for (const r of report.records) {
      for (const s of r.signs) {
        expect(s.contained).toBe(true);
        if (s.boundSign !== null) expect(s.boundSign).toBe(s.exactSign);
        if (s.filterSign !== null) expect(s.filterSign).toBe(s.exactSign);
      }
    }
    expect(report.groups.every((g) => g.boundViolations === 0 && g.boundWrong === 0)).toBe(true);
  });

  it("weighs each line by its count n", () => {
    const groups = report.groups.filter((g) => g.fn === "segmentsCross" && g.case === "synthetic-highways");
    const own = lines.filter((o) => o["case"] === "synthetic-highways" && o["fn"] === "segmentsCross");
    expect(sum(groups, (g) => g.total)).toBe(weight(own));
    expect(sum(groups, (g) => g.undecided)).toBe(weight(own.filter((o) => o.expect.undecided)));
    expect(sum(groups, (g) => g.undecided)).toBe(7);
    const boxes = report.groups.find((g) => g.fn === "overlaps");
    expect(boxes?.decided).toBe(7);
  });

  it("counts the near tests of a count line as the seen lines, not as unseen", () => {
    const c = report.cases.find((x) => x.case === "synthetic-near");
    expect(c?.unseen).toBe(0);
    expect(c?.unseenNear).toEqual({});
    expect(ofCase(report, "synthetic-near").some((g) => g.source === "unseen")).toBe(false);
    const checks = report.nearCheck.filter((x) => x.case === "synthetic-near");
    expect(checks.map((x) => x.field)).toContain("nearSharedEnd");
    expect(checks.map((x) => x.field)).toContain("near.geom.segmentHitsRect");
    expect(checks.every((x) => x.holds && x.unseen === 0)).toBe(true);
  });

  it("gives far = total - near, so the case total is the sum of the totals of the count line", () => {
    const c = report.cases.find((x) => x.case === "synthetic-near");
    expect(c?.total).toBe(100 + 50 + 7 + 9);
    const far = (p: string): number | undefined => ofCase(report, "synthetic-near").find((g) => g.source === "far" && g.predicate === p)?.total;
    expect([far("segmentPair"), far("segmentBox"), far("nearest"), far("pointSide")]).toEqual([95, 46, 7, 8]);
    const fn = (k: string) => report.byFn.find((r) => r.key === k);
    expect([fn("geom.segmentsCross")?.lines, fn("geom.segmentsCross")?.far, fn("geom.segmentsCross")?.total]).toEqual([5, 57, 62]);
    expect([fn("mesh.crossing")?.lines, fn("mesh.crossing")?.far]).toEqual([0, 2]);
    expect(fn("routes.side")?.total).toBe(9);
  });

  it("uses the weight of the lines as near when a count line has no near field", () => {
    const hw = report.cases.find((c) => c.case === "synthetic-highways");
    expect(hw?.total).toBe(1000 + 500 + 1);
    expect(hw?.unseen).toBe(0);
  });

  it("counts near - seen tests as unseen only in a truncated case", () => {
    const tr = report.cases.find((c) => c.case === "synthetic-truncated");
    expect(tr?.truncated).toBe(true);
    expect(tr?.unseenNear).toEqual({ nearSegmentPairs: 249999, nearBoxTests: 40 });
    expect(tr?.unseen).toBe(250039);
    expect(tr?.decided).toBe(11);
    expect(tr?.undecided).toBe(0);
    expect(tr?.total).toBe(250010 + 40);
    expect(tr?.sharedEnd.total).toBe(100);
    expect(report.cases.find((c) => c.case === "synthetic-packing")?.truncated).toBe(false);
  });

  it("reads the rect form as the segment-box predicate", () => {
    const rect = report.groups.filter((g) => g.fn === "geom.segmentHitsRect");
    expect(rect.length).toBeGreaterThan(0);
    expect(rect.every((g) => g.predicate === "segmentBox")).toBe(true);
    expect(parseLine(lines.find((o) => o.id === "sr-far-hit")).form).toBe("segmentRect");
    expect(report.unknown.map((u) => (u.input as Planted).id)).toEqual(["unknown-shape"]);
  });

  it("follows the eps rule of highways: a tie at eps is false, and the float clip that rounds up is float-wrong", () => {
    const tie = report.records.find((r) => (r.input as Planted).id === "sb-eps-tie-s6");
    expect(tie?.exactAnswer).toBe(false);
    expect(tie?.undecided).toBe(false);
    expect(tie?.floatWrong).toBe(true);
    expect(tie?.signs.find((s) => s.name.startsWith("len("))?.bounds).toEqual([0, 0]);
  });

  it("keeps the shared-end inputs in their own group, with and without the filter", () => {
    const groups = ofCase(report, "synthetic-highways").filter((g) => g.sharedEnd);
    expect(groups.map((g) => [g.fn, g.total, g.undecided, g.undecidedFiltered])).toEqual([["segmentsCross", 1, 1, 0]]);
    const hw = report.cases.find((c) => c.case === "synthetic-highways");
    expect(hw?.sharedEnd).toEqual({ total: 1, undecided: 1, undecidedFiltered: 0 });
    expect(report.totals.sharedEnd.undecidedFiltered).toBe(0);
    expect(report.totals.undecided - report.totals.undecidedFiltered).toBe(2);
  });

  it("keeps the s4 pair of highways: float 0, exact +1, undecided, near collinear", () => {
    const s4 = report.records.find((r) => (r.input as Planted).id === "sp-s4-lane-leaves-lane");
    const cda = s4?.signs.find((s) => s.name === "orient(c,d,a)");
    expect([cda?.floatSign, cda?.exactSign, cda?.boundSign]).toEqual([0, 1, null]);
    expect([s4?.floatWrong, s4?.nearCollinear, s4?.sharedVertex, s4?.n]).toEqual([true, true, false, 2]);
    for (const r of report.records.filter((x) => x.predicate === "segmentPair")) {
      const o = r.input as Planted;
      if (o.expect.nearCollinear !== undefined) expect([o.id, r.nearCollinear]).toEqual([o.id, o.expect.nearCollinear]);
      if (o.expect.sharedVertex !== undefined) expect([o.id, r.sharedVertex]).toEqual([o.id, o.expect.sharedVertex]);
    }
    expect(report.records.find((r) => (r.input as Planted).id === "sp-shared-end")?.sharedVertex).toBe(true);
    const g = report.groups.find((x) => x.fn === "geom.segmentsCross" && x.case === "synthetic-highways");
    expect([g?.floatWrong, g?.floatWrongNearCollinear]).toEqual([2, 2]);
    expect(report.totals.floatWrongNearCollinear).toBe(3);
  });

  it("reads the point-side form: the exact sign, and a truth value as the float answer is not compared", () => {
    const side = report.groups.filter((g) => g.case === "synthetic-side");
    expect(side.every((g) => g.predicate === "pointSide")).toBe(true);
    expect(sum(side, (g) => g.total)).toBe(1 + 3 + 1 + 2 + 1);
    expect(sum(side, (g) => g.undecided)).toBe(4);
    expect(sum(side, (g) => g.undecidedFiltered)).toBe(3);
    expect(sum(side, (g) => g.floatWrong)).toBe(1);
    expect(sum(side, (g) => g.floatUncompared)).toBe(2);
    const bool = report.records.find((r) => (r.input as Planted).id === "ps-boolean-answer");
    expect([bool?.floatAnswer, bool?.exactAnswer, bool?.floatWrong]).toEqual([true, -1, false]);
  });

  it("checks the far assumption, and records the commit and the file hashes", () => {
    expect(report.farCheck.map((f) => [f.case, f.holds])).toEqual([
      ["synthetic-highways", true],
      ["synthetic-near", true],
      ["synthetic-packing", true],
      ["synthetic-truncated", true],
    ]);
    expect(report.files.map((f) => path.basename(f.path))).toEqual([
      "box-pairs.jsonl",
      "counts.jsonl",
      "near-counts.jsonl",
      "point-side.jsonl",
      "segment-box.jsonl",
      "segment-pairs.jsonl",
      "segment-rect.jsonl",
    ]);
    for (const f of report.files) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.commit).toMatch(/^([0-9a-f]{40}|unknown)$/);
    expect(report.totals.undecided).toBe(weight(lines.filter((o) => o.expect.undecided)));
    expect(report.totals.total).toBe(report.cases.reduce((k, c) => k + c.total, 0));
  });
});

describe("the tally", () => {
  it("keeps a line that is not JSON as unknown, and skips an empty line", () => {
    const t = new Tally();
    t.addText("f", 1, "{not json");
    t.addText("f", 2, "   ");
    const r = t.result();
    expect(r.unknown).toHaveLength(1);
    expect(r.cases[0]?.unknown).toBe(1);
  });

  it("refuses a weight that is not a positive whole number", () => {
    const line = { case: "c", fn: "f", n: 0, a: [0, 0], b: [1, 1], c: [0, 1], d: [1, 0] };
    expect(parseLine(line).form).toBe("unknown");
    expect(parseLine({ ...line, n: 2 }).form).toBe("segmentPair");
  });

  it("gives the same result two times", () => {
    const t = new Tally();
    t.add("f", 1, { case: "c", totalSegmentPairs: 10, nearSegmentPairs: 1 });
    t.add("f", 2, { case: "c", fn: "f", a: [0, 0], b: [1, 1], c: [0, 1], d: [1, 0] });
    expect(t.result()).toEqual(t.result());
    expect(t.result().cases[0]?.total).toBe(10);
  });

  it("fails the near check when a case that is not truncated has fewer lines than near", () => {
    const t = new Tally();
    t.add("f", 1, { case: "c", totalSegmentPairs: 10, nearSegmentPairs: 3 });
    t.add("f", 2, { case: "c", fn: "f", a: [0, 0], b: [1, 1], c: [0, 1], d: [1, 0] });
    const r = t.result();
    expect(r.nearCheck.map((x) => [x.field, x.near, x.seen, x.holds])).toEqual([["nearSegmentPairs", 3, 1, false]]);
    expect(r.cases[0]?.unseen).toBe(0);
  });

  it("reads the point-side count fields", () => {
    const t = new Tally();
    t.add("f", 1, { case: "c", totalPointSideTests: 5, nearPointSideTests: 1 });
    t.add("f", 2, { case: "c", fn: "s", p: [0, 1], a: [0, 0], b: [1, 0], floatAnswer: 1 });
    const r = t.result();
    expect(r.groups.map((g) => [g.predicate, g.source, g.total])).toEqual([
      ["pointSide", "far", 4],
      ["pointSide", "lines", 1],
    ]);
  });
});

describe("the census of a large dump", () => {
  it("gives each record to the sink and keeps none in memory", () => {
    const inMemory = censusOfFiles([synthetic], here);
    const sunk: unknown[] = [];
    const unknown: unknown[] = [];
    const streamed = censusOfFiles([synthetic], here, { onRecord: (r) => sunk.push(r), onUnknown: (r) => unknown.push(r) });
    expect(streamed.records).toEqual([]);
    expect(streamed.unknown).toEqual([]);
    expect(sunk).toEqual(inMemory.records);
    expect(unknown).toEqual(inMemory.unknown);
    expect(streamed.totals).toEqual(inMemory.totals);
    expect(streamed.files).toEqual(inMemory.files);
  });

  it("reads CRLF lines and a last line with no end, as one string per line", () => {
    const dir = fs.mkdtempSync(path.join(here, "../.tmp-census-"));
    try {
      const source = fs.readFileSync(path.join(synthetic, fs.readdirSync(synthetic).filter((f) => f.endsWith(".jsonl"))[0] as string), "utf8");
      const lines = source.split(/\r?\n/).filter((l) => l.trim() !== "");
      fs.writeFileSync(path.join(dir, "a.jsonl"), lines.join("\r\n"));
      fs.writeFileSync(path.join(dir, "b.jsonl"), lines.join("\n") + "\n");
      const crlf = censusOfFiles([path.join(dir, "a.jsonl")], here);
      const lf = censusOfFiles([path.join(dir, "b.jsonl")], here);
      expect(crlf.totals).toEqual(lf.totals);
      expect(crlf.files[0]?.lines).toBe(lines.length);
      expect(crlf.records.map((r) => r.line)).toEqual(lf.records.map((r) => r.line));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the census of the packing form", () => {
  const sample = path.join(here, "../corpus/packing/smoke-v1-sample.jsonl");
  const report = censusOfFiles([sample], here);
  const nearLines = fs
    .readFileSync(sample, "utf8")
    .split(/\r?\n/)
    .filter((t) => t.trim() !== "")
    .map((t) => JSON.parse(t) as Record<string, unknown>)
    .filter((o) => "times" in o);
  const byFn = (key: string) => report.byFn.find((r) => r.key === key);

  it("gives far = total - near - touch, and counts the touch and the far inputs as decided", () => {
    // Five cases of the smoke-v1 dump of packing at d718b54: 49229 inputs, 2837 touch inputs and 7 near inputs.
    expect(report.totals).toMatchObject({ total: 49229, decided: 49229, touch: 2837, undecided: 0, floatWrong: 0, unseen: 0, unknown: 0 });
    expect([byFn("overlap")?.lines, byFn("overlap")?.touch, byFn("overlap")?.far]).toEqual([5, 2621, 45080]);
    expect([byFn("container")?.lines, byFn("container")?.touch, byFn("container")?.far]).toEqual([2, 216, 1298]);
    expect([byFn("samePlacements")?.far, byFn("samePlacements")?.predicates]).toEqual([7, ["samePlacements"]]);
    expect(report.byPredicate.map((r) => r.key)).toEqual(["boxPair", "container", "samePlacements"]);
  });

  it("agrees with the near counts and the line counts of each case line", () => {
    expect(report.nearCheck.length).toBeGreaterThan(0);
    expect(report.nearCheck.filter((c) => !c.holds)).toEqual([]);
    const relax = report.nearCheck.filter((c) => c.case.startsWith("relax-rows/"));
    expect(relax.find((c) => c.field === "near.container")).toMatchObject({ total: 30, near: 2, touch: 22, seen: 2 });
    expect(relax.find((c) => c.field === "lines")).toMatchObject({ near: 1, seen: 1 });
  });

  it("counts the weight of each near reason of packing", () => {
    expect(report.nearReasons).toEqual({ container: { "bottom:zero": 2, "left:zero:touch": 2 }, overlap: { "x:zero": 1, "y:tolerance": 4 } });
  });

  it("gives the exact answer of the oracle to each near line, and the census float rule gives the answer of packing", () => {
    expect(nearLines).toHaveLength(6);
    for (const o of nearLines) {
      const line = parseLine(o);
      if (line.form === "edgePair") {
        const r = classify(edgePair, edgePairPoint(line.line.a, line.line.b, line.line.tolerance));
        expect([r.exactAnswer, r.floatAnswer, r.undecided]).toEqual([O.edgesOverlap(line.line.a, line.line.b, line.line.tolerance), o["floatAnswer"], false]);
      } else if (line.form === "container") {
        const r = classify(containerPredicate(line.line.fixedW, line.line.fixedH), containerPoint(line.line));
        const { w, h } = line.line;
        expect([r.exactAnswer, r.floatAnswer, r.undecided]).toEqual([O.outOfContainer({ ...line.line, w: w ?? 0, h: h ?? 0 }), o["floatAnswer"], false]);
      } else {
        throw new Error("The sample line has the form " + line.form + ".");
      }
    }
  });

  it("keeps a margin near the tolerance: the rule asks y only when x overlaps, and the exact y margin is below the tolerance", () => {
    const o = nearLines.find((x) => (x["near"] as string[]).includes("y:tolerance")) as Record<string, unknown>;
    const [a, b] = [o["a"] as O.Edges, o["b"] as O.Edges];
    // The boxes of this real line are apart on x, so the rule of packing does not ask the margin of y.
    expect(classify(edgePair, edgePairPoint(a, b, 0.001)).signs.map((s) => [s.name, s.exactSign])).toEqual([["marginX - tolerance", -1]]);
    // With an overlap on x, the y margin 627.827 - 627.826 is exact in floats and below the tolerance 0.001.
    const r = classify(edgePair, edgePairPoint({ ...a, l: 0, r: 1 }, { ...b, l: 0, r: 1 }, 0.001));
    expect(r.signs.map((s) => [s.name, s.exactSign, s.floatSign])).toEqual([
      ["marginX - tolerance", 1, 1],
      ["marginY - tolerance", -1, -1],
    ]);
    expect([r.exactAnswer, r.undecided]).toEqual([false, false]);
  });

  it("finds a float-wrong box pair: the float margin rounds down to the tolerance", () => {
    // The exact margin is 1 + 2^-60, larger than the tolerance 1. The float margin is 1, so packing says false.
    const t = new Tally();
    const a = { l: -(2 ** -60), t: 0, r: 5, b: 5 };
    const b = { l: -1, t: 0, r: 1, b: 5 };
    t.add("f", 1, { case: "c", fn: "overlap", a, b, tolerance: 1, near: ["x:tolerance"], floatAnswer: false, times: 3 });
    t.add("f", 2, { case: "c", totalPairs: 10, totals: { overlap: 10 }, near: { overlap: 3 }, touch: { overlap: 2 }, lines: 1 });
    const r = t.result();
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ exactAnswer: true, floatAnswer: false, floatWrong: true, undecided: true, n: 3 });
    expect(r.cases[0]).toMatchObject({ total: 10, decided: 7, touch: 2, undecided: 3, floatWrong: 3 });
    expect(classify(edgePair, edgePairPoint(a, b, 1)).floatAnswer).toBe(false);
  });

  it("reads a strip line, and a range or null as its float answer", () => {
    const line = { case: "c", fn: "edgeRange", ax: 0, ay: 0, bx: 1, by: 1, y0: 1, y1: 2, near: ["low:touch", "flat"], times: 1 };
    expect(parseLine({ ...line, floatAnswer: null })).toMatchObject({ form: "strip", line: { floatAnswer: false, n: 1 } });
    expect(parseLine({ ...line, floatAnswer: [0, 1] })).toMatchObject({ form: "strip", line: { floatAnswer: true } });
    const t = new Tally();
    t.add("f", 1, { ...line, floatAnswer: null });
    expect(t.result().groups.map((g) => [g.predicate, g.total, g.floatWrong])).toEqual([["strip", 1, 0]]);
  });

  it("keeps xAt, samePlacements and an infinite fixed side as unknown, with the reason, in the near check", () => {
    const t = new Tally();
    t.add("f", 1, { case: "c", fn: "xAt", ax: 0, ay: 0, bx: 1, by: 1, y: 1e-12, near: ["end"], floatAnswer: 1e-12, times: 2 });
    t.add("f", 2, { case: "c", fn: "samePlacements", a: { id: "a", x: 0, y: 0 }, b: { id: "a", x: 1e-12, y: 0 }, near: ["placement"], floatAnswer: false, times: 1 });
    const box = { box: { l: 0, t: 0, r: 1, b: 1 }, x: 0, y: 0, w: 1, h: null, inset: 0, tolerance: 0.001, fixedW: true };
    t.add("f", 3, { case: "c", fn: "container", ...box, fixedH: true, near: ["left:zero"], floatAnswer: false, times: 1 });
    t.add("f", 4, { case: "c", totals: { xAt: 5, samePlacements: 1, container: 1 }, near: { xAt: 2, samePlacements: 1, container: 1 }, touch: {}, lines: 3 });
    const r = t.result();
    expect(r.unknown.map((u) => u.error)).toEqual([
      PACKING_UNMODELED["xAt"],
      PACKING_UNMODELED["samePlacements"],
      "A fixed side of the container has an infinite size.",
    ]);
    expect(r.nearCheck.every((c) => c.holds)).toBe(true);
    expect(r.cases[0]).toMatchObject({ total: 7, unknown: 4, decided: 3 });
    expect(parseLine({ case: "c", fn: "container", ...box, fixedH: false, near: ["left:zero"], floatAnswer: false, times: 1 }).form).toBe("container");
  });

  it("fails the near check when the weight of the lines is not the near count, or near + touch is larger than total", () => {
    const t = new Tally();
    t.add("f", 1, { case: "c", fn: "overlap", a: { l: 0, t: 0, r: 1, b: 1 }, b: { l: 1, t: 0, r: 2, b: 1 }, tolerance: 0.001, near: ["x:zero"], floatAnswer: false, times: 1 });
    t.add("f", 2, { case: "c", totals: { overlap: 3, container: 1 }, near: { overlap: 2, container: 0 }, touch: { overlap: 0, container: 2 }, lines: 1 });
    expect(t.result().nearCheck.filter((c) => !c.holds).map((c) => c.field)).toEqual(["near.container", "near.overlap"]);
  });

  it("reads a highways count line with totalPairs as a count line, not as a packing case line", () => {
    expect(parseLine({ case: "c", totalPairs: 4, nearPairs: 1 }).form).toBe("count");
  });
});

describe("the field rule of a dump line (highways #258)", () => {
  const touch = { a: [10, 42], b: [10, 237], c: [90, 169.842811927414], d: [10, 132.157188072586] };
  const mid = { p: [2984, 102], a: [2000, 182.71875], b: [3968, 21.28125] };
  const tally = (...lines: object[]): Census => {
    const t = new Tally();
    lines.forEach((l, i) => t.addText("f", i + 1, JSON.stringify(l)));
    return t.result();
  };

  it("counts a touch as a crossing when the rule says touch, on a call site without a copy", () => {
    const r = tally({ case: "c", fn: "other.crossing", n: 1, ...touch, floatAnswer: true, rule: { touch: true, shareTolerance: 1e-9, parallelTolerance: 1e-12 } });
    expect(r.cases[0]?.floatWrong).toBe(0);
    expect(r.cases[0]?.unknown).toBe(0);
  });

  it("gives the default rule to a line without the field and without a copy", () => {
    const r = tally({ case: "c", fn: "other.crossing", n: 1, ...touch, floatAnswer: true });
    expect(r.cases[0]?.floatWrong).toBe(1);
  });

  it("lets the field rule come before the copy of a call site", () => {
    const r = tally({ case: "c", fn: "mesh.crossing", n: 1, ...touch, floatAnswer: true, rule: { touch: false } });
    expect(r.cases[0]?.floatWrong).toBe(1);
  });

  it("counts the lines that use a copy of CALL_SITE_RULES, and no line with the field rule", () => {
    const r = tally(
      { case: "c", fn: "mesh.crossing", n: 1, ...touch, floatAnswer: true },
      { case: "c", fn: "mesh.crossing", n: 5, ...touch, floatAnswer: true },
      { case: "c", fn: "mesh.crossing", n: 1, ...touch, floatAnswer: true, rule: { touch: true } },
      { case: "c", fn: "physics.outOf", n: 1, ...mid, floatAnswer: -1, rule: { zero: -1 } },
      { case: "c", fn: "other.crossing", n: 1, ...touch, floatAnswer: true },
    );
    expect(r.copyUses).toEqual({ "mesh.crossing": 2 });
    expect(tally({ case: "c", fn: "other.crossing", n: 1, ...touch, floatAnswer: true }).copyUses).toEqual({});
  });

  it("gives -1 to a zero side when the rule says zero -1", () => {
    const r = tally({ case: "c", fn: "other.outOf", n: 1, ...mid, floatAnswer: -1, rule: { zero: -1 } });
    expect(r.cases[0]?.floatWrong).toBe(0);
  });

  it("keeps a line with a rule that the census cannot use as unknown, with the reason", () => {
    const r = tally({ case: "c", fn: "other.outOf", n: 3, ...mid, floatAnswer: 1, rule: { zero: 1 } }, { case: "c", fn: "x", n: 1, ...touch, rule: "closed" });
    expect(r.cases[0]?.unknown).toBe(4);
    expect(r.unknown.map((u) => u.error)).toEqual([
      "The census has no predicate for the rule of the line: the census has no point-side rule with zero 1.",
      'The census has no predicate for the rule of the line: the rule field is not an object: "closed".',
    ]);
  });
});
