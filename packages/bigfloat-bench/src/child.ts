/**
 * One process of the bench of A7: `node src/child.ts <case> <pair> <rounds> <offset> <ms> <limit>`. It times one case with
 * one pair with `timeRounds` of `@mark1russell7/rigor-bench`, and writes each `PairedTime` record on a line of the standard
 * output. The last line is the facts of the process, as JSON with the key `meta`. Each arm gets its own instance of the
 * module of the arms.
 *
 * @packageDocumentation
 */
import os from "node:os";
import { corpusCaseOf } from "@algebra/evaluator-bench";
import type { CorpusCase } from "@algebra/expression-corpus";
import { nodeCount } from "@algebra/expression-corpus";
import { type Arm, timeRounds } from "@mark1russell7/rigor-bench";
import { type ArmName, pairOf } from "./arms.ts";

const [name, pair, roundsText, offsetText, msText, limitText] = process.argv.slice(2);
const rounds = Number(roundsText);
const offset = Number(offsetText);
const targetMs = Number(msText);
const limit = Number(limitText);
if (name === undefined || pair === undefined || !(rounds > 0) || !Number.isSafeInteger(offset) || !(targetMs > 0) || !Number.isSafeInteger(limit)) {
  console.error("Usage: node src/child.ts <case> <pair> <rounds> <offset> <ms> <limit>");
  process.exit(2);
}

const c = corpusCaseOf(name);
const arms = pairOf(pair);
type Arms = { runOf: (c: CorpusCase, arm: ArmName, limit: number) => () => number };
// The query gives a new instance of the module for each arm.
const instance = async (arm: Arm, which: ArmName): Promise<() => number> => ((await import(`./arms.ts?arm=${arm}`)) as Arms).runOf(c, which, limit);
const a = await instance("a", arms.a);
const b = await instance("b", arms.b);

const result = timeRounds({ a, b }, { case: name, rounds, offset, targetMs });
for (const record of result.records) console.log(JSON.stringify(record));
const cpu = os.cpus()[0]?.model.trim() ?? "unknown";
const facts = { case: name, pair, rounds, offset, count: result.count, targetMs, limit, nodes: nodeCount(c.document), points: c.points.length, cpu, node: process.version, sink: result.sink };
console.log(JSON.stringify({ meta: facts }));
