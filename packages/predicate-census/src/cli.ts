/**
 * The command line of the census: `node src/cli.ts <file or folder>... [--out <report.json>]`. It reads each `.jsonl`
 * file and writes the report as JSON to the standard output or to the file of `--out`.
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { censusOfFiles } from "./report.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--out");
const out = at === -1 ? undefined : args[at + 1];
const inputs = at === -1 ? args : args.filter((_, i) => i !== at && i !== at + 1);
if (inputs.length === 0 || (at !== -1 && out === undefined)) {
  console.error("Usage: node src/cli.ts <file or folder>... [--out <report.json>]");
  process.exit(2);
}
const report = censusOfFiles(inputs, path.dirname(fileURLToPath(import.meta.url)));
const text = JSON.stringify(report, null, 2) + "\n";
if (out === undefined) {
  process.stdout.write(text);
} else {
  fs.writeFileSync(out, text);
  const t = report.totals;
  console.error(
    `${report.files.length} files: total ${t.total}, undecided ${t.undecided} (${t.undecidedFiltered} with the filter), ` +
      `floatWrong ${t.floatWrong}, unseen ${t.unseen}, unknown ${t.unknown}. Report: ${out}`,
  );
}
