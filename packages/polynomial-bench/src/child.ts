/**
 * One process of the bench of A8: `node src/child.ts <case> <pair> <rounds> <offset> <ms>`. It times one case with one
 * pair with `timeRounds` of `@mark1russell7/rigor-bench`, and writes each `PairedTime` record on a line of the standard
 * output. The last line is the facts of the process, as JSON with the key `meta`.
 *
 * @packageDocumentation
 */
import os from "node:os";
import { nodeCount } from "@algebra/expression-corpus";
import { type Arm, timeRounds } from "@mark1russell7/rigor-bench";
import { type ArmName, armsOf, type PairName, pairsOf, type runOf } from "./arms.ts";
import { type BenchCase, benchCase, familyOf } from "./cases.ts";

const [name, pair, roundsText, offsetText, msText] = process.argv.slice(2);
const rounds = Number(roundsText);
const offset = Number(offsetText);
const targetMs = Number(msText);
if (name === undefined || pair === undefined || !pairsOf(familyOf(name)).includes(pair as PairName) || !(rounds > 0) || !Number.isSafeInteger(offset) || !(targetMs > 0)) {
  console.error("Usage: node src/child.ts <case> <verbs | points-1 | points-64 | equal | solve | aa> <rounds> <offset> <ms>");
  process.exit(2);
}

const c: BenchCase = benchCase(name);
const [armA, armB] = armsOf(pair as PairName, c.family);
// The query gives a new instance of the module for each arm.
const instance = async (arm: Arm, which: ArmName): Promise<() => number> => ((await import(`./arms.ts?arm=${arm}`)) as { runOf: typeof runOf }).runOf(c, which);
const a = await instance("a", armA);
const b = await instance("b", armB);

const result = timeRounds({ a, b }, { case: name, rounds, offset, targetMs });
for (const record of result.records) console.log(JSON.stringify(record));
const cpu = os.cpus()[0]?.model.trim() ?? "unknown";
const facts = { case: name, pair, rounds, offset, count: result.count, targetMs, nodes: nodeCount(c.document), cpu, node: process.version, sink: result.sink };
console.log(JSON.stringify({ meta: facts }));
