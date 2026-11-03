/**
 * One process of the bench of A6: `node src/child.ts <case> <pair> <rounds> <offset> <ms>`. It times one case with
 * one pair with `timeRounds` of `@mark1russell7/rigor-bench`, and writes each `PairedTime` record on a line of the
 * standard output. The last line is the facts of the process, as JSON with the key `meta`.
 *
 * A pair `float`, `ball`, `interval` or `exact` has that fixed stage in arm `a` and the stitched plan in arm `b`. The
 * pair `aa` has the stitched plan in the two arms: it is the A/A pair. Each arm gets its own instance of the module
 * of the arms.
 *
 * @packageDocumentation
 */
import os from "node:os";
import { nodeCount } from "@algebra/expression-corpus";
import { STAGES } from "@algebra/evaluator-select";
import type { Stage } from "@algebra/evaluator-select";
import { type Arm, timeRounds } from "@mark1russell7/rigor-bench";
import { type ArmName, corpusCaseOf } from "./arms.ts";

const [name, pair, roundsText, offsetText, msText] = process.argv.slice(2);
const rounds = Number(roundsText);
const offset = Number(offsetText);
const targetMs = Number(msText);
const pairs: readonly string[] = [...STAGES, "aa"];
if (name === undefined || pair === undefined || !pairs.includes(pair) || !(rounds > 0) || !Number.isSafeInteger(offset) || !(targetMs > 0)) {
  console.error("Usage: node src/child.ts <case> <float | ball | interval | exact | aa> <rounds> <offset> <ms>");
  process.exit(2);
}

const c = corpusCaseOf(name);
type Arms = { runOf: (c: ReturnType<typeof corpusCaseOf>, arm: ArmName) => () => number };
// The query gives a new instance of the module for each arm.
const instance = async (arm: Arm, which: ArmName): Promise<() => number> => ((await import(`./arms.ts?arm=${arm}`)) as Arms).runOf(c, which);
const a = await instance("a", pair === "aa" ? "stitched" : (pair as Stage));
const b = await instance("b", "stitched");

const result = timeRounds({ a, b }, { case: name, rounds, offset, targetMs });
for (const record of result.records) console.log(JSON.stringify(record));
const cpu = os.cpus()[0]?.model.trim() ?? "unknown";
const facts = { case: name, pair, rounds, offset, count: result.count, targetMs, nodes: nodeCount(c.document), points: c.points.length, cpu, node: process.version, sink: result.sink };
console.log(JSON.stringify({ meta: facts }));
