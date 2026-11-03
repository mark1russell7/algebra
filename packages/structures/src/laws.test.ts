import { describe, expect, it } from "vitest";
import { random } from "@mark1russell7/rigor-generators";
import {
  BOOLEAN_RING,
  CATALOG,
  DEFAULT_SAMPLES,
  LAW_NAMES,
  LAWS,
  MAX_MODULUS,
  RATIONAL_FIELD,
  RATIONALS,
  checkClaims,
  integersMod,
  isPrime,
  partsOf,
  primeField,
} from "./index.ts";
import type { AnyStructure, LawReport } from "./index.ts";

/** CI can raise the count of samples of a long run. The default run stays short. */
const SAMPLES = Number(process.env["STRUCTURE_SAMPLES"] ?? DEFAULT_SAMPLES);

const LARGEST_PRIME_BELOW_2_32 = 4294967291n;

/** This function gives each claim of a structure and of its parts, as path and law. */
const claimsOf = (structure: AnyStructure, path: string = structure.name): readonly string[] => [
  ...Object.keys(structure.claims).map((law) => `${path}: ${law}`),
  ...partsOf(structure).flatMap(([field, part]) => claimsOf(part, `${path}/${field}`)),
];

const failures = (reports: readonly LawReport[]): readonly LawReport[] => reports.filter((report) => report.failure !== null);

describe("the catalog of laws", () => {
  it("names each law under its own key, with a statement and an arity", () => {
    for (const [key, law] of Object.entries(LAWS)) {
      expect(law.name).toBe(key);
      expect(law.statement.length).toBeGreaterThan(0);
      expect([0, 1, 2, 3]).toContain(law.arity);
      expect(law.check).toBeTypeOf("function");
    }
    expect(LAW_NAMES).toHaveLength(Object.keys(LAWS).length);
  });
});

describe("each claimed law of each instance", () => {
  const instances: readonly AnyStructure[] = [...CATALOG, integersMod(1n), integersMod(2n), integersMod(12n), primeField(2n), primeField(97n), integersMod(MAX_MODULUS), primeField(LARGEST_PRIME_BELOW_2_32)];

  it.each(instances.map((instance) => [instance.name, instance] as const))("%s passes", (_, instance) => {
    const reports = checkClaims(instance, { samples: SAMPLES });
    expect(failures(reports)).toEqual([]);
    expect(reports.map((report) => `${report.path}: ${report.law}`).sort()).toEqual([...claimsOf(instance)].sort());
    for (const report of reports) {
      if (report.exhaustive) expect(report.cases).toBeGreaterThan(0);
      else expect(report.cases).toBe(SAMPLES);
    }
  });

  it("the sampled laws have at least 500 cases", () => {
    const reports = checkClaims(RATIONAL_FIELD);
    expect(reports.every((report) => report.exhaustive || report.cases >= 500)).toBe(true);
    expect(reports.some((report) => !report.exhaustive)).toBe(true);
  });

  it("examines each tuple of a small finite carrier", () => {
    const seven = checkClaims(primeField(7n));
    const associative = seven.find((report) => report.law === "associative" && report.path === "Z/7/additive");
    expect(associative).toMatchObject({ exhaustive: true, cases: 7 ** 3 });
    const inverse = seven.find((report) => report.law === "leftInverse" && report.path === "Z/7/units");
    expect(inverse).toMatchObject({ exhaustive: true, cases: 6 });
    const bool = checkClaims(BOOLEAN_RING).find((report) => report.law === "leftDistributive");
    expect(bool).toMatchObject({ exhaustive: true, cases: 8 });
    const nontrivial = seven.find((report) => report.law === "nontrivial");
    expect(nontrivial).toMatchObject({ exhaustive: true, cases: 1 });
  });

  it("gives the same reports for the same seed", () => {
    expect(checkClaims(RATIONAL_FIELD, { seed: 9, samples: 50 })).toEqual(checkClaims(RATIONAL_FIELD, { seed: 9, samples: 50 }));
  });
});

describe("the exact carriers", () => {
  it("use exact equality: the text of two equal values is one text", () => {
    const exact = CATALOG.filter((structure) => structure.carrier.exact);
    expect(exact.length).toBeGreaterThanOrEqual(6);
    for (const { carrier } of exact) {
      const draw = random(`exact ${carrier.name}`);
      for (let i = 0; i < 200; i += 1) {
        const [a, b] = [carrier.sample(draw), carrier.sample(draw)];
        expect(carrier.equals(a, a)).toBe(true);
        expect(carrier.equals(a, b)).toBe(carrier.show(a) === carrier.show(b));
      }
    }
  });

  it("the rationals keep lowest terms: a value that is not in lowest terms is not a member", () => {
    expect(RATIONALS.contains({ n: 2n, d: 4n })).toBe(false);
    expect(RATIONALS.contains({ n: 1n, d: -2n })).toBe(false);
    expect(RATIONALS.contains({ n: 1n, d: 2n })).toBe(true);
  });
});

describe("the integers modulo n", () => {
  it("tells the primes", () => {
    const primes = Array.from({ length: 50 }, (_, i) => BigInt(i)).filter(isPrime);
    expect(primes).toEqual([2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n]);
    expect(isPrime(LARGEST_PRIME_BELOW_2_32)).toBe(true);
    expect(isPrime(MAX_MODULUS - 1n)).toBe(false);
  });

  it("refuses a field for a composite, and a modulus out of the range", () => {
    expect(() => primeField(6n)).toThrow(RangeError);
    expect(() => primeField(1n)).toThrow(RangeError);
    expect(() => integersMod(0n)).toThrow(RangeError);
    expect(() => integersMod(MAX_MODULUS + 1n)).toThrow(RangeError);
  });
});
