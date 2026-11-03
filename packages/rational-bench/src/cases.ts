/**
 * The cases of the bench: the rational steps of the tests of `@mark1russell7/quantity`, with the same inputs. Each case
 * does the steps that quantity does for one operation of its tests (`packages/quantity/src/index.test.ts` of systems).
 * The unit lookups of quantity are not rational steps, so the cases start from the factors of the units.
 *
 * @packageDocumentation
 */

/** A rational number `n / d` over `bigint`. The two arms use this shape. */
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

/** The functions of a module of rationals that the cases use. The old and the new rationals both have them. */
export interface Rationals {
  readonly ZERO: Rational;
  readonly ONE: Rational;
  readonly rational: (n: bigint, d?: bigint) => Rational;
  readonly fromDecimal: (text: string) => Rational;
  readonly fromNumber: (value: number) => Rational;
  readonly add: (a: Rational, b: Rational) => Rational;
  readonly mul: (a: Rational, b: Rational) => Rational;
  readonly div: (a: Rational, b: Rational) => Rational;
  readonly sub: (a: Rational, b: Rational) => Rational;
  readonly pow: (a: Rational, exponent: number) => Rational;
  readonly cmp: (a: Rational, b: Rational) => number;
  readonly isInteger: (a: Rational) => boolean;
  readonly toNumber: (a: Rational) => number;
}

/** One case: a name, the step of quantity that it times, and the value that the test of quantity expects. */
export interface Case {
  readonly name: string;
  /** This function does the rational steps of the operation one time, and gives its result as a number. */
  readonly run: () => number;
  readonly expected: number;
  /** The count of digits of the test of quantity, for a value that the test compares with `toBeCloseTo`. */
  readonly digits?: number;
}

/** A unit as quantity has it after its lookup: a factor to the base unit, an offset, and the HZ of a jiffy. */
interface Unit {
  readonly factor: Rational;
  readonly offset?: Rational;
  /** The exponent of the jiffy in the unit. A unit with a jiffy gets its factor from the HZ at each conversion. */
  readonly jiffies?: number;
}

/**
 * This function gives the cases with the rationals of `R`. The factors of the units come from the definitions of
 * quantity (`packages/quantity/src/units.ts` of systems). The bench makes them before it starts the timer.
 */
export function casesFor(R: Rationals): Case[] {
  const r = R.fromDecimal;
  const GALLON = R.mul(r("231"), R.pow(r("0.0254"), 3));
  const kitchen = (parts: number): Rational => R.div(GALLON, R.rational(BigInt(parts)));
  const YEAR = r("31556952");
  const JOULE = r("1000");
  const unit = (factor: Rational, offset?: Rational): Unit => (offset === undefined ? { factor } : { factor, offset });
  const per = (a: Rational, b: Rational): Unit => unit(R.div(a, b));
  const U = {
    ns: unit(r("1e-9")),
    ms: unit(r("0.001")),
    s: unit(R.ONE),
    min: unit(r("60")),
    h: unit(r("3600")),
    d: unit(r("86400")),
    mo: unit(R.div(YEAR, r("12"))),
    yr: unit(YEAR),
    km: unit(r("1000")),
    mi: unit(r("1609.344")),
    g: unit(R.ONE),
    lb: unit(r("453.59237")),
    mL: unit(r("1e-6")),
    tsp: unit(kitchen(768)),
    tbsp: unit(kitchen(256)),
    cup: unit(kitchen(16)),
    B: unit(r("8")),
    kB: unit(r("8000")),
    KiB: unit(r("8192")),
    USD: unit(R.ONE),
    K: unit(R.ONE),
    degC: unit(R.ONE, r("273.15")),
    degF: unit(R.div(r("5"), r("9")), r("459.67")),
    jiffy: { factor: R.ONE, jiffies: 1 },
    "Gbit/s": per(r("1e9"), R.ONE),
    "MB/s": per(r("8e6"), R.ONE),
    "USD/mo": per(R.ONE, R.div(YEAR, r("12"))),
    "USD/yr": per(R.ONE, YEAR),
    "kcal/(h·kg)": per(R.mul(JOULE, r("4184")), R.mul(r("3600"), r("1000"))),
    "W/kg": per(JOULE, r("1000")),
    "degF/h": per(R.div(r("5"), r("9")), r("3600")),
    "degC/h": per(R.ONE, r("3600")),
    "{set}/wk": per(R.ONE, r("604800")),
    "{set}/d": per(R.ONE, r("86400")),
  } satisfies Record<string, Unit>;
  type Name = keyof typeof U;

  // The steps of factorOn of quantity: a jiffy gets its size from the HZ, at each conversion
  const factorOn = (u: Unit, hz: number | undefined): Rational =>
    u.jiffies === undefined ? u.factor : R.mul(u.factor, R.pow(R.rational(1n, BigInt(hz ?? 0)), u.jiffies));
  // The steps of convertExact of quantity: base = (value + offset) × factor, then the same back in the other unit
  const convertExact = (value: Rational, from: Name, to: Name, hz?: number): Rational => {
    const a: Unit = U[from];
    const b: Unit = U[to];
    const base = R.mul(R.add(value, a.offset ?? R.ZERO), factorOn(a, hz));
    return R.sub(R.div(base, factorOn(b, hz)), b.offset ?? R.ZERO);
  };
  const exact = (value: number, from: Name, to: Name): Rational => convertExact(R.fromNumber(value), from, to);
  const convert = (value: number, from: Name, to: Name, hz?: number): number =>
    R.toNumber(convertExact(R.fromNumber(value), from, to, hz));
  const sum = (values: readonly number[], u: Name): number =>
    R.toNumber(values.reduce((acc, value) => R.add(acc, exact(value, u, u)), R.ZERO));
  // The steps of toNanoseconds of quantity: the exact value in ns, the integer test and the number of ns
  const ns = (value: number, from: Name, hz?: number): number => {
    const t = convertExact(R.fromNumber(value), from, "ns", hz);
    if (!R.isInteger(t)) return -1;
    const count = Number(t.n);
    return Number.isSafeInteger(count) ? count : -2;
  };

  const c = (name: string, run: () => number, expected: number, digits?: number): Case =>
    digits === undefined ? { name, run, expected } : { name, run, expected, digits };
  return [
    c("convert-s-min", () => convert(7875, "s", "min"), 131.25),
    c("convert-mi-km", () => convert(1, "mi", "km"), 1.609344),
    c("convert-cup-mL", () => convert(1, "cup", "mL"), 236.5882365),
    c("convert-tsp-tbsp", () => convert(3, "tsp", "tbsp"), 1),
    c("convert-lb-g", () => convert(1, "lb", "g"), 453.59237),
    c("convert-KiB-B", () => convert(1, "KiB", "B"), 1024),
    c("convert-kB-B", () => convert(1, "kB", "B"), 1000),
    c("convert-Gbit/s-MB/s", () => convert(1, "Gbit/s", "MB/s"), 125),
    c("convert-mo-d", () => convert(1, "mo", "d"), 30.436875),
    c("convert-USD/mo-USD/yr", () => convert(500, "USD/mo", "USD/yr"), 6000),
    c("convert-kcal/(h·kg)-W/kg", () => convert(1, "kcal/(h·kg)", "W/kg"), 1.1622, 4),
    c("convert-degF-degC", () => convert(212, "degF", "degC"), 100),
    c("convert-degC-degF", () => convert(-40, "degC", "degF"), -40),
    c("convert-degC-K", () => convert(0, "degC", "K"), 273.15),
    c("convert-degF/h-degC/h", () => convert(9, "degF/h", "degC/h"), 5),
    c("convert-jiffy-ms", () => convert(1, "jiffy", "ms", 250), 4),
    c("convert-jiffy-s", () => convert(250, "jiffy", "s", 250), 1),
    c("convert-set/wk-set/d", () => convert(3, "{set}/wk", "{set}/d"), 3 / 7, 12),
    c("valueIn-h-min", () => convert(2, "h", "min"), 120),
    c("add-USD", () => R.toNumber(R.add(exact(0.1, "USD", "USD"), exact(0.2, "USD", "USD"))), 0.3),
    c("sum-USD", () => sum([19.99, 0.01, -5], "USD"), 15),
    c("sum-empty", () => sum([], "USD"), 0),
    c("add-h-min", () => R.toNumber(R.add(exact(1, "h", "h"), exact(30, "min", "h"))), 1.5),
    c("mean-min", () => R.toNumber(R.div(R.add(exact(60, "min", "min"), exact(2, "h", "min")), R.rational(2n))), 90),
    c("compare-90s-1.5min", () => R.cmp(exact(90, "s", "s"), exact(1.5, "min", "s")), 0),
    c("compare-61s-1min", () => R.cmp(exact(61, "s", "s"), exact(1, "min", "s")), 1),
    c("ns-1.5s", () => ns(1.5, "s"), 1_500_000_000),
    c("ns-200ms", () => ns(200, "ms"), 200_000_000),
    c("ns-jiffy", () => ns(1, "jiffy", 250), 4_000_000),
    c("ns-0.5ns", () => ns(0.5, "ns"), -1),
    c("ns-1yr", () => ns(1, "yr"), -2),
    c("scale-0.2s-1023", () => R.toNumber(R.mul(R.fromNumber(0.2), R.fromNumber(1023))), 204.6),
  ];
}
