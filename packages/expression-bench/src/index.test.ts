import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { corpus } from "@algebra/expression-corpus";
import { compileFloat, compileTape, random, randomExpression, rootError, summarize } from "@mark1russell7/expression";
import type { Expression } from "@mark1russell7/expression";
import type { PairedTime } from "@mark1russell7/rigor-bench";
import { describe, expect, it } from "vitest";
import { BOUND_LIMIT, caseOf, compiled, corpusCaseOf, type Evaluate, familyOf, LIMIT, markdown, report, speed, speedMarkdown, writtenModule } from "./index.ts";

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
  });

  it("gives faster for a ratio of 0.5 and takes another limit", () => {
    const quick = names.flatMap((n) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => rec(n, r, 0.5 + r * 0.001)));
    const s = speed(quick, aa);
    expect(s.outcome).toBe("faster");
    expect(s.families.map((g) => g.family)).toEqual(["well"]);
    expect(speedMarkdown(s, "The title")).toContain("The title: **faster**");
    expect(report(quick, aa, BOUND_LIMIT).limit).toBe(5);
  });
});
