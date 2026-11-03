import { corpus, exactValue, isPolynomial, POLYNOMIAL_FAMILIES } from "@algebra/expression-corpus";
import { compileExact, type Expression, NO_CLAIM } from "@mark1russell7/expression";
import { incircleSign, orient2dSign } from "@mark1russell7/predicates";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { describe, expect, it } from "vitest";
import {
  type Answer,
  ballClaim,
  type CostModel,
  exactClaim,
  floatClaim,
  intervalClaim,
  meets,
  NO_VALUE,
  NOTHING,
  planCost,
  type Question,
  select,
  signOf,
  STAGES,
  stitch,
  within,
} from "./index.ts";

const v = (value: string): Expression => ({ type: "var", value });
const c = (value: number): Expression => ({ type: "num", value });

/** The questions of the property tests. */
const QUESTIONS: readonly Question[] = [
  { kind: "sign" },
  { kind: "value", tolerance: { absolute: 1e-9 } },
  { kind: "value", tolerance: { relative: 1e-12 } },
  { kind: "value", tolerance: { relative: 0 } },
];

const q = (x: number): Rational => Q.fromFloat(x);

/** This function tells if an answer contains the exact value `x`: in `[low, high]`, and at most `error` from `value`. */
function contains(a: Answer, x: Rational): boolean {
  const low = a.low === -Infinity || (a.low < Infinity && Q.compare(q(a.low), x) <= 0);
  const high = a.high === Infinity || (a.high > -Infinity && Q.compare(x, q(a.high)) <= 0);
  const near = !(a.error < Infinity) || Q.compare(Q.abs(Q.sub(q(a.value), x)), q(a.error)) <= 0;
  return low && high && near;
}

describe("the claims", () => {
  it("put each evaluator result into one form", () => {
    expect(floatClaim({ value: 2, error: 0 })).toEqual({ kind: "value", value: 2, error: 0, low: 2, high: 2 });
    expect(floatClaim({ value: 2, error: Infinity })).toBe(NOTHING);
    expect(ballClaim({ mid: 1, rad: 0.5 }).low).toBeLessThan(0.5);
    expect(intervalClaim(null)).toBe(NO_VALUE);
    expect(intervalClaim(NO_CLAIM)).toBe(NOTHING);
    const i = intervalClaim([1, 2]);
    expect(i.value).toBe(1.5);
    expect(i.error).toBeGreaterThanOrEqual(0.5);
    expect(intervalClaim([1, Infinity])).toMatchObject({ error: Infinity, low: 1, high: Infinity });
    const tenth = exactClaim(Q.rational(1n, 10n));
    expect(tenth.value).toBe(0.1);
    expect(Q.compare(Q.abs(Q.sub(q(0.1), Q.rational(1n, 10n))), q(tenth.error))).toBeLessThanOrEqual(0);
    expect(exactClaim(Q.rational(10n ** 400n)).value).toBe(Infinity);
  });

  it("meet a tolerance only with an error bound inside it", () => {
    expect(within(1, 1e-10, { absolute: 1e-9 })).toBe(true);
    expect(within(1, 1e-8, { absolute: 1e-9 })).toBe(false);
    expect(within(1, 1e-13, { relative: 1e-12 })).toBe(true);
    expect(within(1e-20, 1e-13, { relative: 1e-12 })).toBe(false);
    expect(within(3, 0, { relative: 0 })).toBe(true);
    expect(within(3, Number.MIN_VALUE, { relative: 0 })).toBe(false);
    expect(signOf(floatClaim({ value: -1, error: 0.5 }))).toBe(-1);
    expect(signOf(floatClaim({ value: 1, error: 1 }))).toBeUndefined();
    expect(signOf(floatClaim({ value: 0, error: 0 }))).toBe(0);
    expect(meets(NO_VALUE, { kind: "sign" })).toBe(true);
    expect(meets(NOTHING, { kind: "sign" })).toBe(false);
    expect(meets(exactClaim(Q.rational(1n, 3n)), { kind: "value", tolerance: { relative: 0 } })).toBe(true);
  });
});

describe("the stitched evaluator", () => {
  it("stops at the first stage that answers, and names it", () => {
    const sum = stitch({ type: "add", value: [v("x"), c(1)] }, { kind: "value", tolerance: { relative: 0 } });
    expect(sum.plan).toEqual(STAGES);
    // the A3 bound of 2 + 1 is above zero, and the ball finds that the sum is exact
    expect(sum.answer([2])).toMatchObject({ stage: "ball", value: 3, error: 0, met: true, sign: 1 });
    expect(stitch({ type: "add", value: [v("x"), c(1)] }, { kind: "sign" }).answer([2]).stage).toBe("float");
    // 0.1 + 1 rounds, so only the exact stage answers the tolerance 0
    const exact = sum.answer([0.1]);
    expect(exact).toMatchObject({ stage: "exact", met: true });
    expect(Q.equals(exact.exact!, Q.add(q(0.1), Q.ONE))).toBe(true);
    const quotient = stitch({ type: "div", value: [c(1), v("x")] }, { kind: "sign" });
    expect(quotient.answer([0])).toMatchObject({ kind: "no value", met: true });
  });

  it("gives the claim with the smallest error when no stage answers", () => {
    const root: Expression = { type: "root", value: { radicand: v("x"), index: 2 } };
    const s = stitch(root, { kind: "value", tolerance: { relative: 0 } });
    const a = s.answer([2]);
    expect(a.met).toBe(false);
    expect(a.error).toBeGreaterThan(0);
    expect(a.error).toBeLessThan(1e-15);
    expect(stitch(root, { kind: "value", tolerance: { relative: 1e-12 } }, { plan: ["exact", "float"] }).answer([2]).stage).toBe("float");
  });

  it("refuses an empty plan and a negative tolerance", () => {
    expect(() => stitch(v("x"), { kind: "sign" }, { plan: [] })).toThrow(RangeError);
    expect(() => stitch(v("x"), { kind: "value", tolerance: { absolute: -1 } })).toThrow(RangeError);
  });

  it(
    "meets each question at each point of the corpus, against the exact value",
    () => {
      const counts = { points: 0, exact: 0, noValue: 0, noClaim: 0, unmet: 0 };
      for (const k of corpus()) {
        const ex = compileExact(k.document, { variables: k.variables });
        if (!ex.ok) throw new Error(ex.error.reason);
        const stitched = QUESTIONS.map((question) => stitch(k.document, question, { variables: k.variables }));
        for (const p of k.points) {
          const x = ex.value.evaluate(p);
          for (const s of stitched) {
            const a = s.answer(p);
            const where = `${k.name} ${JSON.stringify(s.question)} at ${p.join(", ")}`;
            counts.points++;
            if (a.stage === "exact") counts.exact++;
            if (x === NO_CLAIM) {
              // only a root gives no claim: a stage can answer, or no stage answers
              counts.noClaim++;
              if (!a.met) counts.unmet++;
              continue;
            }
            expect(a.met, where).toBe(true);
            if (x === null) {
              expect(a.kind, where).toBe("no value");
              counts.noValue++;
              continue;
            }
            expect(a.kind, where).toBe("value");
            expect(contains(a, x), where).toBe(true);
            if (a.exact !== undefined) expect(Q.equals(a.exact, x), where).toBe(true);
            else if (s.question.kind === "value") expect(within(a.value, a.error, s.question.tolerance), where).toBe(true);
            else expect(a.sign, where).toBe(Q.sign(x));
          }
        }
      }
      console.log(`corpus answers: ${JSON.stringify(counts)}`);
      expect(counts.points).toBe(64 * 64 * QUESTIONS.length);
    },
    600_000,
  );

  it("gives the sign of orient2d and incircle at each point of the geometric families", () => {
    let checked = 0;
    for (const k of corpus().filter((k) => k.family.startsWith("orient") || k.family.startsWith("incircle"))) {
      const s = stitch(k.document, { kind: "sign" }, { variables: k.variables });
      const want = k.family.startsWith("orient") ? orient2dSign : incircleSign;
      for (const p of k.points) {
        expect(s.answer(p).sign, `${k.name} at ${p.join(", ")}`).toBe((want as (...xs: number[]) => number)(...p));
        checked++;
      }
    }
    expect(checked).toBe(4 * 8 * 64);
  });
});

describe("the verb exact on the corpus", () => {
  it("gives the exactValue of the corpus at each polynomial point", () => {
    let checked = 0;
    for (const k of corpus().filter((k) => POLYNOMIAL_FAMILIES.includes(k.family) || isPolynomial(k.document))) {
      const ex = compileExact(k.document, { variables: k.variables });
      if (!ex.ok) throw new Error(ex.error.reason);
      for (const p of k.points) {
        const got = ex.value.evaluate(p);
        const want = exactValue(k.document, k.variables, p)!;
        expect(got !== null && got !== NO_CLAIM && Q.equals(got, want.value), `${k.name} at ${p.join(", ")}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6 * 8 * 64);
  });
});

describe("the selector", () => {
  const sign: Question = { kind: "sign" };
  const model: CostModel = {
    cost: { float: 1, ball: 2, interval: 3, exact: 100 },
    shares: [
      { question: sign, stage: "float", share: 0.99 },
      { question: sign, stage: "ball", share: 0.995 },
      { question: sign, stage: "interval", share: 0.999 },
      { question: sign, stage: "exact", share: 1 },
      { question: { kind: "value", tolerance: { relative: 1e-12 } }, stage: "float", share: 0 },
      { question: { kind: "value", tolerance: { relative: 1e-6 } }, stage: "float", share: 1 },
    ],
  };

  it("gives the plan of the least expected cost", () => {
    const s = select(sign, model);
    expect(s.plan).toEqual(["float", "interval", "exact"]);
    expect(s.expectedCost).toBeCloseTo(1 + 0.01 * 3 + 0.001 * 100, 12);
    expect(planCost(["exact"], model.cost, {})).toBe(100);
  });

  it("uses the rows of the nearest stricter tolerance, and each stage without rows", () => {
    expect(select({ kind: "value", tolerance: { relative: 1e-9 } }, model).plan).toEqual(["exact"]);
    expect(select({ kind: "value", tolerance: { relative: 1e-3 } }, model)).toEqual({ plan: ["float", "exact"], expectedCost: 1 });
    expect(select({ kind: "value", tolerance: { relative: 1e-15 } }, model).plan).toEqual(["float", "ball", "interval", "exact"]);
    expect(select({ kind: "value", tolerance: { absolute: 1 } }, model).plan).toEqual(["float", "ball", "interval", "exact"]);
  });
});
