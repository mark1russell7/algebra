/**
 * The bench of A8: `node src/bench.ts --out <folder> [--rounds 31] [--ms 10] [--cases a,b]`. It writes one claim record
 * for each case, verb and tier to `claims.jsonl`, with the losers. Then it starts a fresh process for each case and pair.
 * It writes the raw records to `records-<pair>.jsonl`, and the facts of each process to `meta.jsonl`. It writes the
 * report to `report.json` and `report.md`.
 *
 * The workflow `bench-polynomial.yml` starts it in CI. Do not start a full run locally.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gateLine, jobModels, type PairedTime, writeGateLine } from "@mark1russell7/rigor-bench";
import { benchEnv } from "@mark1russell7/rigor-bench/fresh";
import { pairsOf } from "./arms.ts";
import type { PairName } from "./arms.ts";
import { benchCase, caseNames, familyOf, isRootFamily } from "./cases.ts";
import { claimRecords } from "./claims.ts";
import { checkReads, markdown, type Meta, report, type Report } from "./report.ts";

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

const names = option("--cases")?.split(",") ?? caseNames();

// The claim records name the cases that a form holds, and only these cases get a timed pair.
fs.writeFileSync(path.join(out, "claims.jsonl"), "");
const claims = names.flatMap((name) => {
  const rows = claimRecords(benchCase(name));
  fs.appendFileSync(path.join(out, "claims.jsonl"), rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  console.error(`${name}: ${rows.length} claim records`);
  return rows;
});

const timed = (name: string): boolean => {
  const [verb, kind] = isRootFamily(familyOf(name)) ? ["solve", "roots"] : ["rational", "rational"];
  return claims.some((c) => c.case === name && c.tier === "default" && c.verb === verb && c.kind === kind);
};
const skipped: Report["skipped"] = names.filter((name) => !timed(name)).map((name) => ({ case: name, reason: "The case has no form or no roots at the default limits, so its arms have no work to compare." }));

const child = path.join(path.dirname(fileURLToPath(import.meta.url)), "child.ts");
const pairs: readonly PairName[] = ["verbs", "points-1", "points-64", "equal", "solve", "aa"];
const records: Record<string, PairedTime[]> = Object.fromEntries(pairs.map((p) => [p, []]));
const metas: Meta[] = [];
// The bench appends the records of each process at once, so a run that stops keeps the records before it.
for (const pair of pairs) fs.writeFileSync(path.join(out, `records-${pair}.jsonl`), "");
fs.writeFileSync(path.join(out, "meta.jsonl"), "");
for (const [index, name] of names.filter(timed).entries()) {
  for (const pair of pairsOf(familyOf(name))) {
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

const result = report(records, metas, claims, skipped);
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(result, null, 2) + "\n");
fs.writeFileSync(path.join(out, "report.md"), markdown(result));
console.log(markdown(result));
// A no-read is not a pass: the check of the run shows each pair and family that cannot decide.
writeGateLine(gateLine(checkReads(result), { title: "bench-polynomial", models: jobModels([benchEnv()]) }));
