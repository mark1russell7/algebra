import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { censusOfFiles, classify, parseLine, Tally } from "./index.ts";
import { boxPairPoint, segmentBoxPoint, segmentPairPoint } from "./predicates.ts";
import * as O from "./oracle.test-helper.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const synthetic = path.join(here, "../corpus/synthetic");

interface Planted {
  readonly id: string;
  readonly n?: number;
  readonly expect: { readonly undecided: boolean; readonly exact: boolean; readonly floatWrong: boolean };
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

/** The exact answer of the oracle, which does not use the code of the package. */
function oracle(o: Planted): boolean {
  if ("c" in o) return O.crosses(o["a"] as V, o["b"] as V, o["c"] as V, o["d"] as V);
  if ("box" in o) return O.hitsOpenBox(o["a"] as V, o["b"] as V, o["box"] as B);
  return O.overlaps(o["a"] as B, o["b"] as B, (o["eps"] as number | undefined) ?? 0);
}

describe("the census of the synthetic corpus", () => {
  const report = censusOfFiles([synthetic], here);
  const lines = planted();

  it("has planted inputs of each kind", () => {
    expect(lines.filter((o) => o.expect.undecided).length).toBeGreaterThanOrEqual(8);
    expect(lines.filter((o) => !o.expect.undecided).length).toBeGreaterThanOrEqual(8);
    expect(lines.filter((o) => o.expect.floatWrong).length).toBeGreaterThanOrEqual(2);
  });

  it("reports exactly the planted undecided inputs", () => {
    const reported = report.records.filter((r) => r.undecided).map((r) => (r.input as Planted).id).sort();
    const want = lines.filter((o) => o.expect.undecided).map((o) => o.id).sort();
    expect(reported).toEqual(want);
  });

  it("reports exactly the planted float-wrong inputs, and no far input", () => {
    const reported = report.records.map((r) => (r.input as Planted).id).sort();
    const want = lines.filter((o) => o.expect.undecided || o.expect.floatWrong).map((o) => o.id).sort();
    expect(reported).toEqual(want);
    expect(report.records.filter((r) => r.floatWrong).map((r) => (r.input as Planted).id).sort()).toEqual(
      lines.filter((o) => o.expect.floatWrong).map((o) => o.id).sort(),
    );
  });

  it("gives the known exact answer of each planted input, and the oracle agrees", () => {
    for (const o of lines) {
      const line = parseLine(o);
      const point =
        line.form === "segmentPair"
          ? segmentPairPoint(line.line.a, line.line.b, line.line.c, line.line.d)
          : line.form === "segmentBox"
            ? segmentBoxPoint(line.line.a, line.line.b, line.line.box)
            : line.form === "boxPair"
              ? boxPairPoint(line.line.a, line.line.b, line.line.eps)
              : undefined;
      if (point === undefined || line.form === "count" || line.form === "unknown") throw new Error(`no form: ${o.id}`);
      const r = classify(line.form, point, line.line.floatAnswer);
      expect([o.id, r.exactAnswer]).toEqual([o.id, o.expect.exact]);
      expect([o.id, oracle(o)]).toEqual([o.id, o.expect.exact]);
      expect([o.id, r.undecided]).toEqual([o.id, o.expect.undecided]);
      if (!r.undecided) expect([o.id, r.boundAnswer]).toEqual([o.id, r.exactAnswer]);
      expect(r.signs.every((s) => s.contained)).toBe(true);
    }
  });

  it("confirms each undecided sign with the exact value inside its bound", () => {
    for (const r of report.records) {
      for (const s of r.signs) {
        expect(s.contained).toBe(true);
        if (s.boundSign !== null) expect(s.boundSign).toBe(s.exactSign);
      }
    }
    expect(report.groups.every((g) => g.boundViolations === 0 && g.boundWrong === 0)).toBe(true);
  });

  it("weighs each line by its count n", () => {
    const group = report.groups.find((g) => g.fn === "segmentsCross" && g.case === "synthetic-highways");
    const own = lines.filter((o) => o["case"] === "synthetic-highways" && o["fn"] === "segmentsCross");
    const weight = (os: Planted[]): number => os.reduce((k, o) => k + (o.n ?? 1), 0);
    expect(group?.total).toBe(weight(own));
    expect(group?.undecided).toBe(weight(own.filter((o) => o.expect.undecided)));
    expect(group?.undecided).toBe(7);
    const boxes = report.groups.find((g) => g.fn === "overlaps");
    expect(boxes?.decided).toBe(7);
  });

  it("adds the far counts as decided, and keeps unseen near inputs out of decided", () => {
    const hw = report.cases.find((c) => c.case === "synthetic-highways");
    expect(hw?.total).toBe(1500 + 13 + 7 + 1 + 1);
    const tr = report.cases.find((c) => c.case === "synthetic-truncated");
    expect(tr?.truncated).toBe(true);
    expect(tr?.unseenNear).toEqual({ nearSegmentPairs: 250000, nearBoxTests: 40 });
    expect(tr?.unseen).toBe(250040);
    expect(tr?.decided).toBe(11);
    expect(tr?.undecided).toBe(0);
    expect(tr?.total).toBe(250051);
    expect(report.cases.find((c) => c.case === "synthetic-packing")?.truncated).toBe(false);
  });

  it("keeps a line of no known form in a separate group, and a new fn in its own group", () => {
    expect(report.unknown.map((u) => (u.input as Planted).id)).toEqual(["unknown-shape"]);
    expect(report.groups.find((g) => g.predicate === "unknown")?.fn).toBe("segmentsTouch");
    expect(report.groups.find((g) => g.fn === "candidateCross")?.predicate).toBe("segmentPair");
  });

  it("checks the far assumption, and records the commit and the file hashes", () => {
    expect(report.farCheck.map((f) => [f.case, f.holds])).toEqual([
      ["synthetic-highways", true],
      ["synthetic-packing", true],
      ["synthetic-truncated", true],
    ]);
    expect(report.files.map((f) => path.basename(f.path))).toEqual(["box-pairs.jsonl", "counts.jsonl", "segment-box.jsonl", "segment-pairs.jsonl"]);
    for (const f of report.files) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.commit).toMatch(/^([0-9a-f]{40}|unknown)$/);
    expect(report.totals.undecided).toBe(lines.filter((o) => o.expect.undecided).reduce((k, o) => k + (o.n ?? 1), 0));
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
});
