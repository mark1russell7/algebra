/**
 * One process of the bench: `node src/child.ts <case> <pair> <rounds> <offset> <ms> <written>`. It times one case with
 * one pair with `timeRounds` of `@mark1russell7/rigor-bench`, and writes each `PairedTime` record on a line of the
 * standard output. The last line is the facts of the process, as JSON with the key `meta`.
 *
 * The pair `ab` has the written function in arm `a` and `compileFloat` in arm `b`. The pair `aa` has the written
 * function in the two arms: it is the A/A pair. Each arm gets its own instance of the module of the written functions
 * and of the module of the cases. `<written>` is the path of the module that `bench.ts` wrote.
 *
 * @packageDocumentation
 */
import os from "node:os";
import { pathToFileURL } from "node:url";
import { type CorpusCase, nodeCount } from "@algebra/expression-corpus";
import { type Arm, timeRounds } from "@mark1russell7/rigor-bench";
import { rootError } from "@mark1russell7/expression";
import { type ArmKind, type Case, compiled, corpusCaseOf, type Evaluate, PAIRS, taped } from "./cases.ts";

const [name, pair, roundsText, offsetText, msText, writtenPath] = process.argv.slice(2);
const rounds = Number(roundsText);
const offset = Number(offsetText);
const targetMs = Number(msText);
if (name === undefined || pair === undefined || !(pair in PAIRS) || !(rounds > 0) || !Number.isSafeInteger(offset) || !(targetMs > 0) || writtenPath === undefined) {
  console.error(`Usage: node src/child.ts <case> <${Object.keys(PAIRS).join(" | ")}> <rounds> <offset> <ms> <written>`);
  process.exit(2);
}

const c = corpusCaseOf(name);
type Bound = (values: Float64Array) => { value: number };
type Written = { written: Record<string, Evaluate>; boundedOf: (root: typeof rootError) => Record<string, Bound> };
type Cases = { caseOf: (c: CorpusCase, f: Evaluate) => Case };
// The query gives a new instance of each module, with its own functions.
const moduleOf = async (arm: Arm): Promise<Written> => (await import(`${pathToFileURL(writtenPath).href}?arm=${arm}`)) as Written;
const armOf = async (kind: ArmKind, arm: Arm): Promise<Evaluate> => {
  if (kind === "float") return compiled(c);
  if (kind === "tape") return taped(c);
  const module = await moduleOf(arm);
  const f = kind === "written" ? module.written[name] : module.boundedOf(rootError)[name];
  if (f === undefined) throw new Error(`The written module has no function for ${name}.`);
  if (kind === "written") return f as Evaluate;
  return (values) => (f as Bound)(values).value;
};
const instance = async (arm: Arm, f: Evaluate): Promise<Case> => ((await import(`./cases.ts?arm=${arm}`)) as Cases).caseOf(c, f);

const [kindA, kindB] = PAIRS[pair as keyof typeof PAIRS];
const fa = await armOf(kindA, "a");
const fb = await armOf(kindB, "b");
for (const p of c.points) {
  const values = Float64Array.from(p);
  if (!Object.is(fa(values), fb(values))) throw new Error(`The two arms of ${name} give different values at ${p.join(", ")}.`);
}
const arms: Record<Arm, Case> = { a: await instance("a", fa), b: await instance("b", fb) };

const result = timeRounds({ a: arms.a.run, b: arms.b.run }, { case: name, rounds, offset, targetMs });
for (const record of result.records) console.log(JSON.stringify(record));
const cpu = os.cpus()[0]?.model.trim() ?? "unknown";
const facts = { case: name, pair, rounds, offset, count: result.count, targetMs, nodes: nodeCount(c.document), points: c.points.length, cpu, node: process.version, sink: result.sink };
console.log(JSON.stringify({ meta: facts }));
