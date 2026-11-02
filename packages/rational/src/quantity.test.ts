/**
 * The tests of `@mark1russell7/quantity` (systems, `packages/quantity/src/index.test.ts`) that use its rationals,
 * as the rational steps that quantity does. Each factor and each expected value is the one of quantity.
 */
import { describe, expect, it } from "vitest";
import {
  ONE,
  type Rational,
  ZERO,
  add,
  cmp,
  div,
  fromDecimal,
  fromNumber,
  isInteger,
  mul,
  pow,
  rational,
  sub,
  toNumber,
} from "./index.ts";

const r = (text: string): Rational => fromDecimal(text);

/** The factors of quantity, in its base units: the second, the metre, the gram, the kelvin and the bit. */
const GALLON = mul(r("231"), pow(r("0.0254"), 3));
const kitchen = (parts: number): Rational => div(GALLON, rational(BigInt(parts)));
const YEAR = r("31556952");
const JOULE = r("1000");
const F = {
  ns: r("1e-9"),
  ms: r("0.001"),
  s: ONE,
  min: r("60"),
  h: r("3600"),
  d: r("86400"),
  wk: r("604800"),
  mo: div(YEAR, r("12")),
  yr: YEAR,
  m: ONE,
  km: r("1000"),
  mi: r("1609.344"),
  g: ONE,
  kg: r("1000"),
  lb: r("453.59237"),
  mL: r("1e-6"),
  tsp: kitchen(768),
  tbsp: kitchen(256),
  cup: kitchen(16),
  bit: ONE,
  B: r("8"),
  kB: r("8000"),
  KiB: r("8192"),
  MB: r("8e6"),
  Gbit: r("1e9"),
  W: JOULE,
  kcal: mul(JOULE, r("4184")),
} as const;

/** The affine scales of temperature: base = (value + offset) × factor. */
const TEMPERATURE = {
  K: { offset: ZERO, factor: ONE },
  degC: { offset: r("273.15"), factor: ONE },
  degF: { offset: r("459.67"), factor: div(r("5"), r("9")) },
} as const;

/** This function is the conversion of quantity for a unit with no offset: `value × from / to`. */
function convertExact(value: Rational, from: Rational, to: Rational): Rational {
  return div(mul(value, from), to);
}

function convert(value: number, from: Rational, to: Rational): number {
  return toNumber(convertExact(fromNumber(value), from, to));
}

function convertTemperature(value: number, from: keyof typeof TEMPERATURE, to: keyof typeof TEMPERATURE): number {
  const a = TEMPERATURE[from];
  const b = TEMPERATURE[to];
  const base = mul(add(fromNumber(value), a.offset), a.factor);
  return toNumber(sub(div(base, b.factor), b.offset));
}

describe("the conversions of quantity", () => {
  it("converts exactly by rational factors (SYSTEMS.md §9)", () => {
    expect(convert(7875, F.s, F.min)).toBe(131.25);
    expect(convert(1, F.mi, F.km)).toBe(1.609344);
    expect(convert(1, F.cup, F.mL)).toBe(236.5882365);
    expect(convert(3, F.tsp, F.tbsp)).toBe(1);
    expect(convert(1, F.lb, F.g)).toBe(453.59237);
    expect(convert(1, F.KiB, F.B)).toBe(1024);
    expect(convert(1, F.kB, F.B)).toBe(1000);
    expect(convert(1, div(F.Gbit, F.s), div(F.MB, F.s))).toBe(125);
    expect(convert(1, F.mo, F.d)).toBe(30.436875);
    expect(convert(500, div(ONE, F.mo), div(ONE, F.yr))).toBe(6000);
    expect(convert(1, div(F.kcal, mul(F.h, F.kg)), div(F.W, F.kg))).toBeCloseTo(1.1622, 4);
  });

  it("converts the affine temperature scales, and a compound of one as a difference", () => {
    expect(convertTemperature(212, "degF", "degC")).toBe(100);
    expect(convertTemperature(-40, "degC", "degF")).toBe(-40);
    expect(convertTemperature(0, "degC", "K")).toBe(273.15);
    // a rate of change has no zero point: 9 °F/h is 5 °C/h
    expect(convert(9, div(TEMPERATURE.degF.factor, F.h), div(TEMPERATURE.degC.factor, F.h))).toBe(5);
  });

  it("measures a jiffy by the HZ of the kernel", () => {
    const jiffy = div(ONE, rational(250n));
    expect(convert(1, jiffy, F.ms)).toBe(4);
    expect(convert(250, jiffy, F.s)).toBe(1);
  });

  it("converts a count per week to a count per day", () => {
    expect(convert(3, div(ONE, F.wk), div(ONE, F.d))).toBeCloseTo(3 / 7, 12);
  });
});

describe("the arithmetic of quantity", () => {
  it("adds money to the cent", () => {
    expect(toNumber(add(fromNumber(0.1), fromNumber(0.2)))).toBe(0.3);
    const total = [19.99, 0.01, -5].reduce((acc, value) => add(acc, fromNumber(value)), ZERO);
    expect(toNumber(total)).toBe(15);
    expect(toNumber(ZERO)).toBe(0);
    expect(toNumber(add(fromNumber(1), convertExact(fromNumber(30), F.min, F.h)))).toBe(1.5);
  });

  it("gives the mean of amounts in one unit", () => {
    const total = add(convertExact(fromNumber(60), F.min, F.min), convertExact(fromNumber(2), F.h, F.min));
    expect(toNumber(div(total, rational(2n)))).toBe(90);
  });

  it("orders amounts across units", () => {
    expect(cmp(fromNumber(90), convertExact(fromNumber(1.5), F.min, F.s))).toBe(0);
    expect(cmp(fromNumber(61), convertExact(fromNumber(1), F.min, F.s))).toBe(1);
    expect(cmp(fromNumber(1e9), fromNumber(1e9))).toBe(0);
  });

  it("keeps the clock of the simulator in whole nanoseconds, or refuses", () => {
    const ns = (value: number, unit: Rational): Rational => convertExact(fromNumber(value), unit, F.ns);
    expect(Number(ns(1.5, F.s).n)).toBe(1_500_000_000);
    expect(Number(ns(200, F.ms).n)).toBe(200_000_000);
    expect(Number(ns(1, div(ONE, rational(250n))).n)).toBe(4_000_000);
    expect(isInteger(ns(1.5, F.s))).toBe(true);
    expect(isInteger(ns(0.5, F.ns))).toBe(false);
    const year = ns(1, F.yr);
    expect(isInteger(year)).toBe(true);
    expect(Number.isSafeInteger(Number(year.n))).toBe(false);
  });

  it("multiplies an amount by a plain number", () => {
    // 0.2 s × 1023 is exactly 204.6 s (the README of quantity)
    expect(toNumber(mul(fromNumber(0.2), fromNumber(1023)))).toBe(204.6);
  });
});
