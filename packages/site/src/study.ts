/**
 * The monthly study of the site (`.github/workflows/study-monthly.yml`). One run of the workflow starts the census of
 * highways, the census of packing and the evaluator bench at one commit. This module turns the artifacts of that run
 * into the data files of the page and the kept folders of the results.
 *
 * @packageDocumentation
 */
import { copyFileSync, createReadStream, createWriteStream, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGzip, gunzipSync, gzipSync } from "node:zlib";
import { PREDICATES } from "./census.ts";
import type { CensusFile, CensusSet, CensusSite, ClassId } from "./census-view.ts";
import type { Flip, NearMiss, NearMissFile } from "./presets.ts";

/** One sign of a record of the census. */
export interface KeptSign {
  readonly name: string;
  readonly exactSign: -1 | 0 | 1;
  readonly floatSign: -1 | 0 | 1;
  readonly bounds: readonly [number, number];
}

/** One record of the census, as the file `report-<set>.records.jsonl` keeps it. */
export interface KeptRecord {
  readonly line: number;
  readonly case: string;
  readonly fn: string;
  readonly n: number;
  readonly predicate: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly signs: readonly KeptSign[];
  readonly floatWrong?: boolean;
  readonly floatAnswer: boolean | -1 | 0 | 1;
  readonly exactAnswer: boolean | -1 | 0 | 1;
}

/** The fields of a report of the census that the page uses. A report with no float-wrong test has no classes and no sites. */
export interface CensusReport {
  readonly commit: string;
  readonly dirty: boolean | null;
  readonly totals: { readonly total: number; readonly undecided: number; readonly floatWrong: number };
  readonly floatWrongClasses?: Readonly<Record<ClassId, { readonly tests: number }>>;
  readonly floatWrongSites?: Readonly<Record<string, number>>;
}

/** One run of the data of the page. */
export interface KeptRun {
  /** The ISO time of the start of the run. */
  readonly date: string;
  /** The full commit of the code of the run. */
  readonly commit: string;
  /** The versions of the packages that measured. */
  readonly engines: Readonly<Record<string, string>>;
}

/** The file `data/kept-runs.json`: the runs of the data, and the kept folders of the results. */
export interface KeptRuns {
  /** The run of the evaluator bench, and its folder in `packages/evaluator-bench/results/`. */
  readonly bench: { readonly run: string; readonly folder: string };
  /** The folders of the census in `packages/predicate-census/results/`. */
  readonly census: { readonly highways: string; readonly packing: string };
  /** Each run that a data file names. */
  readonly runs: Readonly<Record<string, KeptRun>>;
}

/** The predicates that the explorer can show, and the fields of their inputs. */
export const NEAR_MISS_INPUTS: Readonly<Record<NearMiss["predicate"], readonly string[]>> = {
  segmentPair: ["a", "b", "c", "d"],
  segmentBox: ["a", "b", "box", "eps"],
  pointSide: ["p", "a", "b"],
};

/** The rule of the selection, in plain words. The note of the file and the docs give it. */
export const NEAR_MISS_RULE =
  "For each set and source line of the call, the file keeps the float-wrong record with the most tests, and the lowest line on a tie.";

/** This function tells if a line of the census is a float-wrong record. */
export function isFloatWrong(line: string): boolean {
  if (!line.includes('"floatWrong"')) return false;
  return (JSON.parse(line) as { floatWrong?: unknown }).floatWrong === true;
}

/**
 * This function writes the float-wrong records of a file of records to a gzip file. It writes one record on each line, in the
 * order of the file. It reads the file one line at a time, so a file larger than the memory works.
 *
 * @returns The count of the records that it wrote.
 */
export async function writeFloatWrong(records: string, out: string): Promise<number> {
  let count = 0;
  const lines = createInterface({ input: createReadStream(records, "utf8"), crlfDelay: Infinity });
  async function* kept(): AsyncGenerator<string> {
    for await (const line of lines) {
      if (isFloatWrong(line)) {
        count += 1;
        yield `${line}\n`;
      }
    }
  }
  await pipeline(Readable.from(kept()), createGzip(), createWriteStream(out));
  return count;
}

/** This function reads the records of a gzip file of JSON lines. */
export function readRecords(file: string): KeptRecord[] {
  const text = gunzipSync(readFileSync(file)).toString("utf8").trim();
  return text === "" ? [] : text.split("\n").map((line) => JSON.parse(line) as KeptRecord);
}

/** This function gives the signs of a record whose float sign is not the exact sign. */
function flipsOf(record: KeptRecord): Flip[] {
  return record.signs.filter((s) => s.floatSign !== s.exactSign).map(({ name, exactSign, floatSign, bounds }) => ({ name, exactSign, floatSign, bounds }));
}

function viaOf(record: KeptRecord): string {
  const via = record.input["via"];
  return typeof via === "string" ? via : "";
}

const isShown = (predicate: string): predicate is NearMiss["predicate"] => Object.hasOwn(NEAR_MISS_INPUTS, predicate);

/**
 * This function selects the near misses of the explorer from the float-wrong records of each set, by `NEAR_MISS_RULE`.
 * A record counts when the explorer can show its predicate and at least one of its signs flips. A class 4 record has no
 * sign that flips, so it does not count.
 *
 * @param sets - The float-wrong records of each set, in the order of the sets on the page.
 * @param source - The census run and the dump run of the records.
 * @returns The records, by set, then by function and source line of the call.
 * @throws {Error} A sign that flips has a name that its predicate does not have.
 */
export function selectNearMisses(sets: readonly { readonly set: string; readonly records: readonly KeptRecord[] }[], source: { readonly census: string; readonly dump: string }): NearMiss[] {
  const out: NearMiss[] = [];
  for (const { set, records } of sets) {
    const best = new Map<string, KeptRecord>();
    for (const record of records) {
      if (record.floatWrong !== true || !isShown(record.predicate) || flipsOf(record).length === 0) continue;
      const key = `${record.fn}\u0000${viaOf(record)}`;
      const held = best.get(key);
      if (held === undefined || record.n > held.n || (record.n === held.n && record.line < held.line)) best.set(key, record);
    }
    const chosen = [...best.values()].sort((x, y) => (x.fn === y.fn ? (viaOf(x) < viaOf(y) ? -1 : 1) : x.fn < y.fn ? -1 : 1));
    for (const record of chosen) {
      const predicate = record.predicate as NearMiss["predicate"];
      const flips = flipsOf(record);
      const names = new Set(PREDICATES[predicate].signs.map((s) => s.name));
      for (const flip of flips) {
        if (!names.has(flip.name)) throw new Error(`The record of line ${record.line} of ${set} has the sign ${flip.name}, but ${predicate} has no such sign.`);
      }
      const input = Object.fromEntries(NEAR_MISS_INPUTS[predicate].filter((k) => k in record.input).map((k) => [k, record.input[k]]));
      out.push({
        set,
        case: record.case,
        fn: record.fn,
        via: viaOf(record),
        weight: record.n,
        predicate,
        input,
        floatAnswer: record.floatAnswer,
        exactAnswer: record.exactAnswer,
        flips,
        source: { census: source.census, dump: source.dump, line: record.line },
      });
    }
  }
  return out;
}

/** This function gives the file of the near misses, with its note of provenance. */
export function nearMissFile(records: readonly NearMiss[], source: { readonly census: string; readonly dump: string }): NearMissFile {
  return {
    note: `Real float-wrong inputs of the census run ${source.census} of the highways dump run ${source.dump}. ${NEAR_MISS_RULE} Each record has at least one sign where float and exact differ.`,
    records,
  };
}

const CLASS_IDS: readonly ClassId[] = [1, 2, 3, 4];

/** This function gives the counts of one set from its report. */
export function censusSet(set: string, report: CensusReport): CensusSet {
  const counts = report.floatWrongClasses;
  if (counts === undefined && report.totals.floatWrong > 0) throw new Error(`The report of ${set} has float-wrong tests and no classes.`);
  const classes = Object.fromEntries(CLASS_IDS.map((id) => [id, counts?.[id]?.tests ?? 0])) as Record<ClassId, number>;
  return { set, tests: report.totals.total, undecided: report.totals.undecided, floatWrong: report.totals.floatWrong, classes };
}

/** This function gives the float-wrong tests of each source line of the call over the sets: by class, then the most tests first. */
export function censusSites(reports: readonly CensusReport[]): CensusSite[] {
  const sums = new Map<string, number>();
  for (const report of reports) for (const [key, n] of Object.entries(report.floatWrongSites ?? {})) sums.set(key, (sums.get(key) ?? 0) + n);
  return [...sums]
    .map(([key, tests]) => {
      const [cls, fn, ...via] = key.split(" ");
      const id = Number(cls);
      if (!CLASS_IDS.includes(id as ClassId) || fn === undefined || via.length === 0) throw new Error(`The site "${key}" is not "<class> <fn> <via>".`);
      return { class: id as ClassId, fn, via: via.join(" "), tests };
    })
    .sort((x, y) => x.class - y.class || y.tests - x.tests || (x.fn + x.via < y.fn + y.via ? -1 : 1));
}

/** This function gives the file `data/census-classes.json` from the reports of one run. */
export function censusFile(
  highways: { readonly census: string; readonly dump: string; readonly reports: readonly { readonly set: string; readonly report: CensusReport }[] },
  packing: { readonly census: string; readonly dump: string; readonly set: string; readonly report: CensusReport },
): CensusFile {
  const p = packing.report.totals;
  return {
    highways: { census: highways.census, dump: highways.dump, sets: highways.reports.map((r) => censusSet(r.set, r.report)), sites: censusSites(highways.reports.map((r) => r.report)) },
    packing: { census: packing.census, dump: packing.dump, set: packing.set, tests: p.total, undecided: p.undecided, floatWrong: p.floatWrong },
  };
}

/** This function stops the refresh when a report is not of the commit of the run, or of a tree with changes. */
export function checkReport(name: string, report: CensusReport, commit: string): void {
  if (report.commit !== commit) throw new Error(`The report ${name} is of the commit ${report.commit}, and the run is of ${commit}.`);
  if (report.dirty !== false) throw new Error(`The report ${name} is of a tree with changes, or of a tree with no git status.`);
}

/** The input of one refresh: the folders of the artifacts of one run of the workflow. */
export interface RefreshInput {
  /** The root of the repository. */
  readonly root: string;
  readonly run: { readonly id: string; readonly started: string; readonly commit: string };
  /** The folder of each set of highways: the artifact `census-kept-<set>`, in the order of the page. */
  readonly highways: { readonly dump: string; readonly sets: readonly { readonly set: string; readonly dir: string }[] };
  /** The folder of the artifact `census-kept-<set>` of packing. */
  readonly packing: { readonly dump: string; readonly set: string; readonly dir: string };
  /** The folder of the artifact `a6-bench`. */
  readonly bench: string;
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

/**
 * This function writes the data files of the page and the kept folders of one run. It removes the kept folders that
 * `data/kept-runs.json` named before, so the repository keeps one run.
 *
 * @returns The new file `data/kept-runs.json`.
 */
export function refresh(input: RefreshInput): KeptRuns {
  const { root, run } = input;
  const day = run.started.slice(0, 10);
  const site = join(root, "packages/site/data");
  const censusRoot = join(root, "packages/predicate-census/results");
  const benchRoot = join(root, "packages/evaluator-bench/results");
  const version = (pkg: string): string => readJson<{ version: string }>(join(root, "packages", pkg, "package.json")).version;

  const highways = input.highways.sets.map(({ set, dir }) => {
    const report = readJson<CensusReport>(join(dir, `report-${set}.json`));
    checkReport(`report-${set}.json`, report, run.commit);
    return { set, dir, report };
  });
  const packingReport = readJson<CensusReport>(join(input.packing.dir, `report-${input.packing.set}.json`));
  checkReport(`report-${input.packing.set}.json`, packingReport, run.commit);
  const source = { census: run.id, dump: input.highways.dump };
  const nearMisses = selectNearMisses(
    highways.map(({ set, dir }) => ({ set, records: readRecords(join(dir, `float-wrong-${set}.jsonl.gz`)) })),
    source,
  );
  if (nearMisses.length === 0) throw new Error("The census gave no record for the explorer.");

  const old = readJson<KeptRuns>(join(site, "kept-runs.json"));
  for (const folder of [join(benchRoot, old.bench.folder), join(censusRoot, old.census.highways), join(censusRoot, old.census.packing)]) {
    rmSync(folder, { recursive: true, force: true });
  }

  const kept: KeptRuns = {
    bench: { run: run.id, folder: day },
    census: { highways: `${day}-highways`, packing: `${day}-packing` },
    runs: {
      [run.id]: {
        date: run.started,
        commit: run.commit,
        engines: { "@algebra/evaluator-select": version("evaluator-select"), "@mark1russell7/predicate-census": version("predicate-census") },
      },
    },
  };

  const hw = join(censusRoot, kept.census.highways);
  mkdirSync(hw, { recursive: true });
  for (const { set, dir } of highways) {
    for (const name of readdirSync(dir)) if (name.endsWith(`-${set}.md`) || name === `time-${set}.txt` || name === `report-${set}.json` || name === `float-wrong-${set}.jsonl.gz`) copyFileSync(join(dir, name), join(hw, name));
  }
  const pk = join(censusRoot, kept.census.packing);
  mkdirSync(pk, { recursive: true });
  writeFileSync(join(pk, `report-${input.packing.set}.json.gz`), gzipSync(readFileSync(join(input.packing.dir, `report-${input.packing.set}.json`))));
  copyFileSync(join(input.packing.dir, `time-${input.packing.set}.txt`), join(pk, `time-${input.packing.set}.txt`));

  const bench = join(benchRoot, day);
  mkdirSync(bench, { recursive: true });
  for (const name of readdirSync(input.bench)) copyFileSync(join(input.bench, name), join(bench, name));

  writeFileSync(join(site, "a6-report.json"), readFileSync(join(input.bench, "report.json")));
  writeFileSync(
    join(site, "census-classes.json"),
    json(censusFile({ census: run.id, dump: input.highways.dump, reports: highways.map(({ set, report }) => ({ set, report })) }, { census: run.id, dump: input.packing.dump, set: input.packing.set, report: packingReport })),
  );
  writeFileSync(join(site, "near-misses.json"), json(nearMissFile(nearMisses, source)));
  writeFileSync(join(site, "kept-runs.json"), json(kept));
  return kept;
}
