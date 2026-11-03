import { check, checkWorld } from "@mark1russell7/coeval";
import * as Q from "@mark1russell7/rational";
import { describe, expect, it } from "vitest";
import { BALL, compileExact, type Document, EXACT, EXACT_BITS, expressionMachine, FLOAT, INTERVAL, NO_CLAIM, random, SUMMARY } from "./index.ts";
import { docs, LONG, oracle, POINTS, randomPoint, VARS } from "./oracle.test-helper.ts";

function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

/** This function tells if a document has a root node. */
function hasRoot(doc: Document): boolean {
  switch (doc.type) {
    case "num":
    case "var":
      return false;
    case "root":
      return true;
    case "neg":
      return hasRoot(doc.value);
    case "pow":
      return hasRoot(doc.value.base);
    default:
      return doc.value.some(hasRoot);
  }
}

describe("the verb exact", () => {
  it("has an evaluator for each kind, and checks each generated document", () => {
    expect(checkWorld(expressionMachine, [SUMMARY, FLOAT, INTERVAL, BALL, EXACT])).toEqual([]);
    for (const doc of docs(31, 100)) expect(check(expressionMachine, doc, { verb: EXACT })).toEqual([]);
  });

  it("gives the exact value, no real value, or no claim", () => {
    const x = { type: "var", value: "x" } as const;
    const tenth = made(compileExact({ type: "div", value: [{ type: "num", value: 1 }, x] }));
    expect(tenth.evaluate([10])).toEqual(Q.rational(1n, 10n));
    expect(tenth.evaluate([0])).toBeNull();
    expect(tenth.evaluate([Infinity])).toBe(NO_CLAIM);
    const root = (value: number, index: number): Document => ({ type: "root", value: { radicand: { type: "num", value }, index } });
    expect(made(compileExact(root(2, 2))).evaluate([])).toBe(NO_CLAIM);
    expect(made(compileExact(root(-1, 3))).evaluate([])).toEqual(Q.rational(-1n));
    expect(made(compileExact(root(-4, 2))).evaluate([])).toBeNull();
    // a root of a perfect power is a claim: 27/8 and -8 are cubes
    expect(made(compileExact(root(27 / 8, 3))).evaluate([])).toEqual(Q.rational(3n, 2n));
    expect(made(compileExact(root(-8, 3))).evaluate([])).toEqual(Q.rational(-2n));
    expect(made(compileExact(root(0.25, 2))).evaluate([])).toEqual(Q.rational(1n, 2n));
    expect(made(compileExact(root(0.1, 2))).evaluate([])).toBe(NO_CLAIM);
    const lt = made(compileExact({ type: "lt", value: [x, { type: "num", value: 0.1 }] }));
    expect(lt.evaluate([0.1])).toEqual(Q.ZERO);
    expect(lt.evaluate([0.05])).toEqual(Q.ONE);
    expect(() => tenth.evaluate([])).toThrow(RangeError);
  });

  it("makes no claim on a rational with more than EXACT_BITS bits", () => {
    const pow = (base: Document, exp: number): Document => ({ type: "pow", value: { base: base as never, exp } });
    const tiny = pow({ type: "num", value: Number.MIN_VALUE }, 3);
    expect(made(compileExact(tiny)).evaluate([])).toEqual(Q.pow(Q.fromFloat(Number.MIN_VALUE), 3));
    expect(1074 * 3).toBeLessThan(EXACT_BITS);
    expect(made(compileExact(pow(tiny, 2))).evaluate([])).toBe(NO_CLAIM);
  });

  it(
    "agrees with the exact oracle at random points of random documents",
    () => {
      const rnd = random(32);
      let compared = 0;
      let large = 0;
      for (const doc of docs(33, 400)) {
        const f = made(compileExact(doc, { variables: VARS }));
        for (let k = 0; k < POINTS; k++) {
          const at = randomPoint(rnd);
          const got = f.evaluate(VARS.map((v) => at[v] as number));
          const want = oracle(doc, at);
          const where = `${JSON.stringify(doc)} at ${JSON.stringify(at)}`;
          if (want === "large" || want === "unknown") continue;
          compared++;
          if (got === null) expect(want, where).toBe("none");
          // the oracle encloses each root that is not a short dyadic, so a claim must be in the enclosure
          else if (got !== NO_CLAIM) expect(want !== "none" && Q.compare(want.lo, got) <= 0 && Q.compare(got, want.hi) <= 0, where).toBe(true);
          if (got === NO_CLAIM && !hasRoot(doc)) {
            // a part of more than EXACT_BITS bits: the oracle keeps up to 6000 bits
            large++;
            continue;
          }
          if (!hasRoot(doc)) {
            if (want === "none") expect(got, where).toBeNull();
            else expect(got !== null && got !== NO_CLAIM && Q.equals(want.lo, got), where).toBe(true);
          }
        }
      }
      expect(compared).toBeGreaterThan(1000);
      expect(large).toBeLessThan(compared / 20);
    },
    LONG,
  );
});
