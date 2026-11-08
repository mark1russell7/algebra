/**
 * The bench of A7: `node src/bench.ts --out <folder> [--rounds 31] [--ms 10] [--cases a,b] [--precisions 64,128] [--limit 4096]`.
 * For each pair, it starts a fresh process for each case. The pairs are each precision of the verb `bigfloat` and the
 * stage against the verbs `exact` and `interval`, and the A/A pair.
 *
 * It writes the raw records to `records-<pair>.jsonl` and the facts of each process to `meta.jsonl`. It writes the error
 * records of the stage to `errors.jsonl`, the facts for a cost model to `model.json`, and the report to `report.json` and
 * `report.md`. The workflow `bench-bigfloat.yml` starts it in CI. Do not start a full run locally.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpusCaseOf } from "@algebra/evaluator-bench";
import type { Meta } from "@algebra/evaluator-bench";
import { corpus } from "@algebra/expression-corpus";
import { gateLine, jobModels, type PairedTime, writeGateLine } from "@mark1russell7/rigor-bench";
import { benchEnv } from "@mark1russell7/rigor-bench/fresh";
import { LIMIT, pairNames, PRECISIONS } from "./arms.ts";
import { stageRecords } from "./errors.ts";
import { checkReads, markdown, report } from "./report.ts";

const USAGE = "Usage: node src/bench.ts --out <folder> [--rounds 31] [--ms 10] [--cases <name,name>] [--precisions <bits,bits>] [--limit 4096]";
const args = process.argv.slice(2);
const option = (key: string, fallback?: string): string | undefined => {
  const i = args.indexOf(key);
  return i === -1 ? fallback : args[i + 1];
};
const out = option("--out");
const rounds = option("--rounds", "31")!;
const ms = option("--ms", "10")!;
const limit = Number(option("--limit", String(LIMIT)));
const precisions = option("--precisions")?.split(",").map(Number) ?? PRECISIONS;
if (out === undefined || !Number.isSafeInteger(limit) || precisions.some((p) => !Number.isSafeInteger(p) || p < 1)) {
  console.error(USAGE);
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const names = option("--cases")?.split(",") ?? corpus().map((c) => c.name);
const pairs = pairNames(precisions);
const jsonl = (rows: readonly unknown[]): string => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

// The error records need no timing, so this process computes them before the timed processes.
const errors = names.flatMap((name) => stageRecords(corpusCaseOf(name), limit));
fs.writeFileSync(path.join(out, "errors.jsonl"), jsonl(errors));
console.error(`errors: ${errors.length} records`);

const child = path.join(path.dirname(fileURLToPath(import.meta.url)), "child.ts");
const records: Record<string, PairedTime[]> = {};
const metas: Meta[] = [];
// The bench appends the records of each process at once, so a run that stops keeps the records before it.
for (const pair of pairs) fs.writeFileSync(path.join(out, `records-${pair}.jsonl`), "");
fs.writeFileSync(path.join(out, "meta.jsonl"), "");

/** This function writes the report of the pairs so far. A run that stops keeps the report of its last whole pair. */
function writeReport(): void {
  const result = report(records, metas, errors, limit);
  fs.writeFileSync(path.join(out as string, "model.json"), JSON.stringify(result.model, null, 2) + "\n");
  fs.writeFileSync(path.join(out as string, "report.json"), JSON.stringify(result, null, 2) + "\n");
  fs.writeFileSync(path.join(out as string, "report.md"), markdown(result));
}

for (const pair of pairs) {
  records[pair] = [];
  for (const [index, name] of names.entries()) {
    const result = spawnSync(process.execPath, [child, name, pair, rounds, String(index), ms, String(limit)], { encoding: "utf8", maxBuffer: 1 << 26 });
    if (result.status !== 0) throw new Error(`the process of ${name} ${pair} failed: ${result.stderr}`);
    for (const line of result.stdout.trim().split("\n")) {
      const value = JSON.parse(line) as PairedTime | { meta: Meta };
      if ("meta" in value) metas.push(value.meta);
      else records[pair].push(value);
      fs.appendFileSync(path.join(out, "meta" in value ? "meta.jsonl" : `records-${pair}.jsonl`), line + "\n");
    }
  }
  console.error(`${pair}: done`);
  writeReport();
}
const final = report(records, metas, errors, limit);
console.log(markdown(final));
// A no-read is not a pass: the check of the run shows each pair that cannot decide.
writeGateLine(gateLine(checkReads(final), { title: "bench-bigfloat", models: jobModels([benchEnv()]) }));
