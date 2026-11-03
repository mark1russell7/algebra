/**
 * The bench of the time claim of A3: `node src/bench.ts --out <folder> [--rounds 31] [--ms 10] [--cases a,b]`. It
 * writes the written functions of the corpus to `written.mjs`. For each case, it starts a fresh process with the pair
 * `ab` and a fresh process with the A/A pair `aa`. It writes the raw records to `records-ab.jsonl` and
 * `records-aa.jsonl`, the facts of each process to `meta.jsonl`, and the report to `report.json` and `report.md`. The
 * workflow `bench-expression.yml` starts it in CI. Do not start a full run locally.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpus } from "@algebra/expression-corpus";
import type { PairedTime } from "@mark1russell7/rigor-bench";
import { markdown, report } from "./report.ts";
import { writtenModule } from "./source.ts";

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

const cases = corpus();
const names = option("--cases")?.split(",") ?? cases.map((c) => c.name);
const written = path.resolve(out, "written.mjs");
fs.writeFileSync(written, writtenModule(cases));

const child = path.join(path.dirname(fileURLToPath(import.meta.url)), "child.ts");
const records: Record<"ab" | "aa", PairedTime[]> = { ab: [], aa: [] };
const meta: unknown[] = [];
for (const [index, name] of names.entries()) {
  for (const pair of ["ab", "aa"] as const) {
    const result = spawnSync(process.execPath, [child, name, pair, rounds, String(index), ms, written], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`the process of ${name} ${pair} failed: ${result.stderr}`);
    for (const line of result.stdout.trim().split("\n")) {
      const value = JSON.parse(line) as PairedTime | { meta: unknown };
      if ("meta" in value) meta.push(value.meta);
      else records[pair].push(value);
    }
    console.error(`${name} ${pair}: done`);
  }
}

const jsonl = (rows: readonly unknown[]): string => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
fs.writeFileSync(path.join(out, "records-ab.jsonl"), jsonl(records.ab));
fs.writeFileSync(path.join(out, "records-aa.jsonl"), jsonl(records.aa));
fs.writeFileSync(path.join(out, "meta.jsonl"), jsonl(meta));
const result = report(records.ab, records.aa);
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(result, null, 2) + "\n");
fs.writeFileSync(path.join(out, "report.md"), markdown(result));
console.log(markdown(result));
