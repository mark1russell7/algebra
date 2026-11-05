// The data stamp of the page. The measured numbers of the page are fixed studies: no workflow starts these runs
// on a schedule, and each run is a big job that a person starts. The data files name their runs, so a new run
// with no line in the list below stops the build, and the stamp cannot tell of an older run than the data.

/** The address of a run of a workflow of this repository. */
const RUNS = "https://github.com/mark1russell7/algebra/actions/runs/";

/** The run of the section "What an answer costs". The page links to it, and a test holds the two together. */
export const BENCH_RUN = "41716746074";

/** The facts of a run: its day, and the version in its commit of the package that it measured. */
interface KeptRun {
  readonly date: string;
  readonly engines: Readonly<Record<string, string>>;
}

/** The kept runs of the page. The versions come from the `package.json` files of the commit of each run. */
export const KEPT_RUNS: Readonly<Record<string, KeptRun>> = {
  [BENCH_RUN]: { date: "2026-11-03", engines: { "@algebra/evaluator-select": "0.1.0" } },
  "41943849500": { date: "2026-11-05", engines: { "@mark1russell7/predicate-census": "0.2.0" } },
  "41897600161": { date: "2026-11-04", engines: { "@mark1russell7/predicate-census": "0.2.0" } },
  "41541049679": { date: "2026-11-02", engines: { "@mark1russell7/predicate-census": "0.2.0" } },
};

/** The fields of the data files that name the runs of the census. */
export interface StampData {
  readonly census: { readonly highways: { readonly census: string }; readonly packing: { readonly census: string } };
  readonly nearMisses: { readonly records: readonly { readonly source: { readonly census: string } }[] };
}

/** This function gives the line of the stamp for one run. A run with no line in `KEPT_RUNS` stops the build. */
function stampRun(id: string): { id: string; url: string; date: string; engines: Readonly<Record<string, string>> } {
  const run = KEPT_RUNS[id];
  if (run === undefined) throw new Error(`The data names the run ${id}, and KEPT_RUNS of stamps.ts has no line for it.`);
  return { id, url: `${RUNS}${id}`, date: run.date, engines: run.engines };
}

/** This function gives the stamps of the site, from the runs that its data files name. */
export function siteDataStamps(data: StampData): {
  schema: "data-stamp/1";
  pages: { page: string; study: true; runs: ReturnType<typeof stampRun>[] }[];
} {
  const named = [BENCH_RUN, data.census.highways.census, data.census.packing.census, ...data.nearMisses.records.map((record) => record.source.census)];
  return { schema: "data-stamp/1", pages: [{ page: "index.html", study: true, runs: [...new Set(named)].map(stampRun) }] };
}
