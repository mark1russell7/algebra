/**
 * The bench of A6: `node src/bench.ts --out <folder> [--rounds 31] [--ms 10] [--cases a,b]`. For each case, it starts
 * a fresh process for each pair: each fixed stage against the stitched plan, and the A/A pair. It writes the raw
 * records to `records-<pair>.jsonl` and the facts of each process to `meta.jsonl`. It writes the error records to
 * `errors.jsonl`, the cost model to `model.json`, and the report to `report.json` and `report.md`. The workflow `bench-select.yml`
 * starts it in CI. Do not start a full run locally.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpus } from "@algebra/expression-corpus";
import { STAGES } from "@algebra/evaluator-select";
import { gateLine, jobModels, type PairedTime, writeGateLine } from "@mark1russell7/rigor-bench";
import { benchEnv } from "@mark1russell7/rigor-bench/fresh";
import { corpusCaseOf } from "./arms.ts";
import { type ErrorRecord, errorRecords } from "./errors.ts";
import { checkReads, markdown, type Meta, report } from "./report.ts";

const USAGE = "Usage: node src/bench.ts --out <folder> [--rounds 31] [--ms 10] [--cases <name,name>]";
const args = process.argv.slice(2);
const option = (key: string, fallback?: string): string | undefined => {
  const i = args.indexOf(key);
  return i === -1 ? fallback : args[i + 1];
};
const out = option("--out");
const rounds = option("--rounds", "31")!;
const ms = option("--ms", "10")!;
if (out === undefined) {
  console.error(USAGE);
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const names = option("--cases")?.split(",") ?? corpus().map((c) => c.name);
const jsonl = (rows: readonly unknown[]): string => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

// The error records need no timing, so this process computes them before the timed processes.
const errors: ErrorRecord[] = names.flatMap((name) => errorRecords(corpusCaseOf(name)));
fs.writeFileSync(path.join(out, "errors.jsonl"), jsonl(errors));
console.error(`errors: ${errors.length} records`);

const child = path.join(path.dirname(fileURLToPath(import.meta.url)), "child.ts");
const pairs = [...STAGES, "aa"] as const;
const records: Record<string, PairedTime[]> = Object.fromEntries(pairs.map((p) => [p, []]));
const metas: Meta[] = [];
// The bench appends the records of each process at once, so a run that stops keeps the records before it.
for (const pair of pairs) fs.writeFileSync(path.join(out, `records-${pair}.jsonl`), "");
fs.writeFileSync(path.join(out, "meta.jsonl"), "");
for (const [index, name] of names.entries()) {
  for (const pair of pairs) {
    const result = spawnSync(process.execPath, [child, name, pair, rounds, String(index), ms], { encoding: "utf8", maxBuffer: 1 << 26 });
    if (result.status !== 0) throw new Error(`the process of ${name} ${pair} failed: ${result.stderr}`);
    for (const line of result.stdout.trim().split("\n")) {
      const value = JSON.parse(line) as PairedTime | { meta: Meta };
      if ("meta" in value) metas.push(value.meta);
      else records[pair]!.push(value);
      fs.appendFileSync(path.join(out, "meta" in value ? "meta.jsonl" : `records-${pair}.jsonl`), line + "\n");
    }
    console.error(`${name} ${pair}: done`);
  }
}

const result = report(records, metas, errors);
fs.writeFileSync(path.join(out, "model.json"), JSON.stringify(result.model, null, 2) + "\n");
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(result, null, 2) + "\n");
fs.writeFileSync(path.join(out, "report.md"), markdown(result));
console.log(markdown(result));
// A no-read is not a pass: the check of the run shows each stage and family that cannot decide.
writeGateLine(gateLine(checkReads(result), { title: "bench-select", models: jobModels([benchEnv()]) }));
