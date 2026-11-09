import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import type { CensusFile } from "./census-view.ts";
import type { NearMissFile } from "./presets.ts";
import { parseNearMisses } from "./presets.ts";
import {
  censusFile,
  censusSites,
  checkMachine,
  checkReport,
  isFloatWrong,
  nearMissFile,
  readRecords,
  refresh,
  selectNearMisses,
  writeFloatWrong,
  type CensusReport,
  type KeptRecord,
  type KeptRuns,
} from "./study.ts";

const site = new URL("../", import.meta.url);
const results = new URL("../../predicate-census/results/", import.meta.url);
const readJson = <T>(url: URL): T => JSON.parse(readFileSync(url, "utf8")) as T;
const kept = readJson<KeptRuns>(new URL("data/kept-runs.json", site));
const census = readJson<CensusFile>(new URL("data/census-classes.json", site));
const nearMisses = readJson<NearMissFile>(new URL("data/near-misses.json", site));

/** A record of the census with a sign that flips, for the tests of the rule. */
function record(line: number, fields: Partial<KeptRecord> & { via?: string } = {}): KeptRecord {
  const { via = "src/a.ts:1", ...rest } = fields;
  return {
    line,
    case: `case-${line}`,
    fn: "geom.segmentsCross",
    n: 1,
    predicate: "segmentPair",
    input: { a: [0, 0], b: [1, 1], c: [0, 1], d: [1, 0], via, case: `case-${line}`, n: 1 },
    signs: [{ name: "orient(c,d,a)", exactSign: 1, floatSign: 0, bounds: [-1e-14, 1e-14] }],
    floatWrong: true,
    floatAnswer: false,
    exactAnswer: true,
    ...rest,
  };
}

const source = { census: "7", dump: "8" };

describe("the selection of the near misses", () => {
  it("keeps the record with the most tests for each source line of the call, and the lowest line on a tie", () => {
    const got = selectNearMisses([{ set: "s", records: [record(5, { n: 2 }), record(3, { n: 4 }), record(9, { n: 4 }), record(1, { via: "src/b.ts:2" })] }], source);
    expect(got.map((r) => [r.via, r.source.line, r.weight])).toEqual([
      ["src/a.ts:1", 3, 4],
      ["src/b.ts:2", 1, 1],
    ]);
  });

  it("orders the records by set, then by function and source line of the call", () => {
    const got = selectNearMisses(
      [
        { set: "two", records: [record(1, { fn: "geom.z" }), record(2, { fn: "geom.a", via: "src/z.ts:9" }), record(3, { fn: "geom.a", via: "src/c.ts:9" })] },
        { set: "one", records: [record(4)] },
      ],
      source,
    );
    expect(got.map((r) => `${r.set} ${r.fn} ${r.via}`)).toEqual(["two geom.a src/c.ts:9", "two geom.a src/z.ts:9", "two geom.z src/a.ts:1", "one geom.segmentsCross src/a.ts:1"]);
  });

  it("keeps a record only when it is float-wrong, the explorer shows its predicate and a sign flips", () => {
    const noFlip = record(2, { signs: [{ name: "orient(c,d,a)", exactSign: 1, floatSign: 1, bounds: [0.5, 1] }] });
    const got = selectNearMisses([{ set: "s", records: [record(1, { floatWrong: false }), noFlip, record(3, { predicate: "packRect" }), record(4, { n: 0 })] }], source);
    expect(got.map((r) => r.source.line)).toEqual([4]);
  });

  it("keeps only the fields of the input of the predicate, and the provenance", () => {
    const [got] = selectNearMisses([{ set: "s", records: [record(1)] }], source);
    expect(got?.input).toEqual({ a: [0, 0], b: [1, 1], c: [0, 1], d: [1, 0] });
    expect(got?.source).toEqual({ census: "7", dump: "8", line: 1 });
    expect(got?.flips).toEqual([{ name: "orient(c,d,a)", exactSign: 1, floatSign: 0, bounds: [-1e-14, 1e-14] }]);
  });

  it("stops at a sign that its predicate does not have", () => {
    const bad = record(1, { signs: [{ name: "orient(x,y,z)", exactSign: 1, floatSign: -1, bounds: [-1, 1] }] });
    expect(() => selectNearMisses([{ set: "s", records: [bad] }], source)).toThrow("has no such sign");
  });

  it("gives a file that the explorer reads", () => {
    const file = nearMissFile(selectNearMisses([{ set: "s", records: [record(1)] }], source), source);
    expect(parseNearMisses(file).records).toHaveLength(1);
    expect(file.note).toContain("the most tests");
  });
});

describe("the kept data of the site", () => {
  const sets = census.highways.sets.map((s) => s.set);
  const folder = new URL(`${kept.census.highways}/`, results);

  it("has the near misses that the rule selects from the kept float-wrong records", () => {
    const src = { census: census.highways.census, dump: census.highways.dump };
    const want = nearMissFile(selectNearMisses(sets.map((set) => ({ set, records: readRecords(fileURLToPath(new URL(`float-wrong-${set}.jsonl.gz`, folder))) })), src), src);
    expect(nearMisses).toEqual(JSON.parse(JSON.stringify(want)));
  });

  it("has the counts of census-classes.json from the kept reports", () => {
    const report = (set: string): CensusReport => readJson<CensusReport>(new URL(`report-${set}.json`, folder));
    const packing = JSON.parse(gunzipSync(readFileSync(new URL(`${kept.census.packing}/report-${census.packing.set}.json.gz`, results))).toString("utf8")) as CensusReport;
    const want = censusFile(
      { census: census.highways.census, dump: census.highways.dump, reports: sets.map((set) => ({ set, report: report(set) })) },
      { census: census.packing.census, dump: census.packing.dump, set: census.packing.set, report: packing },
    );
    expect(census).toEqual(want);
  });
});

describe("the parts of the refresh", () => {
  const report = (fields: Partial<CensusReport> = {}): CensusReport => ({
    commit: "a".repeat(40),
    dirty: false,
    totals: { total: 10, undecided: 1, floatWrong: 3 },
    floatWrongClasses: { 1: { tests: 1 }, 2: { tests: 2 }, 3: { tests: 0 }, 4: { tests: 0 } },
    floatWrongSites: { "2 geom.f src/a.ts:1": 2, "1 geom.g src/b.ts:2": 1 },
    ...fields,
  });

  it("stops at a report of another commit, or of a tree with changes", () => {
    expect(() => checkReport("r", report(), "a".repeat(40))).not.toThrow();
    expect(() => checkReport("r", report(), "b".repeat(40))).toThrow("is of the commit");
    expect(() => checkReport("r", report({ dirty: true }), "a".repeat(40))).toThrow("tree with changes");
    expect(() => checkReport("r", report({ dirty: null }), "a".repeat(40))).toThrow("no git status");
  });

  it("stops at a bench of another commit", () => {
    const machine = `Model name: x\nv26.13.0\n${"a".repeat(40)}\n`;
    expect(() => checkMachine("a7-bench", machine, "a".repeat(40))).not.toThrow();
    expect(() => checkMachine("a7-bench", machine, "b".repeat(40))).toThrow("The bench a7-bench is of the commit");
    expect(() => checkMachine("a7-bench", "", "b".repeat(40))).toThrow("is of the commit");
  });

  it("sums the sites over the sets, by class and then the most tests first", () => {
    expect(censusSites([report(), report({ floatWrongSites: { "2 geom.h src/c.ts:3": 5 } })])).toEqual([
      { class: 1, fn: "geom.g", via: "src/b.ts:2", tests: 1 },
      { class: 2, fn: "geom.h", via: "src/c.ts:3", tests: 5 },
      { class: 2, fn: "geom.f", via: "src/a.ts:1", tests: 2 },
    ]);
    expect(() => censusSites([report({ floatWrongSites: { "9 geom.f src/a.ts:1": 1 } })])).toThrow("is not");
  });

  it("reads a report with no float-wrong test, which has no classes and no sites", () => {
    const { floatWrongClasses: _c, floatWrongSites: _s, ...none } = report({ totals: { total: 4, undecided: 0, floatWrong: 0 } });
    expect(censusSites([none])).toEqual([]);
    expect(censusFile({ census: "1", dump: "2", reports: [{ set: "h", report: none }] }, { census: "1", dump: "3", set: "p", report: none })).toEqual({
      highways: { census: "1", dump: "2", sets: [{ set: "h", tests: 4, undecided: 0, floatWrong: 0, classes: { 1: 0, 2: 0, 3: 0, 4: 0 } }], sites: [] },
      packing: { census: "1", dump: "3", set: "p", tests: 4, undecided: 0, floatWrong: 0 },
    });
    const { floatWrongClasses: _d, ...noClasses } = report();
    expect(() => censusFile({ census: "1", dump: "2", reports: [{ set: "h", report: noClasses }] }, { census: "1", dump: "3", set: "p", report: none })).toThrow("no classes");
  });

  it("finds the float-wrong lines", () => {
    expect(isFloatWrong(JSON.stringify(record(1)))).toBe(true);
    expect(isFloatWrong(JSON.stringify(record(1, { floatWrong: false })))).toBe(false);
    expect(isFloatWrong('{"line":1}')).toBe(false);
  });

  describe("on a repository in a temporary folder", () => {
    let root = "";
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("writes the data files and the kept folders, and removes the kept folders of the last run", () => {
      root = mkdtempSync(join(tmpdir(), "study-"));
      const at = (...parts: string[]): string => join(root, ...parts);
      const write = (path: string, text: string | Buffer): void => {
        mkdirSync(join(path, ".."), { recursive: true });
        writeFileSync(path, text);
      };
      const commit = "c".repeat(40);
      write(at("packages/bigfloat/package.json"), '{"version":"0.1.1"}');
      write(at("packages/evaluator-select/package.json"), '{"version":"0.2.0"}');
      write(at("packages/predicate-census/package.json"), '{"version":"0.3.0"}');
      write(at("packages/site/data/kept-runs.json"), JSON.stringify({ bench: { run: "1", folder: "2026-01-01" }, bigfloat: { run: "2", folder: "2026-01-02" }, census: { highways: "2026-01-01-highways", packing: "2026-01-01-packing" }, runs: {} }));
      for (const old of ["evaluator-bench/results/2026-01-01/report.json", "bigfloat-bench/results/2026-01-02/report.json", "predicate-census/results/2026-01-01-highways/x.json", "predicate-census/results/2026-01-01-packing/x.json", "predicate-census/results/2025-12-01-highways/x.json"]) write(at("packages", old), "{}");
      const art = at("artifacts");
      write(join(art, "census-kept-h1/report-h1.json"), JSON.stringify(report({ commit })));
      write(join(art, "census-kept-h1/float-wrong-h1.jsonl.gz"), gzipSync(`${JSON.stringify(record(4))}\n`));
      write(join(art, "census-kept-h1/time-h1.txt"), "t");
      write(join(art, "census-kept-h1/predicate-dump-h1.md"), "m");
      write(join(art, "census-kept-p1/report-p1.json"), JSON.stringify(report({ commit, totals: { total: 5, undecided: 0, floatWrong: 0 } })));
      write(join(art, "census-kept-p1/time-p1.txt"), "t");
      write(join(art, "census-kept-p1/float-wrong-p1.jsonl.gz"), gzipSync(""));
      write(join(art, "a6-bench/report.json"), '{"pairs":[]}\n');
      write(join(art, "a6-bench/records-aa.jsonl"), "");
      write(join(art, "a6-bench/machine.txt"), `cpu\n${commit}\n`);
      write(join(art, "a7-bench/report.json"), '{"pairs":[],"costs":[]}\n');
      write(join(art, "a7-bench/errors.jsonl"), '{"point":1}\n');
      write(join(art, "a7-bench/machine.txt"), `cpu\n${commit}\n`);

      const got = refresh({
        root,
        run: { id: "99", started: "2026-12-04T06:50:00Z", commit },
        highways: { dump: "50", sets: [{ set: "h1", dir: join(art, "census-kept-h1") }] },
        packing: { dump: "60", set: "p1", dir: join(art, "census-kept-p1") },
        bench: join(art, "a6-bench"),
        bigfloat: join(art, "a7-bench"),
      });

      expect(got).toEqual({
        bench: { run: "99", folder: "2026-12-04" },
        bigfloat: { run: "99", folder: "2026-12-04" },
        census: { highways: "2026-12-04-highways", packing: "2026-12-04-packing" },
        runs: { "99": { date: "2026-12-04T06:50:00Z", commit, engines: { "@algebra/bigfloat": "0.1.1", "@algebra/evaluator-select": "0.2.0", "@mark1russell7/predicate-census": "0.3.0" } } },
      });
      expect(readJson<KeptRuns>(new URL(`file:///${at("packages/site/data/kept-runs.json").replaceAll("\\", "/")}`))).toEqual(got);
      expect(readdirSync(at("packages/predicate-census/results")).sort()).toEqual(["2025-12-01-highways", "2026-12-04-highways", "2026-12-04-packing"]);
      expect(readdirSync(at("packages/evaluator-bench/results"))).toEqual(["2026-12-04"]);
      expect(readdirSync(at("packages/bigfloat-bench/results"))).toEqual(["2026-12-04"]);
      expect(readdirSync(at("packages/bigfloat-bench/results/2026-12-04")).sort()).toEqual(["errors.jsonl.gz", "machine.txt", "report.json"]);
      expect(gunzipSync(readFileSync(at("packages/bigfloat-bench/results/2026-12-04/errors.jsonl.gz"))).toString("utf8")).toBe('{"point":1}\n');
      expect(readFileSync(at("packages/site/data/a7-report.json"), "utf8")).toBe('{"pairs":[],"costs":[]}\n');
      expect(readdirSync(at("packages/predicate-census/results/2026-12-04-highways")).sort()).toEqual(["float-wrong-h1.jsonl.gz", "predicate-dump-h1.md", "report-h1.json", "time-h1.txt"]);
      expect(readdirSync(at("packages/predicate-census/results/2026-12-04-packing")).sort()).toEqual(["report-p1.json.gz", "time-p1.txt"]);
      expect(readFileSync(at("packages/site/data/a6-report.json"), "utf8")).toBe('{"pairs":[]}\n');
      const file = JSON.parse(readFileSync(at("packages/site/data/near-misses.json"), "utf8")) as NearMissFile;
      expect(file.records.map((r) => [r.set, r.source])).toEqual([["h1", { census: "99", dump: "50", line: 4 }]]);
      const classes = JSON.parse(readFileSync(at("packages/site/data/census-classes.json"), "utf8")) as CensusFile;
      expect(classes.highways).toMatchObject({ census: "99", dump: "50", sets: [{ set: "h1", tests: 10, floatWrong: 3 }] });
      expect(classes.packing).toMatchObject({ census: "99", dump: "60", set: "p1", tests: 5, floatWrong: 0 });
    });

    it("stops before it changes a file when a report is not of the commit of the run", () => {
      root = mkdtempSync(join(tmpdir(), "study-"));
      const dir = join(root, "census-kept-h1");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "report-h1.json"), JSON.stringify(report({ commit: "d".repeat(40) })));
      expect(() =>
        refresh({ root, run: { id: "1", started: "2026-12-04T00:00:00Z", commit: "e".repeat(40) }, highways: { dump: "1", sets: [{ set: "h1", dir }] }, packing: { dump: "1", set: "p", dir }, bench: dir, bigfloat: dir }),
      ).toThrow("is of the commit");
      expect(existsSync(join(root, "packages"))).toBe(false);
    });

    it("writes the float-wrong records of a file of records, in order", async () => {
      root = mkdtempSync(join(tmpdir(), "study-"));
      const lines = [record(1), record(2, { floatWrong: false }), record(3)].map((r) => JSON.stringify(r));
      writeFileSync(join(root, "r.jsonl"), `${lines.join("\n")}\n`);
      expect(await writeFloatWrong(join(root, "r.jsonl"), join(root, "f.jsonl.gz"))).toBe(2);
      expect(readRecords(join(root, "f.jsonl.gz")).map((r) => r.line)).toEqual([1, 3]);
    });
  });
});
