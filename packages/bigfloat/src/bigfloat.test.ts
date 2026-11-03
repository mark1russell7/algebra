import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { random } from "@mark1russell7/rigor-generators";
import type { Random } from "@mark1russell7/rigor-generators";
import { describe, expect, it } from "vitest";
import * as B from "./index.ts";
import type { BigFloat, Rounding } from "./index.ts";
import { correctRational, correctRoot } from "./oracle.test-helper.ts";

/** The count of random operand pairs. The variable `PROPERTY_RUNS` sets it. The default is 2000. */
const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 2000);
/** The count of random double pairs of the differential test. */
const DOUBLE_RUNS = RUNS * 5;
const LONG = 30_000 + RUNS * 30;

const MODES: readonly Rounding[] = ["nearest", "down", "up", "zero"];
const PRECISIONS = [1, 2, 3, 5, 8, 24, 53, 54, 64, 113, 128, 200, 256];

/** This function gives a random positive or zero `bigint` of `bits` bits at most. */
function randomBits(r: Random, bits: number): bigint {
  let x = 0n;
  for (let left = bits; left > 0; left -= 16) {
    const width = Math.min(16, left);
    x = (x << BigInt(width)) | BigInt(r.below(2 ** width));
  }
  return x;
}

/** This function gives the exact value `m × 2^e` as a `BigFloat`. */
function value(m: bigint, e: number): BigFloat {
  const n = m < 0n ? -m : m;
  const precision = Math.max(1, n.toString(2).length);
  const q = e >= 0 ? Q.rational(m << BigInt(e)) : Q.rational(m, 1n << BigInt(-e));
  return B.fromRational(q, { precision });
}

const sign = (r: Random): bigint => (r.chance(0.5) ? 1n : -1n);

/** This function gives a pair of operands from a family that reaches a hard case at the precision `p`. */
function pair(r: Random, p: number): readonly [BigFloat, BigFloat] {
  const free = (): BigFloat => value(sign(r) * randomBits(r, r.int(1, 300)), r.int(-300, 300));
  const full = (): bigint => (1n << BigInt(p - 1)) | randomBits(r, p - 1);
  switch (r.below(6)) {
    case 0:
      return [free(), free()];
    case 1:
      // the sum is exactly the midpoint of two neighbours
      return [value(sign(r) * full(), 0), value(sign(r), -1)];
    case 2: {
      // the second operand is near the limit where it is only a sticky flag, and the first can be a power of two
      const m = r.chance(0.5) ? 1n << BigInt(p - 1) : full();
      const gap = p + r.int(-2, 8);
      return [value(sign(r) * m, r.int(-50, 50)), value(sign(r) * (1n + randomBits(r, r.int(0, 8))), -gap - r.int(0, 8))];
    }
    case 3: {
      // the two operands cancel
      const a = randomBits(r, p + 8) | 1n;
      return [value(a, 0), value(a + BigInt(r.int(-4, 4)), 0)];
    }
    case 4:
      return r.chance(0.5) ? [free(), B.zero(p)] : [B.zero(p), free()];
    default: {
      // the first operand is a square, so its root is exact or a tie at this precision
      const y = randomBits(r, p + r.int(0, 2)) | 1n;
      return [value(y * y, 2 * r.int(-20, 20)), value(y, 0)];
    }
  }
}

const text = (x: BigFloat): string => `${x.sign} ${x.mantissa} ${x.exponent} p${x.precision}`;

/** This function examines the form of a result and its value against the oracle. */
function check(name: string, got: BigFloat, want: Rational, p: number, mode: Rounding, inputs: readonly BigFloat[]): void {
  const where = `${name} p${p} ${mode} of ${inputs.map(text).join(", ")} gave ${text(got)}`;
  expect(Q.equals(B.toRational(got), want), where).toBe(true);
  expect(got.precision, where).toBe(p);
  expect(Math.abs(got.exponent) <= B.MAX_EXPONENT, where).toBe(true);
  if (got.sign === 0) expect([got.mantissa, got.exponent], where).toEqual([0n, 0]);
  else {
    expect(got.mantissa & 1n, where).toBe(1n);
    expect(got.mantissa.toString(2).length, where).toBeLessThanOrEqual(p);
  }
}

describe("the operations against the rational oracle", () => {
  it("round each sum, difference, product and quotient correctly, in each mode", () => {
    const r = random(71);
    for (let i = 0; i < RUNS; i++) {
      const p = r.pick(PRECISIONS);
      const [a, b] = pair(r, p);
      const qa = B.toRational(a);
      const qb = B.toRational(b);
      for (const rounding of MODES) {
        const c = { precision: p, rounding };
        check("add", B.add(a, b, c), correctRational(Q.add(qa, qb), p, rounding), p, rounding, [a, b]);
        check("sub", B.sub(a, b, c), correctRational(Q.sub(qa, qb), p, rounding), p, rounding, [a, b]);
        check("mul", B.mul(a, b, c), correctRational(Q.mul(qa, qb), p, rounding), p, rounding, [a, b]);
        if (b.sign !== 0) check("div", B.div(a, b, c), correctRational(Q.div(qa, qb), p, rounding), p, rounding, [a, b]);
      }
    }
  }, LONG);

  it("round each root correctly, in each mode", () => {
    const r = random(72);
    for (let i = 0; i < RUNS; i++) {
      const p = r.pick(PRECISIONS);
      const [a] = pair(r, p);
      const qa = Q.abs(B.toRational(a));
      for (const rounding of MODES) {
        const c = { precision: p, rounding };
        check("sqrt", B.sqrt(B.abs(a), c), correctRoot(qa, 2, p, rounding), p, rounding, [a]);
        const k = r.int(3, 6);
        const odd = k % 2 === 1;
        check(`root ${k}`, B.root(odd ? a : B.abs(a), k, c), correctRoot(odd ? B.toRational(a) : qa, k, p, rounding), p, rounding, [a]);
      }
    }
  }, LONG);

  it("round each rational and each integer correctly, in each mode", () => {
    const r = random(73);
    for (let i = 0; i < RUNS; i++) {
      const p = r.pick(PRECISIONS);
      const q = Q.rational(sign(r) * randomBits(r, r.int(1, 300)), 1n + randomBits(r, r.int(1, 300)));
      const n = sign(r) * randomBits(r, r.int(1, 300));
      for (const rounding of MODES) {
        const c = { precision: p, rounding };
        check("fromRational", B.fromRational(q, c), correctRational(q, p, rounding), p, rounding, []);
        check("fromBigInt", B.fromBigInt(n, c), correctRational(Q.rational(n), p, rounding), p, rounding, []);
      }
    }
  }, LONG);

  it("compares as the rationals compare, and keeps one form for one value", () => {
    const r = random(74);
    for (let i = 0; i < RUNS; i++) {
      const p = r.pick(PRECISIONS);
      const [a, b] = pair(r, p);
      expect(B.compare(a, b)).toBe(Q.compare(B.toRational(a), B.toRational(b)));
      expect(B.compare(a, a)).toBe(0);
      expect(B.equals(a, B.fromRational(B.toRational(a), { precision: 1000 }))).toBe(true);
      expect(B.equals(B.neg(B.neg(a)), a)).toBe(true);
      expect(Q.equals(B.toRational(B.abs(a)), Q.abs(B.toRational(a)))).toBe(true);
    }
  });
});

const view = new DataView(new ArrayBuffer(8));

/** This function gives a double from random bits. */
function randomDouble(r: Random): number {
  for (;;) {
    view.setUint32(0, r.below(2 ** 32));
    view.setUint32(4, r.below(2 ** 32));
    const x = view.getFloat64(0);
    if (Number.isFinite(x)) return x;
  }
}

/** This function gives a double with a random mantissa and an exponent in `[e, e + spread]`. */
const nearby = (r: Random, e: number, spread: number): number =>
  (r.chance(0.5) ? 1 : -1) * (1 + r.next()) * 2 ** (e + r.int(0, spread));

/** This function gives a pair of doubles from a family of the differential test. */
function doubles(r: Random): readonly [number, number] {
  switch (r.below(5)) {
    case 0:
      return [randomDouble(r), randomDouble(r)];
    case 1: {
      const e = r.int(-400, 400);
      const spread = r.pick([1, 3, 60]);
      return [nearby(r, e, spread), nearby(r, e, spread)];
    }
    case 2: {
      // an integer of 53 bits and a half, and a product of two values of 27 bits: each one is near a tie
      const n = 2 ** 52 + r.below(2 ** 26) * 2 + 1;
      if (r.chance(0.5)) return [n, r.pick([0.5, 1.5, -0.5, 0.25, 0.75])];
      return [1 + r.below(2 ** 26) * 2 ** -26, 1 + r.below(2 ** 26) * 2 ** -26];
    }
    case 3:
      // a subnormal input
      return [(1 + r.below(2 ** 20)) * Number.MIN_VALUE, r.chance(0.5) ? (1 + r.below(2 ** 40)) * Number.MIN_VALUE : nearby(r, -1040, 100)];
    default:
      // few bits, so many results are exact
      return [r.int(-4096, 4096) / 8, r.int(-4096, 4096) / 8];
  }
}

describe("the differential test at 53 bits", () => {
  const c = { precision: B.DOUBLE_PRECISION, rounding: "nearest" } as const;

  it("equals the IEEE double result of each operation", () => {
    const r = random(75);
    const counts = { cases: 0, skips: 0 };
    /** This function compares one result. A result that a double cannot hold with 53 bits is a counted skip. */
    const same = (name: string, got: () => BigFloat, want: number, full: boolean): void => {
      counts.cases++;
      if (!Number.isFinite(want) || (full && Math.abs(want) < 2 ** -1021)) {
        counts.skips++;
        return;
      }
      expect(B.toNumber(got()), `${name} wants ${want}`).toBe(want === 0 ? 0 : want);
    };
    for (let i = 0; i < DOUBLE_RUNS; i++) {
      const [x, y] = doubles(r);
      const a = B.fromNumber(x);
      const b = B.fromNumber(y);
      const pair = `${x}, ${y}`;
      same(`add ${pair}`, () => B.add(a, b, c), x + y, false);
      same(`sub ${pair}`, () => B.sub(a, b, c), x - y, false);
      same(`mul ${pair}`, () => B.mul(a, b, c), x * y, true);
      if (y !== 0) same(`div ${pair}`, () => B.div(a, b, c), x / y, true);
      same(`sqrt ${x}`, () => B.sqrt(B.abs(a), c), Math.sqrt(Math.abs(x)), false);
    }
    console.log(`the double differential test: ${JSON.stringify(counts)}`);
    expect(counts.skips).toBeLessThan(counts.cases * 0.4);
  }, LONG);

  it("reads each double exactly, and toNumber is the nearest double of the rational", () => {
    const r = random(76);
    for (let i = 0; i < RUNS; i++) {
      const [x] = doubles(r);
      expect(B.toNumber(B.fromNumber(x))).toBe(x === 0 ? 0 : x);
      expect(Q.equals(B.toRational(B.fromNumber(x)), Q.fromFloat(x))).toBe(true);
      const wide = value(sign(r) * randomBits(r, r.int(1, 200)), r.int(-1200, 1000));
      expect(B.toNumber(wide)).toBe(Q.toNumber(B.toRational(wide)));
    }
  });
});

describe("the rounding rules", () => {
  const one = B.fromNumber(1);

  it("breaks a tie to the even mantissa at 53 bits", () => {
    const c = { precision: 53 };
    expect(B.toNumber(B.add(one, B.fromNumber(2 ** -53), c))).toBe(1);
    expect(B.toNumber(B.add(one, B.fromNumber(3 * 2 ** -53), c))).toBe(1 + 2 ** -51);
  });

  it("gives neighbours in the directed modes", () => {
    const third = (rounding: Rounding): BigFloat => B.div(one, B.fromNumber(3), { precision: 53, rounding });
    const nearest = 1 / 3;
    expect(B.toNumber(third("nearest"))).toBe(nearest);
    expect(B.toNumber(third("down"))).toBe(nearest);
    expect(B.toNumber(third("zero"))).toBe(nearest);
    expect(B.toNumber(third("up"))).toBe(nearest + 2 ** -54);
    const low = B.neg(third("up"));
    expect(B.equals(low, B.div(B.neg(one), B.fromNumber(3), { precision: 53, rounding: "down" }))).toBe(true);
  });

  it("carries past a power of two", () => {
    const up = B.round(B.fromBigInt(255n), { precision: 4, rounding: "up" });
    expect(up.exponent).toBe(8);
    expect(up.mantissa).toBe(1n);
  });

  it("moves below a power of two when a tiny value goes away", () => {
    const tiny = B.fromNumber(2 ** -600);
    const down = B.sub(one, tiny, { precision: 53, rounding: "down" });
    expect(B.toNumber(down)).toBe(1 - 2 ** -53);
    expect(B.toNumber(B.sub(one, tiny, { precision: 53, rounding: "up" }))).toBe(1);
    expect(B.toNumber(B.add(one, tiny, { precision: 53, rounding: "up" }))).toBe(1 + 2 ** -52);
    expect(B.toNumber(B.add(one, tiny, { precision: 53, rounding: "nearest" }))).toBe(1);
  });

  it("gives the precision of the operands as the default", () => {
    const a = B.fromBigInt(3n, { precision: 80 });
    expect(B.add(a, B.fromNumber(1)).precision).toBe(80);
    expect(B.sqrt(a).precision).toBe(80);
    expect(B.fromBigInt(0n).precision).toBe(1);
    expect(B.round(B.zero(9)).precision).toBe(9);
  });
});

describe("the limits", () => {
  it("does not depend on the distance between the exponents", () => {
    let huge = B.fromNumber(2);
    for (let i = 0; i < 50; i++) huge = B.mul(huge, huge, { precision: 8 });
    expect(huge.exponent).toBe(2 ** 50);
    const sum = B.add(huge, B.fromNumber(1), { precision: 8, rounding: "up" });
    expect(sum.mantissa.toString(2).length).toBe(8);
    expect(B.compare(sum, huge)).toBe(1);
    expect(B.compare(B.fromNumber(-1), B.neg(huge))).toBe(1);
    expect(B.toNumber(huge)).toBe(Infinity);
    expect(B.toNumber(B.neg(huge))).toBe(-Infinity);
    expect(B.toNumber(B.div(B.fromNumber(1), huge, { precision: 8 }))).toBe(0);
    expect(B.sqrt(huge).exponent).toBe(2 ** 49);
  });

  it("refuses an exponent past the limit, and keeps a value at the limit", () => {
    let huge = B.fromNumber(2);
    for (let i = 0; i < 52; i++) huge = B.mul(huge, huge);
    expect(huge.exponent).toBe(B.MAX_EXPONENT);
    const tiny = B.div(B.fromNumber(1), huge);
    expect(tiny.exponent).toBe(-B.MAX_EXPONENT);
    expect(B.equals(B.mul(tiny, huge), B.fromNumber(1))).toBe(true);
    expect(() => B.mul(huge, B.fromNumber(2))).toThrow(RangeError);
    expect(() => B.div(tiny, B.fromNumber(2))).toThrow(RangeError);
  });

  it("refuses each case without a real result", () => {
    expect(() => B.div(B.fromNumber(1), B.zero())).toThrow(RangeError);
    expect(() => B.sqrt(B.fromNumber(-1))).toThrow(RangeError);
    expect(() => B.root(B.fromNumber(-1), 4)).toThrow(RangeError);
    expect(() => B.root(B.fromNumber(1), 0)).toThrow(RangeError);
    expect(() => B.root(B.fromNumber(1), 1.5)).toThrow(RangeError);
    expect(() => B.fromNumber(Infinity)).toThrow(RangeError);
    expect(() => B.fromNumber(Number.NaN)).toThrow(RangeError);
    expect(() => B.zero(0)).toThrow(RangeError);
    expect(() => B.add(B.zero(), B.zero(), { precision: 1.5 })).toThrow(RangeError);
  });

  it("keeps zero without a sign", () => {
    expect(B.equals(B.fromNumber(-0), B.zero())).toBe(true);
    expect(B.equals(B.neg(B.zero()), B.zero())).toBe(true);
    expect(B.sub(B.fromNumber(1), B.fromNumber(1)).sign).toBe(0);
    expect(B.sqrt(B.zero()).sign).toBe(0);
    expect(B.root(B.zero(), 3).sign).toBe(0);
    expect(B.div(B.zero(), B.fromNumber(2)).sign).toBe(0);
    expect(B.toNumber(B.zero())).toBe(0);
  });
});
