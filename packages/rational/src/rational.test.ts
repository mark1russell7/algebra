import { describe, expect, it } from "vitest";
import {
  ONE,
  type Rational,
  ZERO,
  abs,
  add,
  ceil,
  cmp,
  compare,
  div,
  equals,
  floor,
  fromDecimal,
  fromFloat,
  fromNumber,
  gcd as commonDivisor,
  inverse,
  isInteger,
  mul,
  neg,
  integerRoot,
  pow,
  rational,
  root,
  sign,
  sub,
  toNumber,
  toString,
} from "./index.ts";
import { nextDown, nextUp, random, randomBits, randomDouble, randomRational } from "./random.test-helper.ts";

/** The count of random cases of each property. CI sets it. The default is 1000. */
const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 1000);

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

/** The invariant of each rational: `d > 0`, `gcd(n, d) = 1`, and zero is `0 / 1`. */
function expectLowest(x: Rational): void {
  expect(x.d > 0n, `denominator of ${x.n}/${x.d}`).toBe(true);
  expect(gcd(x.n, x.d), `gcd of ${x.n}/${x.d}`).toBe(1n);
}

function expectSame(actual: Rational, expected: Rational): void {
  expect(toString(actual)).toBe(toString(expected));
}

type Triple = [Rational, Rational, Rational];

/** This function gives `count` triples of random rationals from one seed. */
function cases(seed: number, count = RUNS): Triple[] {
  const rnd = random(seed);
  return Array.from({ length: count }, (): Triple => [randomRational(rnd), randomRational(rnd), randomRational(rnd)]);
}

describe("the field laws", () => {
  it("keeps each result in lowest terms", () => {
    for (const [a, b] of cases(1)) {
      for (const x of [add(a, b), sub(a, b), mul(a, b), neg(a), abs(a), floor(a), ceil(a), pow(a, 3)]) {
        expectLowest(x);
      }
      if (sign(b) !== 0) {
        expectLowest(div(a, b));
        expectLowest(inverse(b));
        expectLowest(pow(b, -2));
      }
    }
  });

  it("adds and multiplies in each order", () => {
    for (const [a, b] of cases(2)) {
      expectSame(add(a, b), add(b, a));
      expectSame(mul(a, b), mul(b, a));
    }
  });

  it("adds and multiplies in each grouping", () => {
    for (const [a, b, c] of cases(3)) {
      expectSame(add(add(a, b), c), add(a, add(b, c)));
      expectSame(mul(mul(a, b), c), mul(a, mul(b, c)));
    }
  });

  it("distributes the product over the sum", () => {
    for (const [a, b, c] of cases(4)) {
      expectSame(mul(a, add(b, c)), add(mul(a, b), mul(a, c)));
      expectSame(mul(add(a, b), c), add(mul(a, c), mul(b, c)));
    }
  });

  it("has the identities 0 and 1", () => {
    for (const [a] of cases(5)) {
      expectSame(add(a, ZERO), a);
      expectSame(mul(a, ONE), a);
      expectSame(mul(a, ZERO), ZERO);
    }
  });

  it("has an additive inverse for each value and a multiplicative inverse for each value but 0", () => {
    for (const [a, b] of cases(6)) {
      expectSame(add(a, neg(a)), ZERO);
      expectSame(add(sub(a, b), b), a);
      if (sign(a) !== 0) expectSame(mul(a, inverse(a)), ONE);
      if (sign(b) !== 0) expectSame(mul(div(a, b), b), a);
    }
  });

  it("has a total order that agrees with sub", () => {
    for (const [a, b, c] of cases(7)) {
      const ab = compare(a, b);
      expect(ab).toBe(sign(sub(a, b)));
      expect(compare(b, a) + ab).toBe(0);
      expect(equals(a, b)).toBe(ab === 0);
      if (ab <= 0 && compare(b, c) <= 0) expect(compare(a, c)).toBeLessThanOrEqual(0);
      // the order agrees with the sum, and with a product by a positive value
      expect(compare(add(a, c), add(b, c))).toBe(ab);
      if (sign(c) > 0) expect(compare(mul(a, c), mul(b, c))).toBe(ab);
    }
  });

  it("gives abs, sign, floor and ceil that agree with the order", () => {
    for (const [a] of cases(8)) {
      expect(sign(abs(a))).toBe(sign(a) === 0 ? 0 : 1);
      const f = floor(a);
      const c = ceil(a);
      expect(isInteger(f) && isInteger(c)).toBe(true);
      expect(compare(f, a)).toBeLessThanOrEqual(0);
      expect(compare(a, add(f, ONE))).toBe(-1);
      expect(compare(c, a)).toBeGreaterThanOrEqual(0);
      expect(compare(sub(c, ONE), a)).toBe(-1);
      expect(equals(f, c)).toBe(isInteger(a));
    }
  });

  it("raises to integer powers as repeated products", () => {
    for (const [a] of cases(9, Math.min(RUNS, 200))) {
      let product = ONE;
      for (let e = 0; e <= 4; e += 1) {
        expectSame(pow(a, e), product);
        if (sign(a) !== 0) expectSame(pow(a, -e), inverse(product));
        product = mul(product, a);
      }
    }
  });
});

describe("the constructors", () => {
  it("normalizes the sign and the common factors", () => {
    expectSame(rational(6n, -4n), rational(-3n, 2n));
    expect(rational(0n, -5n)).toEqual({ n: 0n, d: 1n });
    expect(rational(7n)).toEqual({ n: 7n, d: 1n });
    expect(() => rational(1n, 0n)).toThrow(RangeError);
  });

  it("reads a decimal exactly", () => {
    expectSame(fromDecimal("0.0254"), rational(127n, 5000n));
    expectSame(fromDecimal("1e-9"), rational(1n, 10n ** 9n));
    expectSame(fromDecimal("-1.5E3"), rational(-1500n));
    expectSame(fromDecimal(".5"), rational(1n, 2n));
    expectSame(fromDecimal(" 3. "), rational(3n));
    expect(() => fromDecimal("abc")).toThrow(RangeError);
    expect(() => fromDecimal(".")).toThrow(RangeError);
  });

  it("reads a number as JavaScript prints it, and a float exactly", () => {
    expectSame(fromNumber(0.1), rational(1n, 10n));
    expectSame(fromFloat(0.1), rational(3602879701896397n, 2n ** 55n));
    expectSame(fromNumber(1e21), rational(10n ** 21n));
    expect(() => fromNumber(Number.NaN)).toThrow(RangeError);
    expect(() => fromFloat(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("gives the exact value of the degenerate floats", () => {
    expectSame(fromFloat(Number.MIN_VALUE), rational(1n, 2n ** 1074n));
    expectSame(fromFloat(2 ** -1022), rational(1n, 2n ** 1022n));
    expectSame(fromFloat(-(2 ** -1022)), rational(-1n, 2n ** 1022n));
    expectSame(fromFloat(Number.MAX_VALUE), rational((2n ** 53n - 1n) * 2n ** 971n));
    expect(fromFloat(-0)).toEqual(ZERO);
    expect(fromFloat(0)).toEqual(ZERO);
    for (const x of [Number.MIN_VALUE, 2 ** -1022, Number.MAX_VALUE, -Number.MAX_VALUE, 2 ** -1022 - Number.MIN_VALUE]) {
      expect(toNumber(fromFloat(x))).toBe(x);
    }
  });

  it("gives the exact value of each random float, in lowest terms", () => {
    const rnd = random(10);
    for (let i = 0; i < RUNS; i += 1) {
      const x = randomDouble(rnd);
      const exact = fromFloat(x);
      expectLowest(exact);
      expect(toNumber(exact)).toBe(x);
      // a power of 2 is the denominator of each double
      expect(exact.d & (exact.d - 1n)).toBe(0n);
      expectSame(fromNumber(x), fromDecimal(String(x)));
      expect(toNumber(fromNumber(x))).toBe(x);
    }
  });
});

describe("toNumber", () => {
  /** This function tells if `x` is the nearest double to `a`, with ties to even. */
  function expectNearest(a: Rational, x: number): void {
    expect(Number.isFinite(x)).toBe(true);
    const here = abs(sub(fromFloat(x), a));
    for (const other of [nextUp(x), nextDown(x)]) {
      if (!Number.isFinite(other)) continue;
      const there = abs(sub(fromFloat(other), a));
      const order = compare(here, there);
      expect(order, `${toString(a)} gives ${x}, and ${other} is nearer`).toBeLessThanOrEqual(0);
      if (order === 0) {
        // a tie goes to the double with an even last bit
        const view = new DataView(new ArrayBuffer(8));
        view.setFloat64(0, x);
        expect(view.getUint8(7) & 1).toBe(0);
      }
    }
  }

  it("gives the nearest double to each random rational", () => {
    for (const [a] of cases(11)) expectNearest(a, toNumber(a));
  });

  it("gives the nearest double at the scales of the subnormals and of the largest doubles", () => {
    const rnd = random(12);
    for (let i = 0; i < Math.min(RUNS, 300); i += 1) {
      const a = randomRational(rnd);
      if (sign(a) === 0) continue;
      const tiny = mul(a, rational(1n, 2n ** BigInt(1000 + Math.floor(rnd() * 120))));
      expectNearest(tiny, toNumber(tiny));
      const big = mul(a, rational(2n ** BigInt(900 + Math.floor(rnd() * 100))));
      const x = toNumber(big);
      if (Number.isFinite(x)) expectNearest(big, x);
      else expect(compare(abs(big), fromFloat(Number.MAX_VALUE))).toBe(1);
    }
  });

  it("rounds the edge cases of the range", () => {
    const half = 2n ** 1075n;
    // half of the least subnormal is a tie, and the tie goes to 0
    expect(toNumber(rational(1n, half))).toBe(0);
    expect(toNumber(rational(3n, 2n * half))).toBe(Number.MIN_VALUE);
    expect(toNumber(rational(half - 1n, half * half))).toBe(0);
    expect(toNumber(rational(half + 1n, half * half))).toBe(Number.MIN_VALUE);
    expect(toNumber(rational(1n, 3n * 2n ** 1073n))).toBe(Number.MIN_VALUE);
    // the midpoint of MAX_VALUE and 2^1024 is a tie, and the tie goes to 2^1024: Infinity
    const top = 2n ** 1024n - 2n ** 970n;
    expect(toNumber(rational(3n * top, 3n))).toBe(Number.POSITIVE_INFINITY);
    expect(toNumber(rational(3n * top - 1n, 3n))).toBe(Number.MAX_VALUE);
    expect(toNumber(rational(-(3n * top - 1n), 3n))).toBe(-Number.MAX_VALUE);
    expect(toNumber(rational(2n ** 2000n, 3n))).toBe(Number.POSITIVE_INFINITY);
    // 1 + 2^-53 is a tie of 1 and 1 + 2^-52, and a remainder far below the last bit breaks the tie
    const tie = add(ONE, rational(1n, 2n ** 53n));
    const far = rational(1n, 3n * 2n ** 100n);
    expect(toNumber(tie)).toBe(1);
    expect(toNumber(add(tie, far))).toBe(1 + 2 ** -52);
    expect(toNumber(sub(tie, far))).toBe(1);
    expect(toNumber(neg(add(tie, far)))).toBe(-1 - 2 ** -52);
    expect(toNumber(ZERO)).toBe(0);
    expect(toNumber(rational(1n, 3n))).toBe(1 / 3);
    expect(toNumber(rational(10n ** 30n + 1n, 10n ** 30n))).toBe(1);
  });

  it("keeps the order of the values", () => {
    for (const [a, b] of cases(13)) {
      if (compare(a, b) <= 0) expect(toNumber(a)).toBeLessThanOrEqual(toNumber(b));
    }
  });
});

describe("the other operations", () => {
  it("refuses a zero divisor", () => {
    expect(() => div(ONE, ZERO)).toThrow(RangeError);
    expect(() => inverse(ZERO)).toThrow(RangeError);
    expect(() => pow(ZERO, -1)).toThrow(RangeError);
    expect(() => pow(ONE, 0.5)).toThrow(RangeError);
    expectSame(pow(ZERO, 0), ONE);
  });

  it("prints the fields, and the print reads back", () => {
    expect(toString(rational(-6n, 4n))).toBe("-3/2");
    expect(toString(rational(5n))).toBe("5");
    for (const [a] of cases(14)) {
      const [n = "", d = "1"] = toString(a).split("/");
      expectSame(rational(BigInt(n), BigInt(d)), a);
    }
  });

  it("gives the greatest common divisor of two integers", () => {
    expect(commonDivisor(0n, 0n)).toBe(0n);
    expect(commonDivisor(0n, -7n)).toBe(7n);
    expect(commonDivisor(-12n, 18n)).toBe(6n);
    for (const [a, b] of cases(19)) {
      const g = commonDivisor(a.n, b.n);
      if (g === 0n) continue;
      expect(g > 0n).toBe(true);
      expect(a.n % g).toBe(0n);
      expect(b.n % g).toBe(0n);
      expect(gcd(a.n / g, b.n / g)).toBe(1n);
    }
  });

  it("names cmp as compare", () => {
    expect(cmp).toBe(compare);
  });
});

describe("the roots", () => {
  it("gives the floor of the k-th root of a bigint", () => {
    const rnd = random(21);
    for (let i = 0; i < RUNS; i++) {
      const n = randomBits(rnd, 1 + Math.floor(rnd() * 300));
      const k = 1 + Math.floor(rnd() * 7);
      const K = BigInt(k);
      const r = integerRoot(n, k);
      expect(r ** K <= n, `root ${r} of ${n}, k ${k}`).toBe(true);
      expect((r + 1n) ** K > n, `root ${r} of ${n}, k ${k}`).toBe(true);
    }
    expect(integerRoot(0n, 3)).toBe(0n);
    expect(integerRoot(1n, 5)).toBe(1n);
    expect(integerRoot(2n ** 600n - 1n, 2)).toBe(2n ** 300n - 1n);
  });

  it("gives back each rational from its k-th power", () => {
    const rnd = random(22);
    for (let i = 0; i < RUNS; i++) {
      const q = randomRational(rnd);
      const k = 1 + Math.floor(rnd() * 7);
      const r = root(pow(q, k), k);
      expect(r, `root of ${toString(q)}^${k}`).not.toBeNull();
      expectLowest(r as Rational);
      expectSame(r as Rational, k % 2 === 0 ? abs(q) : q);
    }
  });

  it("gives null for a root that is not rational", () => {
    expect(root(rational(2n), 2)).toBeNull();
    expect(root(rational(9n, 2n), 2)).toBeNull();
    expect(root(rational(-16n), 3)).toBeNull();
    expectSame(root(rational(27n, 8n), 3) as Rational, rational(3n, 2n));
    expectSame(root(rational(-8n), 3) as Rational, rational(-2n));
    expectSame(root(ZERO, 4) as Rational, ZERO);
  });

  it("refuses an even root of a negative value and a bad index", () => {
    expect(() => root(rational(-4n), 2)).toThrow(RangeError);
    expect(() => root(ONE, 0)).toThrow(RangeError);
    expect(() => root(ONE, 1.5)).toThrow(RangeError);
    expect(() => integerRoot(-1n, 3)).toThrow(RangeError);
  });
});
