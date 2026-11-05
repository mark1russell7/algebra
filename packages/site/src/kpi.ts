// The numbers of the file `kpi.json` of the site. Each value comes from the kept run of the evaluator bench.
// So no reader copies a number from a page, and no number has a person as its source.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The name of the project in the file. */
export const KPI_PROJECT = "algebra";

/** The name of a folder of a kept run: the day of the run. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** This function gives the newest kept run from the names of the folders. Other names do not count. */
export function newestRun(folders: readonly string[]): string {
  const newest = folders
    .filter((name) => DAY.test(name))
    .sort()
    .at(-1);
  if (newest === undefined) throw new Error("The evaluator bench has no kept run, so kpi.json has no time of the data.");
  return newest;
}

/** This function gives the input of the file, from the folder of the kept runs. The time of the data is the day of the run. */
export function siteKpiInput(resultsDir: string): { project: string; at: string; measures: { id: string; value: number; unit: string }[] } {
  const run = newestRun(readdirSync(resultsDir));
  const model = JSON.parse(readFileSync(join(resultsDir, run, "model.json"), "utf8")) as { readonly cost: Readonly<Record<string, number>> };
  return { project: KPI_PROJECT, at: `${run}T00:00:00.000Z`, measures: [{ id: "evaluators-priced", value: Object.keys(model.cost).length, unit: "evaluators" }] };
}
