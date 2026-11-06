// The data stamp of the page. The measured numbers of the page are a cost of the current code: the workflow
// study-monthly.yml measures them again each month (study.ts). The data files name their runs, and the file
// data/kept-runs.json gives the facts of each run. So a run with no line in that file stops the build.
import type { KeptRun, KeptRuns } from "./study.ts";

/** The address of a run of a workflow of this repository. */
const RUNS = "https://github.com/mark1russell7/algebra/actions/runs/";

/** The workflow that measures the data again. */
export const STUDY_WORKFLOW = ".github/workflows/study-monthly.yml";

/**
 * The age limit of the data, in days. The largest gap of the monthly schedule is 31 days, and the run and its merge
 * take 2 days.
 */
export const STUDY_LIMIT_DAYS = 33;

/** The reason of the limit, in plain words. The stamp line of the page shows it. */
export const STUDY_LIMIT_REASON = "The workflow study-monthly.yml measures the census and the bench again on day 4 of each month.";

/** The review that accepted the limit. */
export const STUDY_RULING = "https://github.com/mark1russell7/algebra/pull/112";

/** The time at which the age rule starts: at most the last start that the freshness gate accepts. */
export const STUDY_STARTS_AT = "2026-12-07T00:00:00Z";

/** The fields of the data files that name the runs. */
export interface StampData {
  readonly census: { readonly highways: { readonly census: string }; readonly packing: { readonly census: string } };
  readonly nearMisses: { readonly records: readonly { readonly source: { readonly census: string } }[] };
  readonly kept: Pick<KeptRuns, "bench" | "runs">;
}

/** One run of the stamp. */
export interface StampRun extends KeptRun {
  readonly id: string;
  readonly url: string;
}

/** The stamp of the page. */
export interface PageStamp {
  readonly page: string;
  readonly limit: { readonly days: number; readonly reason: string; readonly workflow: string; readonly ruling: string; readonly startsAt: string };
  readonly runs: readonly StampRun[];
}

/** This function gives the line of the stamp for one run. A run with no line in `data/kept-runs.json` stops the build. */
function stampRun(id: string, runs: Readonly<Record<string, KeptRun>>): StampRun {
  const run = runs[id];
  if (run === undefined) throw new Error(`The data names the run ${id}, and data/kept-runs.json has no line for it.`);
  return { id, url: `${RUNS}${id}`, date: run.date, engines: run.engines, commit: run.commit };
}

/** This function gives the stamps of the site, from the runs that its data files name. */
export function siteDataStamps(data: StampData): { schema: "data-stamp/1"; pages: PageStamp[] } {
  const named = [data.kept.bench.run, data.census.highways.census, data.census.packing.census, ...data.nearMisses.records.map((record) => record.source.census)];
  return {
    schema: "data-stamp/1",
    pages: [
      {
        page: "index.html",
        limit: { days: STUDY_LIMIT_DAYS, reason: STUDY_LIMIT_REASON, workflow: STUDY_WORKFLOW, ruling: STUDY_RULING, startsAt: STUDY_STARTS_AT },
        runs: [...new Set(named)].map((id) => stampRun(id, data.kept.runs)),
      },
    ],
  };
}
