/**
 * One process of the bench: `node src/child.ts <case> <pair> <rounds> <offset> <ms>`. It times one case with one pair,
 * and writes each round as one `PairedTime` record of `@mark1russell7/rigor-bench` on a line of the standard output.
 * The last line is the facts of the process, as JSON with the key `meta`.
 *
 * The pair `ab` has the old rationals in arm `a` and the new rationals in arm `b`. The pair `aa` has the old rationals
 * in the two arms: it is the A/A pair. Each arm gets its own instance of the module of the cases, so the arms do not
 * share the type feedback of the engine.
 *
 * @packageDocumentation
 */
import os from "node:os";
import { performance } from "node:perf_hooks";
import * as fresh from "@mark1russell7/rational";
import { type Arm, type PairedTime, firstArm } from "@mark1russell7/rigor-bench";
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

let sink = 0;
/** This function gives the time in milliseconds of `count` uses of the case of the arm. */
const batch = (arm: Arm, count: number): number => {
  const run = arms[arm].run;
  const start = performance.now();
  for (let i = 0; i < count; i++) sink += run();
  return performance.now() - start;
};

// The two arms run for one second before the timed rounds, so the engine compiles each arm with its type feedback
let count = 1;
const warmUntil = performance.now() + 1000;
while (performance.now() < warmUntil) {
  if (batch("a", count) < targetMs / 4) count *= 2;
  batch("b", count);
}
// The count of calls of each batch: after the warm-up, the arm a takes at least the target time
while (batch("a", count) < targetMs) count *= 2;

for (let round = 0; round < rounds; round++) {
  const first = firstArm(round, offset);
  const second: Arm = first === "a" ? "b" : "a";
  const times = { [first]: batch(first, count), [second]: batch(second, count) } as Record<Arm, number>;
  const record: PairedTime = { case: name, round, first, a: times.a, b: times.b };
  console.log(JSON.stringify(record));
}
const cpu = os.cpus()[0]?.model ?? "unknown";
console.log(JSON.stringify({ meta: { case: name, pair, rounds, offset, count, targetMs, cpu, node: process.version, sink } }));
