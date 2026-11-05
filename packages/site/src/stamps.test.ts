import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BENCH_RUN, KEPT_RUNS, siteDataStamps, type StampData } from "./stamps.ts";

const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const data: StampData = {
  census: json("../data/census-classes.json") as StampData["census"],
  nearMisses: json("../data/near-misses.json") as StampData["nearMisses"],
};
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const kept = (folder: string): string[] => readdirSync(new URL(`../../${folder}/results/`, import.meta.url));

describe("the data stamp of the page", () => {
  it("names each run of the data once, as a fixed study", () => {
    const [stamp, ...others] = siteDataStamps(data).pages;
    expect(others).toEqual([]);
    expect(stamp?.page).toBe("index.html");
    expect(stamp?.study).toBe(true);
    expect(stamp?.runs.map((run) => run.id).sort()).toEqual(Object.keys(KEPT_RUNS).sort());
  });

  it("stops the build when the data names a run with no line in the list", () => {
    const newer = { ...data, census: { ...data.census, packing: { census: "1" } } };
    expect(() => siteDataStamps(newer)).toThrow("The data names the run 1");
  });

  it("has the bench run that the page links to, on the day of its kept folder", () => {
    expect(page).toContain(`The raw records of run ${BENCH_RUN}`);
    expect(page).toContain(`evaluator-bench/results/${KEPT_RUNS[BENCH_RUN]?.date}"`);
    expect(kept("evaluator-bench")).toContain(KEPT_RUNS[BENCH_RUN]?.date);
  });

  it("has the day of each census of the kept folders", () => {
    const folders = kept("predicate-census");
    expect(folders).toContain(`${KEPT_RUNS[data.census.highways.census]?.date}-highways`);
    expect(folders).toContain(`${KEPT_RUNS[data.census.packing.census]?.date}-packing`);
  });

  it("has the mark of the stamp in the page", () => {
    expect(page).toContain("<!-- data-stamp -->");
  });
});
