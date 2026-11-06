/**
 * The command line of the monthly study. The workflow `.github/workflows/study-monthly.yml` starts it.
 *
 *   node packages/site/src/study-cli.ts float-wrong <report.records.jsonl> <float-wrong.jsonl.gz>
 *   node packages/site/src/study-cli.ts refresh --artifacts <dir> --run <id> --started <iso> --commit <sha>
 *     --highways-dump <id> --sets <json list> --packing-dump <id> --packing-set <set>
 *
 * The folder of `--artifacts` has one folder for each artifact of the run: `census-kept-<set>` and `a6-bench`.
 *
 * @packageDocumentation
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { refresh, writeFloatWrong } from "./study.ts";

const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const [command, ...rest] = process.argv.slice(2);

if (command === "float-wrong") {
  const [records, out] = rest;
  if (records === undefined || out === undefined) throw new Error("Usage: float-wrong <report.records.jsonl> <float-wrong.jsonl.gz>");
  const count = await writeFloatWrong(records, out);
  console.log(`${count} float-wrong records in ${out}`);
} else if (command === "refresh") {
  const { values } = parseArgs({
    args: rest,
    options: {
      artifacts: { type: "string" },
      run: { type: "string" },
      started: { type: "string" },
      commit: { type: "string" },
      "highways-dump": { type: "string" },
      sets: { type: "string" },
      "packing-dump": { type: "string" },
      "packing-set": { type: "string" },
    },
    strict: true,
  });
  const need = (name: keyof typeof values): string => {
    const value = values[name];
    if (value === undefined || value === "") throw new Error(`refresh needs --${name}.`);
    return value;
  };
  const artifacts = need("artifacts");
  const sets = JSON.parse(need("sets")) as string[];
  const packingSet = need("packing-set");
  const kept = refresh({
    root,
    run: { id: need("run"), started: need("started"), commit: need("commit") },
    highways: { dump: need("highways-dump"), sets: sets.map((set) => ({ set, dir: join(artifacts, `census-kept-${set}`) })) },
    packing: { dump: need("packing-dump"), set: packingSet, dir: join(artifacts, `census-kept-${packingSet}`) },
    bench: join(artifacts, "a6-bench"),
  });
  console.log(JSON.stringify(kept, null, 2));
} else {
  throw new Error(`Unknown command ${String(command)}. The commands are float-wrong and refresh.`);
}
