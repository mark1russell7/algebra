import * as B from "@algebra/bigfloat";
import { corpus, exactValue, isPolynomial, POLYNOMIAL_FAMILIES, SEEDS } from "@algebra/expression-corpus";
import { type BigfloatFunction, compileBigfloat, compileExact, type Expression, NO_CLAIM } from "@mark1russell7/expression";
import { incircleSign, orient2dSign } from "@mark1russell7/predicates";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type Answer,
  ballClaim,
  bigfloatClaim,
  bigWithin,
  type CostModel,
  exactClaim,
  floatClaim,
  intervalClaim,
  meets,
  NO_VALUE,
  NOTHING,
  planCost,
  precisions,
  type Question,
  raise,
  select,
  sharesOf,
  signOf,
  type Stage,
  STAGES,
  START_PRECISION,
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

/** The limit of the stage in the tests, in bits. */
const LIMIT = 4096;
/** The count of points of each case in the property test. The variable `STAGE_POINTS` sets it. The default is all. */
const STAGE_POINTS = Number(process.env["STAGE_POINTS"] ?? 64);

const raised = (doc: Expression, question: Question, limit: number = LIMIT, start?: number) =>
  stitch(doc, question, { plan: ["bigfloat"], precision: { limit, ...(start === undefined ? {} : { start }) } });
const compiled = (doc: Expression): BigfloatFunction => {
  const r = compileBigfloat(doc);
  if (!r.ok) throw new Error(r.error.reason);
  return r.value;
};
const rootOf = (x: Expression): Expression => ({ type: "root", value: { radicand: x, index: 2 } });
const rel = (relative: number): Question => ({ kind: "value", tolerance: { relative } });
const big = (x: number): B.BigFloat => B.fromNumber(x);

describe("the precisions of the stage bigfloat", () => {
  it("double from the start up to the limit, and end at the limit", () => {
    expect(precisions({ limit: 512 })).toEqual([START_PRECISION, 128, 256, 512]);
    expect(precisions({ limit: 100 })).toEqual([64, 100]);
    expect(precisions({ limit: 40, start: 10 })).toEqual([10, 20, 40]);
    expect(precisions({ limit: 32 })).toEqual([32]);
    expect(precisions({ limit: 7, start: 7 })).toEqual([7]);
  });

  it("refuse a precision that is not a whole number, and a start past the limit", () => {
    expect(() => precisions({ limit: 0 })).toThrow(RangeError);
    expect(() => precisions({ limit: 1.5 })).toThrow(RangeError);
    expect(() => precisions({ limit: Number.NaN })).toThrow(RangeError);
    expect(() => precisions({ limit: 64, start: 0 })).toThrow(RangeError);
    expect(() => precisions({ limit: 64, start: 128 })).toThrow(RangeError);
  });
});

describe("the claim of the verb bigfloat", () => {
  const claimAt = (low: B.BigFloat, high: B.BigFloat, precision = 64) =>
    bigfloatClaim({ low, high, error: B.sub(high, low, { precision, rounding: "up" }) }, precision);

  it("gives no value, no claim, and a point of a double", () => {
    expect(bigfloatClaim(null, 64)).toBe(NO_VALUE);
    expect(bigfloatClaim(NO_CLAIM, 64)).toBe(NOTHING);
    expect(claimAt(big(0.5), big(0.5))).toMatchObject({ kind: "value", value: 0.5, error: 0, low: 0.5, high: 0.5 });
    const zero = claimAt(B.zero(), B.zero());
    expect(Object.is(zero.error, 0) && Object.is(zero.high, 0)).toBe(true);
  });

  it("rounds outward to doubles, and keeps the sign that the doubles lose", () => {
    const third = B.fromRational(Q.rational(1n, 3n), { precision: 200 });
    const c = claimAt(third, third, 200);
    expect(c.value).toBe(1 / 3);
    expect(c.error).toBeGreaterThan(0);
    expect(Q.compare(Q.abs(Q.sub(q(c.value), B.toRational(third))), q(c.error))).toBeLessThanOrEqual(0);
    expect(c.low).toBeLessThanOrEqual(1 / 3);
    expect(c.high).toBeGreaterThan(1 / 3);
    const tiny = B.fromRational(Q.rational(1n, 1n << 2000n), { precision: 8 });
    const small = claimAt(tiny, tiny);
    expect(small).toMatchObject({ low: 0, high: Number.MIN_VALUE });
    expect(signOf(small)).toBe(1);
    expect(signOf(claimAt(B.neg(tiny), B.neg(tiny)))).toBe(-1);
    expect(claimAt(B.neg(tiny), B.neg(tiny)).low).toBe(-Number.MIN_VALUE);
    expect(signOf(claimAt(B.neg(tiny), tiny))).toBeUndefined();
    expect(signOf(claimAt(B.zero(), B.zero()))).toBe(0);
  });

  it("states an infinite error past the range of the doubles, and the bounds stay", () => {
    const huge = B.fromRational(Q.rational(10n ** 400n), { precision: 80 });
    const c = claimAt(huge, huge);
    expect(c).toMatchObject({ kind: "value", value: Infinity, error: Infinity, low: Number.MAX_VALUE, high: Infinity });
    expect(signOf(c)).toBe(1);
    expect(claimAt(B.neg(huge), B.neg(huge))).toMatchObject({ low: -Infinity, high: -Number.MAX_VALUE });
    expect(claimAt(B.neg(huge), huge).error).toBe(Infinity);
  });

  it("meets a tolerance by an exact test of the interval", () => {
    const a = (low: number, high: number) => claimAt(big(low), big(high)).big!;
    expect(bigWithin(a(1, 1), { relative: 0 })).toBe(true);
    expect(bigWithin(a(1, 2), { relative: 0 })).toBe(false);
    expect(bigWithin(a(1, 2), { absolute: 1 })).toBe(true);
    expect(bigWithin(a(1, 2), { absolute: 0.5 })).toBe(false);
    expect(bigWithin(a(1, 2), { absolute: Infinity })).toBe(true);
    expect(bigWithin(a(1, 2), { relative: 1 })).toBe(true);
    expect(bigWithin(a(1, 2), { relative: 0.5 })).toBe(false);
    expect(bigWithin(a(-1, 2), { relative: 10 })).toBe(false);
    expect(bigWithin(a(-2, -1), { relative: 1 })).toBe(true);
    expect(bigWithin(a(1, 2), { relative: Infinity })).toBe(true);
    expect(bigWithin(a(0, 0), { relative: 0 })).toBe(true);
  });
});

describe("the stage bigfloat", () => {
  it("is not in the default plan, and a plan with it states a limit", () => {
    expect(STAGES).toEqual(["float", "ball", "interval", "exact"]);
    expect(stitch(v("x"), { kind: "sign" }).plan).not.toContain("bigfloat");
    expect(() => stitch(v("x"), { kind: "sign" }, { plan: ["bigfloat"] })).toThrow(RangeError);
    expect(() => stitch(v("x"), { kind: "sign" }, { plan: ["bigfloat"], precision: { limit: 0 } })).toThrow(RangeError);
  });

  it("stops at the first precision that meets the tolerance, and states the error", () => {
    const two = rootOf(c(2));
    expect(raised(two, rel(1e-12)).answer([])).toMatchObject({ stage: "bigfloat", met: true, big: { precision: 64 } });
    const fine = raised(two, rel(1e-30)).answer([]);
    expect(fine).toMatchObject({ met: true, big: { precision: 128 } });
    const { low, high, error } = fine.big!;
    expect(Q.compare(Q.pow(B.toRational(low), 2), Q.rational(2n))).toBe(-1);
    expect(Q.compare(Q.pow(B.toRational(high), 2), Q.rational(2n))).toBe(1);
    expect(B.toNumber(error)).toBeLessThanOrEqual(1e-30);
    // a double cannot hold this accuracy, and the error of the double states it
    expect(fine.error).toBeGreaterThan(1e-20);
    expect(fine.value).toBe(Math.SQRT2);
    expect(raised(two, { kind: "value", tolerance: { absolute: 1e-300 } }).answer([])).toMatchObject({ met: true, big: { precision: 1024 } });
  });

  it("gives no answer past the limit, and makes no call past it", () => {
    const f = compiled(rootOf(c(2)));
    const asked: number[] = [];
    const spy: BigfloatFunction = { variables: f.variables, evaluate: (values, p) => (asked.push(p), f.evaluate(values, p)) };
    expect(raise(spy, [], rel(1e-300), precisions({ limit: 500 }))).toBe(NOTHING);
    expect(asked).toEqual([64, 128, 256, 500]);
    const a = raised(rootOf(c(2)), rel(1e-300), 500).answer([]);
    expect(a).toMatchObject({ stage: "bigfloat", kind: "no claim", met: false, error: Infinity, sign: undefined });
    expect(a.big).toBeUndefined();
    expect(Number.isNaN(a.value)).toBe(true);
    // the tolerance 0 of an irrational value has no answer at each limit
    expect(raised(rootOf(c(2)), rel(0), 2048).answer([]).met).toBe(false);
    // the interval of the exact value 0 holds zero at each precision, so no limit tells the sign
    const nought: Expression = { type: "sub", value: [{ type: "mul", value: [rootOf(c(2)), rootOf(c(2))] }, c(2)] };
    expect(raised(nought, { kind: "sign" }).answer([]).met).toBe(false);
    expect(raised(nought, rel(1)).answer([]).met).toBe(false);
    expect(raised(nought, { kind: "value", tolerance: { absolute: 1e-100 } }).answer([]).met).toBe(true);
  });

  it("goes on after no claim at a low precision, and stops at no real value", () => {
    const nearly = B.add(big(2), B.fromRational(Q.rational(1n, 1n << 100n), { precision: 1 }), { precision: 110 });
    const doc: Expression = { type: "div", value: [c(1), { type: "sub", value: [{ type: "mul", value: [rootOf(c(2)), rootOf(c(2))] }, v("x")] }] };
    const f = compiled(doc);
    expect(f.evaluate([nearly], 64)).toBe(NO_CLAIM);
    const claim = raise(f, [nearly], rel(1e-12), precisions({ limit: LIMIT }));
    expect(claim).toMatchObject({ kind: "value", big: { precision: 256 } });
    expect(claim.value).toBeCloseTo(-(2 ** 100), -20);
    const none = compiled({ type: "div", value: [c(1), v("x")] });
    const asked: number[] = [];
    const spy: BigfloatFunction = { variables: none.variables, evaluate: (values, p) => (asked.push(p), none.evaluate(values, p)) };
    expect(raise(spy, [0], rel(1e-12), precisions({ limit: LIMIT }))).toBe(NO_VALUE);
    expect(asked).toEqual([64]);
    expect(raised({ type: "div", value: [c(1), v("x")] }, { kind: "sign" }).answer([0])).toMatchObject({ kind: "no value", met: true });
  });

  it("gives no answer for a value past the range of a BigFloat, and no throw", () => {
    let doc: Expression = c(2);
    for (let i = 0; i < 6; i++) doc = { type: "pow", value: { base: doc, exp: 1000 } };
    expect(raised(doc, { kind: "sign" }).answer([])).toMatchObject({ kind: "no claim", met: false });
    const stop: BigfloatFunction = {
      variables: [],
      evaluate: () => {
        throw new RangeError("the exponent is out of range");
      },
    };
    expect(raise(stop, [], { kind: "sign" }, [64])).toBe(NOTHING);
    const bug: BigfloatFunction = {
      variables: [],
      evaluate: () => {
        throw new TypeError("a bug");
      },
    };
    expect(() => raise(bug, [], { kind: "sign" }, [64])).toThrow(TypeError);
  });

  it("tells a sign past the range of the doubles", () => {
    const tiny: Expression = { type: "pow", value: { base: c(2), exp: -2000 } };
    const doc: Expression = { type: "sub", value: [{ type: "add", value: [c(1), tiny] }, c(1)] };
    const a = raised(doc, { kind: "sign" }).answer([]);
    expect(a).toMatchObject({ met: true, sign: 1, low: 0, big: { precision: 2048 } });
    expect(raised(doc, { kind: "sign" }, 1024).answer([]).met).toBe(false);
  });

  it("takes inputs with more bits than a double", () => {
    const third = Q.rational(1n, 3n);
    const f = compiled({ type: "mul", value: [v("x"), c(3)] });
    const claim = raise(f, [third], rel(1e-40), precisions({ limit: LIMIT }));
    expect(claim).toMatchObject({ kind: "value", value: 1 });
    expect(Q.compare(B.toRational(claim.big!.low), Q.ONE)).toBeLessThanOrEqual(0);
    expect(Q.compare(B.toRational(claim.big!.high), Q.ONE)).toBeGreaterThanOrEqual(0);
    expect(claim.big!.precision).toBe(256);
  });

  it("joins a plan that names it, and exact stays the fallback", () => {
    const doc = rootOf(v("x"));
    const fine = stitch(doc, rel(1e-30), { plan: ["float", "bigfloat", "exact"], precision: { limit: 256 } }).answer([2]);
    expect(fine).toMatchObject({ stage: "bigfloat", met: true });
    expect(stitch(doc, rel(1e-3), { plan: ["float", "bigfloat"], precision: { limit: 256 } }).answer([2]).stage).toBe("float");
    const past = stitch(doc, rel(1e-300), { plan: ["float", "bigfloat"], precision: { limit: 256 } }).answer([2]);
    expect(past).toMatchObject({ stage: "float", met: false });
    const sum: Expression = { type: "add", value: [v("x"), c(1)] };
    expect(stitch(sum, rel(0), { plan: ["bigfloat", "exact"], precision: { limit: 256 } }).answer([0.1]).stage).toBe("bigfloat");
    expect(stitch(sum, rel(0), { plan: ["bigfloat", "exact"], precision: { limit: 32 } }).answer([0.1]).stage).toBe("exact");
  });

  it(
    "gives each answer within its stated error of the exact value at each point of the corpus",
    () => {
      const questions: readonly Question[] = [...QUESTIONS.slice(0, 3), rel(1e-30)];
      const counts = { rational: 0, met: 0, unmet: 0, noReal: 0, noExact: 0, precision: {} as Record<number, number> };
      const inside = (y: B.BigFloat, x: Rational, error: B.BigFloat): boolean =>
        Q.compare(Q.abs(Q.sub(B.toRational(y), x)), B.toRational(error)) <= 0;
      for (const k of corpus(SEEDS, { points: STAGE_POINTS })) {
        const ex = compileExact(k.document, { variables: k.variables });
        if (!ex.ok) throw new Error(ex.error.reason);
        const options = { variables: k.variables, plan: ["bigfloat"], precision: { limit: LIMIT } } as const;
        const stages = questions.map((question) => stitch(k.document, question, options));
        for (const p of k.points) {
          const x = ex.value.evaluate(p);
          if (x === NO_CLAIM) {
            counts.noExact++;
            continue;
          }
          for (const s of stages) {
            const a = s.answer(p);
            const where = `${k.name} ${JSON.stringify(s.question)} at ${p.join(", ")}`;
            expect(a.stage, where).toBe("bigfloat");
            if (x === null) {
              counts.noReal++;
              expect(a.kind, where).not.toBe("value");
              continue;
            }
            counts.rational++;
            expect(a.kind, where).not.toBe("no value");
            if (!a.met) {
              counts.unmet++;
              expect(a.kind, where).toBe("no claim");
              continue;
            }
            counts.met++;
            const { low, high, error, precision } = a.big!;
            counts.precision[precision] = (counts.precision[precision] ?? 0) + 1;
            expect(contains(a, x), where).toBe(true);
            expect(Q.compare(B.toRational(low), x) <= 0 && Q.compare(x, B.toRational(high)) <= 0, where).toBe(true);
            expect(inside(low, x, error) && inside(high, x, error), where).toBe(true);
            if (s.question.kind === "sign") expect(a.sign, where).toBe(Q.sign(x));
            else {
              const t = s.question.tolerance;
              const reach = "absolute" in t ? q(t.absolute) : Q.mul(q(t.relative), Q.abs(x));
              expect(Q.compare(Q.abs(Q.sub(B.toRational(low), x)), reach) <= 0, where).toBe(true);
              expect(Q.compare(Q.abs(Q.sub(B.toRational(high), x)), reach) <= 0, where).toBe(true);
            }
          }
        }
      }
      console.log(`the stage on the corpus: ${JSON.stringify(counts)}`);
      // the limit reaches each question at each point with a rational value, so no check above is empty
      expect(counts.rational).toBeGreaterThan(0);
      expect(counts.met).toBe(counts.rational);
    },
    600_000,
  );
});

describe("the selector with the stage bigfloat", () => {
  const sign: Question = { kind: "sign" };
  const shares = [
    { question: sign, stage: "float", share: 0.5 },
    { question: sign, stage: "bigfloat", share: 0.99 },
    { question: sign, stage: "exact", share: 1 },
  ] as const;
  const cost = { float: 1, ball: 2, interval: 3, exact: 1000 };

  it("needs a measured cost", () => {
    expect(() => planCost(["bigfloat", "exact"], cost, {})).toThrow(RangeError);
    expect(() => planCost(["bigfloat"], { ...cost, bigfloat: Number.NaN }, {})).toThrow(RangeError);
    expect(planCost(["bigfloat", "exact"], { ...cost, bigfloat: 10 }, { bigfloat: 0.99 })).toBeCloseTo(20, 9);
  });

  it("leaves the stage out of each plan without a measured cost", () => {
    const withNull = { ...cost, bigfloat: null as unknown as number };
    for (const c of [cost, withNull]) {
      expect(select(sign, { cost: c, shares: [...shares] }).plan).not.toContain("bigfloat");
      expect(select(rel(1e-30), { cost: c, shares: [] }).plan).toEqual(["float", "ball", "interval", "exact"]);
    }
  });

  it("uses the stage when a bench measured it and it lowers the expected cost", () => {
    const measured = { ...cost, bigfloat: 10 };
    expect(select(sign, { cost: measured, shares: [...shares] }).plan).toEqual(["float", "bigfloat", "exact"]);
    expect(select(rel(1e-30), { cost: measured, shares: [] }).plan).toEqual(["float", "ball", "interval", "bigfloat", "exact"]);
    expect(select(sign, { cost: { ...cost, bigfloat: 5000 }, shares: [...shares] }).plan).not.toContain("bigfloat");
  });

});

describe("the shares of each stage", () => {
  const value = (tolerance: { relative: number } | { absolute: number }): Question => ({ kind: "value", tolerance });
  const model: CostModel = {
    cost: { float: 15, ball: 28, interval: 77, exact: 859, bigfloat: 2460 },
    shares: [
      { question: value({ relative: 0 }), stage: "interval", share: 0.216 },
      { question: value({ relative: 0 }), stage: "exact", share: 0.9 },
      { question: value({ relative: 1e-30 }), stage: "bigfloat", share: 1 },
    ],
  };

  it("keeps the row of each stage when only one stage has a row at a nearer bound", () => {
    expect(sharesOf(rel(1e-30), model)).toEqual({ interval: 0.216, exact: 0.9, bigfloat: 1 });
    const s = select(rel(1e-30), model);
    expect(s.plan).toEqual(["interval", "exact"]);
    expect(s.expectedCost).toBeCloseTo(77 + (1 - 0.216) * 859, 9);
    expect(sharesOf(rel(0), model)).toEqual({ interval: 0.216, exact: 0.9 });
    expect(sharesOf(value({ absolute: 1 }), model)).toBeUndefined();
  });

  it("gives each stage the share of its own rows, whatever the rows of the other stages", () => {
    const stage = fc.constantFrom<Stage>("float", "ball", "interval", "exact", "bigfloat");
    const tolerance = fc.oneof(
      fc.constantFrom(0, 1e-30, 1e-12, 1e-9, 1e-6).map((relative) => ({ relative })),
      fc.constantFrom(0, 1e-12, 1e-9, 1).map((absolute) => ({ absolute })),
    );
    const row = fc.record({ question: tolerance.map(value), stage, share: fc.double({ min: 0, max: 1, noNaN: true }) });
    fc.assert(
      fc.property(fc.array(row, { maxLength: 12 }), tolerance, (rows, t) => {
        const all = sharesOf(value(t), { cost: model.cost, shares: rows }) ?? {};
        for (const s of ["float", "ball", "interval", "exact", "bigfloat"] as const) {
          const own = sharesOf(value(t), { cost: model.cost, shares: rows.filter((r) => r.stage === s) }) ?? {};
          expect(all[s]).toBe(own[s]);
        }
      }),
      { seed: 20261109, numRuns: 500 },
    );
  });
});
