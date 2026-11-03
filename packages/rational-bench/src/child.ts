/**
 * One process of the bench: `node src/child.ts <case> <pair> <rounds> <offset> <ms>`. It times one case with one pair
 * with `timeRounds` of `@mark1russell7/rigor-bench`, and writes each `PairedTime` record on a line of the standard output.
 * The last line is the facts of the process, as JSON with the key `meta`.
 *
 * The pair `ab` has the old rationals in arm `a` and the new rationals in arm `b`. The pair `aa` has the old rationals
 * in the two arms: it is the A/A pair. Each arm gets its own instance of the module of the cases, so the arms do not
 * share the type feedback of the engine.
 *
 * @packageDocumentation
 */
import os from "node:os";
import * as fresh from "@mark1russell7/rational";
import { type Arm, timeRounds } from "@mark1russell7/rigor-bench";
import type { Case, Rationals } from "./cases.ts";
import * as old from "./old-rational.ts";

const [name, pair, roundsText, offsetText, msText] = process.argv.slice(2);
const rounds = Number(roundsText);
const offset = Number(offsetText);
const targetMs = Number(msText);
if (name === undefined || (pair !== "ab" && pair !== "aa") || !(rounds > 0) || !Number.isSafeInteger(offset) || !(targetMs > 0)) {
  console.error("Usage: node src/child.ts <case> <ab | aa> <rounds> <offset> <ms>");
  process.exit(2);
}

type Module = { casesFor: (R: Rationals) => Case[] };
const instance = async (arm: Arm, R: Rationals): Promise<Case> => {
  // the query gives a new instance of the module, with its own functions
  const module = (await import(`./cases.ts?arm=${arm}`)) as Module;
  const found = module.casesFor(R).find((c) => c.name === name);
  if (found === undefined) throw new Error(`no case ${name}`);
  return found;
};
const arms: Record<Arm, Case> = {
  a: await instance("a", old),
  b: await instance("b", pair === "ab" ? fresh : old),
};

const result = timeRounds({ a: arms.a.run, b: arms.b.run }, { case: name, rounds, offset, targetMs });
for (const record of result.records) console.log(JSON.stringify(record));
const cpu = os.cpus()[0]?.model ?? "unknown";
console.log(JSON.stringify({ meta: { case: name, pair, rounds, offset, count: result.count, targetMs, cpu, node: process.version, sink: result.sink } }));
