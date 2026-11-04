import { describe, expect, it } from "vitest";
import {
  CATALOG,
  DOUBLE_ADD,
  DOUBLE_LATTICE,
  DOUBLES,
  checkClaims,
  holdsAt,
  integersMod,
  partsOf,
  primeField,
  withoutZero,
} from "./index.ts";
import type { AnyStructure, Commutative, Field, Group, LawReport, Magma, Refutation, UnitalMagma } from "./index.ts";

const failuresOf = (reports: readonly LawReport[]): readonly LawReport[] => reports.filter((report) => report.failure !== null);

const walk = (structure: AnyStructure): readonly AnyStructure[] => [structure, ...partsOf(structure).flatMap(([, part]) => walk(part))];

describe("double add", () => {
  it("does not claim associativity", () => {
    expect(DOUBLE_ADD.claims).not.toHaveProperty("associative");
    expect(DOUBLE_ADD.level).toBe("unital-magma");
  });

  it("states a refutation that fails the law when the runner replays it", () => {
    const refuted = DOUBLE_ADD.refuted ?? [];
    expect(refuted.map((entry) => entry.law)).toEqual(["associative"]);
    expect(holdsAt(DOUBLE_ADD, "associative", [0.1, 0.2, 0.3])).toBe(false);
    expect(0.1 + 0.2 + 0.3).toBe(0.6000000000000001);
    expect(0.1 + (0.2 + 0.3)).toBe(0.6);
  });

  it("has the identity -0, and +0 fails at -0", () => {
    expect(Object.is(DOUBLE_ADD.identity.value, -0)).toBe(true);
    const withPositiveZero: UnitalMagma<number> = { ...DOUBLE_ADD, identity: { ...DOUBLE_ADD.identity, value: 0 } };
    expect(holdsAt(withPositiveZero, "leftIdentity", [-0])).toBe(false);
    expect(holdsAt(withPositiveZero, "rightIdentity", [-0])).toBe(false);
    expect(holdsAt(withPositiveZero, "leftIdentity", [1])).toBe(true);
    expect(holdsAt(DOUBLE_ADD, "leftIdentity", [-0])).toBe(true);
    expect(holdsAt(DOUBLE_ADD, "rightIdentity", [0])).toBe(true);
  });

  it("has no inverse: a value and its negative give +0, and the infinities give NaN", () => {
    expect(Object.is(1 + -1, DOUBLE_ADD.identity.value)).toBe(false);
    expect(Number.POSITIVE_INFINITY + Number.NEGATIVE_INFINITY).toBeNaN();
    const forged: Group<number> = {
      ...DOUBLE_ADD,
      level: "group",
      inverse: { name: "neg", symbol: "-", arity: 1, apply: (a) => -a },
      claims: {
        ...DOUBLE_ADD.claims,
        associative: true,
        inverseClosed: true,
        leftInverse: true,
        rightInverse: true,
      },
    };
    expect(holdsAt(forged, "leftInverse", [1])).toBe(false);
  });
});

describe("each refutation of the catalog", () => {
  const refuted = CATALOG.flatMap(walk).flatMap((structure) => (structure.refuted ?? []).map((entry: Refutation<unknown>) => [structure, entry] as const));

  it("fails its law, and the structure does not claim it", () => {
    expect(refuted.length).toBeGreaterThan(0);
    for (const [structure, entry] of refuted) {
      expect(holdsAt(structure, entry.law, entry.arguments)).toBe(false);
      expect(structure.claims).not.toHaveProperty(entry.law);
    }
  });
});

describe("a forged claim", () => {
  it("gives a failure on double add with the arguments of a counterexample", () => {
    const forged: Magma<number> = { ...DOUBLE_ADD, refuted: [], claims: { ...DOUBLE_ADD.claims, associative: true } };
    const failures = failuresOf(checkClaims(forged));
    expect(failures.map((report) => report.law)).toEqual(["associative"]);
    expect(failures[0]?.failure).toHaveLength(3);
    expect(failures[0]?.cases).toBeLessThan(500);
  });

  it("gives a failure on a group of units of the integers modulo 6", () => {
    const ring = integersMod(6n);
    const seven = primeField(7n);
    const units: Commutative<Group<bigint>> = {
      ...ring.multiplicative,
      level: "group",
      name: "Z/6* (×)",
      carrier: withoutZero("Z/6*", ring.carrier, 0n),
      inverse: { name: "inverse", symbol: "⁻¹", arity: 1, apply: (a) => a },
      claims: seven.units.claims,
    };
    const forged: Field<bigint> = { ...ring, level: "field", units, claims: seven.claims };
    const failures = failuresOf(checkClaims(forged)).map((report) => `${report.path}: ${report.law}`);
    // 2 × 3 is 0, so the units are not closed, and 2 has no inverse
    expect(failures).toContain("Z/6/units: closed");
    expect(failures).toContain("Z/6/units: leftInverse");
    expect(failuresOf(checkClaims(forged))[0]?.failure).toBeDefined();
  });

  it("gives a failure on the law of absorption when NaN joins the carrier of min and max", () => {
    const forged = { ...DOUBLE_LATTICE, carrier: DOUBLES };
    expect(holdsAt(forged, "meetAbsorbs", [1, Number.NaN])).toBe(false);
    expect(failuresOf(checkClaims(forged)).map((report) => report.law)).toContain("meetAbsorbs");
  });

  it("gives a failure when a check throws", () => {
    const forged: Magma<bigint> = {
      ...integersMod(5n).additive,
      op: {
        name: "div",
        symbol: "/",
        arity: 2,
        apply: (a, b) => a / b,
      },
    };
    expect(holdsAt(forged, "closed", [1n, 0n])).toBe(false);
  });
});
