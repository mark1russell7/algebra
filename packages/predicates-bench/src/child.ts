/**
 * One process of the bench: `node src/child.ts <case> <pair> <rounds> <offset> <ms>`. It times one case with one pair
 * with `timeRounds` of `@mark1russell7/rigor-bench`, and writes each `PairedTime` record on a line of the standard output.
 * The last line is the facts of the process, as JSON with the key `meta`.
 *
 * The pair `ab` has `robust-predicates` in arm `a` and `@mark1russell7/predicates` in arm `b`. The pair `aa` has
 * `robust-predicates` in the two arms: it is the A/A pair. Each arm gets its own instance of the module of the cases.
 *
 * @packageDocumentation
 */
import os from "node:os";
import { type Arm, timeRounds } from "@mark1russell7/rigor-bench";
import { predicates, robust } from "./arms.ts";
import type { Case, Signs } from "./cases.ts";

const [name, pair, roundsText, offsetText, msText] = process.argv.slice(2);
const rounds = Number(roundsText);
const offset = Number(offsetText);
const targetMs = Number(msText);
if (name === undefined || (pair !== "ab" && pair !== "aa") || !(rounds > 0) || !Number.isSafeInteger(offset) || !(targetMs > 0)) {
  console.error("Usage: node src/child.ts <case> <ab | aa> <rounds> <offset> <ms>");
  process.exit(2);
}

type Module = { casesFor: (S: Signs) => Case[] };
const instance = async (arm: Arm, S: Signs): Promise<Case> => {
  // The query gives a new instance of the module, with its own functions.
  const module = (await import(`./cases.ts?arm=${arm}`)) as Module;
  const found = module.casesFor(S).find((c) => c.name === name);
  if (found === undefined) throw new Error(`no case ${name}`);
  return found;
};
const arms: Record<Arm, Case> = { a: await instance("a", robust), b: await instance("b", pair === "ab" ? predicates : robust) };
if (arms.a.run() !== arms.b.run()) throw new Error(`the two arms of ${name} give different signs`);

const result = timeRounds({ a: arms.a.run, b: arms.b.run }, { case: name, rounds, offset, targetMs });
for (const record of result.records) console.log(JSON.stringify(record));
const cpu = os.cpus()[0]?.model.trim() ?? "unknown";
console.log(JSON.stringify({ meta: { case: name, pair, rounds, offset, count: result.count, targetMs, cpu, node: process.version, sink: result.sink } }));
