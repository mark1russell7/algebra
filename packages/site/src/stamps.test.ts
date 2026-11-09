import { readdirSync, readFileSync } from "node:fs";
import { checkFreshness, parseDataStamps } from "@mark1russell7/site-pages";
import { describe, expect, it } from "vitest";
import { overallText, rawRecordsLink, type CostReport } from "./cost.ts";
import { siteDataStamps, STUDY_LIMIT_DAYS, STUDY_STARTS_AT, STUDY_WORKFLOW, type StampData } from "./stamps.ts";

const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const data: StampData = {
  census: json("../data/census-classes.json") as StampData["census"],
  nearMisses: json("../data/near-misses.json") as StampData["nearMisses"],
  kept: json("../data/kept-runs.json") as StampData["kept"],
};
const kept = data.kept as StampData["kept"] & { census: { highways: string; packing: string } };
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const folders = (pkg: string): string[] => readdirSync(new URL(`../../${pkg}/results/`, import.meta.url));
const workflow = readFileSync(new URL(`../../../${STUDY_WORKFLOW}`, import.meta.url), "utf8");

describe("the data stamp of the page", () => {
  it("names each run of the data once, with the limit of the monthly study", () => {
    const [stamp, ...others] = siteDataStamps(data).pages;
    expect(others).toEqual([]);
    expect(stamp?.page).toBe("index.html");
    expect(stamp).not.toHaveProperty("study");
    expect(stamp?.limit).toMatchObject({ days: 33, workflow: STUDY_WORKFLOW, startsAt: STUDY_STARTS_AT });
    expect(stamp?.runs.map((run) => run.id).sort()).toEqual(Object.keys(kept.runs).sort());
  });

  it("passes the check of the stamps of site-pages", () => {
    const parsed = parseDataStamps(siteDataStamps(data));
    expect(parsed.ok ? [] : parsed.faults).toEqual([]);
  });

  it("gives the full commit of each run", () => {
    for (const run of siteDataStamps(data).pages[0]!.runs) expect(run.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("has a limit that holds the largest gap of the schedule, 31 days, plus 2 days for the run and the merge", () => {
    const cron = /cron: "(\S+) (\S+) (\S+) (\S+) (\S+)"/.exec(workflow);
    expect(cron?.slice(3)).toEqual(["4", "*", "*"]);
    expect(STUDY_LIMIT_DAYS).toBe(31 + 2);
  });

  it("names the run of the bigfloat bench, so its age counts for the freshness gate", () => {
    const at = (date: string) => ({ ...kept, runs: Object.fromEntries(Object.entries(kept.runs).map(([id, run]) => [id, { ...run, date }])) });
    const now = "2026-12-20T00:00:00Z";
    const check = (runs: StampData["kept"]) => checkFreshness(siteDataStamps({ ...data, kept: runs }), { now, times: [], schedules: { [STUDY_WORKFLOW]: 31 } }).faults;
    const fresh = at("2026-12-04T06:50:00Z");
    expect(siteDataStamps(data).pages[0]!.runs.map((run) => run.id)).toContain(kept.bigfloat.run);
    expect(check(fresh)).toEqual([]);
    const old = { ...fresh, runs: { ...fresh.runs, [kept.bigfloat.run]: { ...fresh.runs[kept.bigfloat.run]!, date: "2026-11-09T18:51:13Z" } } };
    expect(check(old).join(" ")).toContain(kept.bigfloat.run);
  });

  it("stops the build when the data names a run with no line in data/kept-runs.json", () => {
    const newer = { ...data, census: { ...data.census, packing: { census: "1" } } };
    expect(() => siteDataStamps(newer)).toThrow("The data names the run 1");
  });

  it("names the kept folders of the runs, on the days of the runs", () => {
    expect(kept.runs[kept.bench.run]?.date.slice(0, 10)).toBe(kept.bench.folder);
    expect(folders("evaluator-bench")).toContain(kept.bench.folder);
    expect(kept.runs[kept.bigfloat.run]?.date.slice(0, 10)).toBe(kept.bigfloat.folder);
    expect(folders("bigfloat-bench")).toContain(kept.bigfloat.folder);
    expect(folders("predicate-census")).toContain(kept.census.highways);
    expect(folders("predicate-census")).toContain(kept.census.packing);
    expect(`${kept.runs[data.census.highways.census]?.date.slice(0, 10)}-highways`).toBe(kept.census.highways);
    expect(`${kept.runs[data.census.packing.census]?.date.slice(0, 10)}-packing`).toBe(kept.census.packing);
  });

  it("has the mark of the stamp, and no number of a run in the page", () => {
    expect(page).toContain("<!-- data-stamp -->");
    for (const id of Object.keys(kept.runs)) expect(page).not.toContain(id);
  });
});

describe("the text of the cost section", () => {
  const report = json("../data/a6-report.json") as CostReport;

  it("comes from the kept report", () => {
    const exact = report.pairs.find((p) => p.stage === "exact")!;
    expect(overallText(report)).toBe(
      `All cases together in that run: ${exact.outcome}, median × ${exact.medianRatio.toPrecision(3)}. The plan gave ${report.stitchedFailures} wrong answers.`.replace(" 1 wrong answers", " 1 wrong answer"),
    );
    expect(overallText({ pairs: [{ stage: "exact", outcome: "slower", medianRatio: 2.5, families: [] }], stitchedFailures: 1 })).toBe(
      "All cases together in that run: slower, median × 2.50. The plan gave 1 wrong answer.",
    );
  });

  it("links the kept folder of the bench run", () => {
    expect(rawRecordsLink(kept.bench)).toEqual({
      href: `https://github.com/mark1russell7/algebra/tree/main/packages/evaluator-bench/results/${kept.bench.folder}`,
      text: `The raw records of run ${kept.bench.run}`,
    });
  });
});
