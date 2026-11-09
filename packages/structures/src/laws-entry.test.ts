import { describe, expect, it } from "vitest";
import type { Random } from "@mark1russell7/rigor-generators";
import { arrayMonad, numberOrder, sortedSetLattice, sumMonoid } from "./index.ts";
import type { BoundedLattice, Functor, Group, Lattice, Monad, Monoid, Order, Semigroup } from "./index.ts";
import {
  assertLaws,
  checkBoundedLattice,
  checkFunctor,
  checkGroup,
  checkLattice,
  checkMonad,
  checkMonoid,
  checkOrder,
  checkSemigroup,
  lawFailures,
  structuralEquals,
} from "./laws-entry.ts";
import type { Arbitrary, LawReport } from "./laws-entry.ts";

const integers: Arbitrary<number> = { sample: (r) => r.int(-50, 50) };
const sets = (r: Random): readonly number[] => [...new Set(Array.from({ length: r.int(0, 5) }, () => r.int(0, 6)))].sort((a, b) => a - b);
const lists = (r: Random): readonly number[] => Array.from({ length: r.int(0, 4) }, () => r.int(-9, 9));
const functions = [(a: number) => a + 1, (a: number) => a * 2];
const kleisli = [(a: number) => [a, a + 1], (a: number) => (a > 0 ? [a] : [])];

/** This function gives the names of the failing laws. */
const failing = (reports: readonly LawReport<string>[]): readonly string[] => lawFailures(reports).map((r) => r.law);

describe("a planted break of each interface fails its check", () => {
  it("semigroup: a subtraction is not associative", () => {
    const minus: Semigroup<number> = { combine: (a, b) => a - b };
    expect(failing(checkSemigroup(minus, integers))).toEqual(["associative"]);
  });

  it("monoid: a wrong identity fails the two identity laws", () => {
    const wrong: Monoid<number> = { empty: 1, combine: sumMonoid.combine };
    expect(failing(checkMonoid(wrong, integers))).toEqual(["leftIdentity", "rightIdentity"]);
  });

  it("monoid: a claim of commutativity of a join of strings fails", () => {
    const join: Monoid<string> = { empty: "", combine: (a, b) => a + b };
    expect(failing(checkMonoid(join, { sample: (r) => r.pick(["a", "b"]) }, { commutative: true }))).toEqual(["commutative"]);
  });

  it("group: a wrong inverse fails the two inverse laws", () => {
    const wrong: Group<number> = { ...sumMonoid, invert: (a) => a };
    expect(failing(checkGroup(wrong, integers))).toEqual(["leftInverse", "rightInverse"]);
  });

  it("order: a compare that is not antisymmetric in its sign fails", () => {
    const flat: Order<number> = { compare: (a, b) => (a === b ? -1 : numberOrder.compare(a, b)) };
    expect(failing(checkOrder(flat, integers))).toEqual(["signAntisymmetric", "zeroIsEqual"]);
  });

  it("order: a compare that ignores a part of the value fails zeroIsEqual", () => {
    const byTens: Order<number> = { compare: (a, b) => Math.trunc(a / 10) - Math.trunc(b / 10) };
    expect(failing(checkOrder(byTens, integers))).toEqual(["antisymmetric", "zeroIsEqual"]);
  });

  it("order: a compare that is not transitive fails", () => {
    const rock: Order<number> = { compare: (a, b) => (a === b ? 0 : (((b - a) % 3) + 3) % 3 === 1 ? -1 : 1) };
    expect(failing(checkOrder(rock, { sample: (r) => r.int(0, 2), elements: [0, 1, 2] }))).toContain("transitive");
  });

  it("lattice: a join that does not absorb the meet fails", () => {
    const base = sortedSetLattice(numberOrder);
    const wrong: Lattice<readonly number[]> = { meet: base.meet, join: (a, b) => (a.length >= b.length ? a : b) };
    const failures = failing(checkLattice(wrong, { sample: sets }));
    expect(failures).toContain("joinAgrees");
    expect(failures.length).toBeGreaterThan(0);
  });

  it("bounded lattice: a wrong top fails the identity of the meet", () => {
    const wrong: BoundedLattice<boolean> = { meet: (a, b) => a && b, join: (a, b) => a || b, top: false, bottom: false };
    const reports = checkBoundedLattice(wrong, { sample: (r) => r.chance(0.5), elements: [false, true] });
    expect(lawFailures(reports).map((r) => `${r.path} ${r.law}`)).toEqual(["bounded-lattice/meet leftIdentity", "bounded-lattice/meet rightIdentity"]);
  });

  it("functor: a map that drops a value fails the identity law", () => {
    const dropping: Functor<"Array"> = { map: (fa, f) => fa.slice(1).map((a) => f(a)) };
    expect(failing(checkFunctor(dropping, { sample: lists, functions }))).toContain("mapIdentity");
  });

  it("monad: an of that doubles the value fails the identity laws", () => {
    const doubled: Monad<"Array"> = { ...arrayMonad, of: (a) => [a, a] };
    const failures = failing(checkMonad(doubled, { sample: lists, functions, kleisli, value: (r) => r.int(-9, 9) }));
    expect(failures).toEqual(expect.arrayContaining(["leftIdentity", "rightIdentity", "mapAgrees"]));
  });

  it("monad: a flatMap that reverses each result fails the left identity", () => {
    const reversing: Monad<"Array"> = { ...arrayMonad, flatMap: (fa, f) => fa.flatMap((a) => [...f(a)].reverse()) };
    const failures = failing(checkMonad(reversing, { sample: lists, functions, kleisli, value: (r) => r.int(-9, 9) }));
    expect(failures).toContain("leftIdentity");
  });
});

describe("the reports of a check", () => {
  it("the same seed gives the same reports", () => {
    const minus: Semigroup<number> = { combine: (a, b) => a - b };
    expect(checkSemigroup(minus, integers, { seed: 7 })).toEqual(checkSemigroup(minus, integers, { seed: 7 }));
  });

  it("a small finite set gets each tuple", () => {
    const reports = checkMonoid(sumMonoid, { sample: (r) => r.int(0, 1), elements: [0, 1, 2] }, { commutative: true });
    const associative = reports.find((r) => r.law === "associative");
    expect(associative?.exhaustive).toBe(true);
    expect(associative?.cases).toBe(27);
  });

  it("assertLaws names the law, the seed and the failing values", () => {
    const wrong: Monoid<number> = { empty: 1, combine: sumMonoid.combine };
    expect(() => assertLaws(checkMonoid(wrong, integers, { name: "wrong-sum" }))).toThrow(/wrong-sum leftIdentity \(seed \d+, case 1\): -?\d+/);
  });

  it("a functor check with no function is an error", () => {
    expect(() => checkFunctor(arrayMonad, { sample: lists, functions: [] })).toThrow(RangeError);
  });

  it("structuralEquals compares arrays and plain objects by their parts", () => {
    expect(structuralEquals([1, { a: [2] }], [1, { a: [2] }])).toBe(true);
    expect(structuralEquals({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(structuralEquals(Number.NaN, Number.NaN)).toBe(true);
    expect(structuralEquals(0, -0)).toBe(false);
    expect(structuralEquals(new Date(0), new Date(0))).toBe(false);
  });
});
