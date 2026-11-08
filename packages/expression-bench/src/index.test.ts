import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { corpus, SEEDS } from "@algebra/expression-corpus";
import { compileFloat, compileTape, random, randomExpression, rootError, summarize } from "@mark1russell7/expression";
import type { Expression } from "@mark1russell7/expression";
import { gateLine, type PairedTime } from "@mark1russell7/rigor-bench";
import { seedsFrom } from "@mark1russell7/rigor-generators";
import { describe, expect, it } from "vitest";
import { BOUND_LIMIT, caseOf, type CompileFacts, compileRatio, compiled, corpusCaseOf, type Evaluate, familyOf, LIMIT, limitReads, markdown, report, sizeMarkdown, speed, speedBySize, speedMarkdown, speedReads, writtenModule } from "./index.ts";

/** This function writes a module of written functions to a new folder, and imports it. */
async function load(cases: readonly { name: string; document: Expression; variables: readonly string[] }[]): Promise<Record<string, Evaluate>> {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "expression-bench-"));
  const file = path.join(folder, "written.mjs");
  fs.writeFileSync(file, writtenModule(cases));
  return ((await import(pathToFileURL(file).href)) as { written: Record<string, Evaluate> }).written;
}

describe("the written functions", () => {
  it("give the value of compileFloat at each point of the corpus", async () => {
    const cases = corpus();
    const written = await load(cases);
    for (const c of cases) {
      const f = compiled(c);
      for (const p of c.points) {
        const values = Float64Array.from(p);
        expect(Object.is(written[c.name]!(values), f(values)), `${c.name} at ${p.join(", ")}`).toBe(true);
      }
    }
  });

  it("give the value of compileFloat for random documents with each kind and the near-degenerate constants", async () => {
    const rnd = random(12);
    const docs = Array.from({ length: 400 }, (_, i) => {
      const document = randomExpression(rnd, { maxDepth: 4 });
      const s = summarize(document);
      return { name: `r${i}`, document, variables: s.ok ? [...s.value.free] : [] };
    });
    const written = await load(docs);
    for (const d of docs) {
      const made = compileFloat(d.document);
      if (!made.ok) continue;
      for (let k = 0; k < 4; k++) {
        const values = Float64Array.from(d.variables, () => (rnd() - 0.5) * 2 ** Math.floor(rnd() * 12 - 6));
        expect(Object.is(written[d.name]!(values), made.value.evaluate(values).value), `${JSON.stringify(d.document)} at ${values.join(", ")}`).toBe(true);
      }
    }
  });

  it("have no eval and no new Function in the source of the bench", () => {
    for (const file of ["source.ts", "cases.ts", "child.ts", "bench.ts"]) {
      const text = fs.readFileSync(new URL(`./${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(text, file).not.toMatch(/\beval\s*\(|new\s+Function/);
    }
  });
});

describe("the cases", () => {
  it("give the case of each name, and the same sum in the two arms", async () => {
    const cases = corpus([1]);
    const written = await load(cases);
    for (const c of cases) {
      const again = corpusCaseOf(c.name);
      expect(again).toEqual(c);
      expect(familyOf(c.name)).toBe(c.family);
      expect(Object.is(caseOf(c, written[c.name]!).run(), caseOf(c, compiled(c)).run()), c.name).toBe(true);
    }
  });
});

describe("the arms with a bound", () => {
  it("give the value and the bound of compileFloat at each point of the corpus", async () => {
    const cases = corpus();
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "expression-bench-"));
    const file = path.join(folder, "written.mjs");
    fs.writeFileSync(file, writtenModule(cases));
    const module = (await import(pathToFileURL(file).href)) as { boundedOf: (root: typeof rootError) => Record<string, (v: Float64Array) => { value: number; error: number }> };
    const bounded = module.boundedOf(rootError);
    for (const c of cases) {
      const f = compileFloat(c.document);
      const t = compileTape(c.document);
      if (!f.ok || !t.ok) throw new Error(c.name);
      for (const p of c.points) {
        const values = Float64Array.from(p);
        const want = f.value.evaluate(values);
        for (const got of [t.value.evaluate(values), bounded[c.name]!(values)]) {
          expect(Object.is(got.value, want.value), `value of ${c.name} at ${p.join(", ")}`).toBe(true);
          expect(Object.is(got.error, want.error), `bound of ${c.name} at ${p.join(", ")}`).toBe(true);
        }
      }
    }
  });
});

describe("the report", () => {
  const rec = (name: string, round: number, ratio: number): PairedTime => ({ case: name, round, first: round % 2 === 0 ? "a" : "b", a: 10, b: 10 * ratio });
  const names = [1, 2, 3, 4, 5, 6].map((s) => `well/s${s}`);
  const aa = names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 1 + (r - 3.5) * 0.002)));

  it("gives beyond for a ratio of 3 and within for a ratio of 1.1", () => {
    const slow = report(names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 3 + r * 0.001))), aa);
    expect(slow.limit).toBe(LIMIT);
    expect(slow.all.outcome).toBe("beyond");
    expect(slow.families.map((g) => g.family)).toEqual(["well"]);
    const fast = report(names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 1.1 + r * 0.001))), aa);
    expect(fast.all.outcome).toBe("within");
    expect(markdown(fast)).toContain("| well | within |");
    const line = gateLine([...limitReads("tf", slow), ...limitReads("bt", fast)], { title: "bench-expression" });
    expect(line).toMatchObject({ outcome: "block", total: 12, blocks: { count: 6, cases: names.map((n) => `tf ${n}`) }, noReads: { count: 0 } });
  });

  it("gives a no-read for a speed read that cannot decide, and not for a slower one", () => {
    const slow = names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 3 + r * 0.001)));
    const decided = speed(slow, aa);
    expect(decided.outcome).toBe("slower");
    expect(gateLine(speedReads("ft", decided, speedBySize(slow, aa, () => 9)), { title: "bench-expression" })).toBeUndefined();
    const short = speed(slow, aa.slice(0, 8));
    const line = gateLine(speedReads("ft", short), { title: "bench-expression" });
    expect(line).toMatchObject({ outcome: "no read", noReads: { count: 2, cases: ["ft", "ft well"] } });
  });

  it("gives faster for a ratio of 0.5 and takes another limit", () => {
    const quick = names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 0.5 + r * 0.001)));
    const s = speed(quick, aa);
    expect(s.outcome).toBe("faster");
    expect(s.families.map((g) => g.family)).toEqual(["well"]);
    expect(speedMarkdown(s, "The title")).toContain("The title: **faster**");
    expect(report(quick, aa, BOUND_LIMIT).limit).toBe(5);
  });

  it("groups the cases by the count of their nodes", () => {
    const quick = names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 0.5 + r * 0.001)));
    const rows = speedBySize(quick, aa, () => 9);
    expect(rows.map((r) => [r.label, r.outcome, r.cases, r.faster])).toEqual([["8 to 14 nodes", "faster", names.length, names.length]]);
    expect(sizeMarkdown(rows)).toContain("| 8 to 14 nodes | faster |");
  });

  it("reads each seed list of the kept runs as the old seed parser of this package did, byte for byte", () => {
    // The texts are the default of bench-expression.yml, the default list of the corpus and the seeds of the kept runs.
    // The JSON comes from the seed parser of this package before it used seedsFrom of rigor-generators.
    const kept: readonly (readonly [string, string])[] = [
      ["1-8", "[1,2,3,4,5,6,7,8]"],
      ["1,2,3,4,5,6,7,8", "[1,2,3,4,5,6,7,8]"],
      ["9-24", "[9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]"],
      ["25-72", "[25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72]"],
      ["73-88", "[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88]"],
      ["89-136", "[89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136]"],
    ];
    for (const [text, json] of kept) expect(JSON.stringify(seedsFrom(text, [])), text).toBe(json);
    expect(seedsFrom(undefined, SEEDS)).toEqual([...SEEDS]);
  });
});

describe("the compile ratio", () => {
  it("gives the median over the cases of the median of each case, and ignores a process with no compile time", () => {
    const meta: readonly CompileFacts[] = [
      { case: "a", compile: { closures: 1, tape: 2 } },
      { case: "a", compile: { closures: 1, tape: 4 } },
      { case: "b", compile: { closures: 2, tape: 1 } },
      { case: "c", compile: { closures: 1, tape: 1 } },
      { case: "d" },
    ];
    expect(compileRatio(meta)).toBe(1);
    expect(compileRatio([{ case: "d" }])).toBeNull();
  });
});
