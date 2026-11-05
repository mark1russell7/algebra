/**
 * The command line of the census: `node src/cli.ts <file or folder>... [--out <report.json>] [--highways <tree>]`. It
 * reads each `.jsonl` file. With `--highways`, it examines the lines of highways that `CALL_SITE_RULES` copies. A copy
 * that is not current stops the census with exit code 3 only when a line of the dump uses that copy.
 * Without `--out`, it writes the report as JSON to the standard output.
 *
 * With `--out`, it writes each record as one line of `<report>.records.jsonl` and each unknown line to
 * `<report>.unknown.jsonl`. The report file then has the counts and the names of the two files. Thus a dump of several
 * GB gives no string that is too long for JSON.
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRuleSources } from "./predicates.ts";
import { censusOfFiles } from "./report.ts";

const USAGE = "Usage: node src/cli.ts <file or folder>... [--out <report.json>] [--highways <highways tree>]";
const args = process.argv.slice(2);
const options = new Map<string, string | undefined>();
const inputs: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--out" || a === "--highways") options.set(a, args[++i]);
  else inputs.push(a);
}
const out = options.get("--out");
const highways = options.get("--highways");
if (inputs.length === 0 || [...options.values()].includes(undefined)) {
  console.error(USAGE);
  process.exit(2);
}

// The rules of the call sites are copies of lines of highways. A line with the field rule (highways #258) does not use them.
const ruleSources =
  highways === undefined
    ? undefined
    : checkRuleSources((file) => {
        const p = path.join(highways, file);
        return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      });
for (const c of ruleSources ?? []) {
  if (!c.holds) console.error(`Warning: the rule of ${c.fn} copies ${c.file}:${c.line}, but highways no longer has that line.`);
  else if (c.foundAt !== c.line) console.error(`Warning: the line of the rule of ${c.fn} moved from ${c.file}:${c.line} to line ${c.foundAt}.`);
}
const repo = path.dirname(fileURLToPath(import.meta.url));

/** This function stops the census with exit code 3 when a line used a copy of a rule that is not current. */
function stopOnStaleCopy(copyUses: Readonly<Record<string, number>>): void {
  const stale = (ruleSources ?? []).filter((c) => !c.holds && (copyUses[c.fn] ?? 0) > 0);
  for (const c of stale) console.error(`${copyUses[c.fn]} lines of ${c.fn} use the copy of ${c.file}:${c.line}, and highways no longer has that line.`);
  if (stale.length > 0) process.exit(3);
}

/** This function stops the command with exit code 4 when the census did not score each line, after it wrote the report. */
function stopOnUnknown(unknown: number): void {
  if (unknown === 0) return;
  console.error(`The census did not score ${unknown} unknown lines, so its totals are not complete.`);
  process.exit(4);
}

/** A file that gets one JSON line for each value, with a buffer of writes. */
class Lines {
  readonly path: string;
  readonly #fd: number;
  #parts: string[] = [];
  #size = 0;
  count = 0;

  constructor(file: string) {
    this.path = file;
    this.#fd = fs.openSync(file, "w");
  }

  add(value: unknown): void {
    const text = JSON.stringify(value) + "\n";
    this.#parts.push(text);
    this.#size += text.length;
    this.count++;
    if (this.#size > 1 << 22) this.flush();
  }

  flush(): void {
    if (this.#parts.length > 0) fs.writeSync(this.#fd, this.#parts.join(""));
    this.#parts = [];
    this.#size = 0;
  }

  close(): void {
    this.flush();
    fs.closeSync(this.#fd);
  }
}

if (out === undefined) {
  const report = censusOfFiles(inputs, repo);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  stopOnStaleCopy(report.copyUses);
  stopOnUnknown(report.totals.unknown);
} else {
  const stem = out.endsWith(".json") ? out.slice(0, -".json".length) : out;
  const records = new Lines(`${stem}.records.jsonl`);
  const unknown = new Lines(`${stem}.unknown.jsonl`);
  const report = censusOfFiles(inputs, repo, { onRecord: (r) => records.add(r), onUnknown: (r) => unknown.add(r) });
  records.close();
  unknown.close();
  const rest = Object.fromEntries(Object.entries(report).filter(([key]) => key !== "records" && key !== "unknown"));
  const files = { records: path.basename(records.path), recordCount: records.count, unknown: path.basename(unknown.path), unknownCount: unknown.count };
  fs.writeFileSync(out, JSON.stringify({ ...rest, ruleSources, recordFiles: files }, null, 2) + "\n");
  const t = report.totals;
  console.error(
    `${report.files.length} files: total ${t.total}, undecided ${t.undecided} (${t.undecidedFiltered} with the filter), ` +
      `floatWrong ${t.floatWrong}, unseen ${t.unseen}, unknown ${t.unknown}. Report: ${out}, ${records.count} records.`,
  );
  const c = report.floatWrongClasses;
  console.error(
    `Classes of the float-wrong tests: 1 = ${c["1"].tests}, 2 = ${c["2"].tests}, 3 = ${c["3"].tests}, 4 = ${c["4"].tests}. Sites: ${JSON.stringify(report.floatWrongSites)}`,
  );
  stopOnStaleCopy(report.copyUses);
  stopOnUnknown(report.totals.unknown);
}
