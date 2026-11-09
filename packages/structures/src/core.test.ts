import { describe, expect, it } from "vitest";
import type { Random } from "@mark1russell7/rigor-generators";
import {
  allMonoid,
  anyMonoid,
  arrayMonad,
  arrayMonoid,
  bigintOrder,
  bigintProduct,
  bigintSum,
  booleanLattice,
  booleanOrder,
  dualMonoid,
  firstSemigroup,
  fold,
  foldMap,
  lastSemigroup,
  latticeOfOrder,
  maxMonoid,
  minMonoid,
  numberLattice,
  numberOrder,
  orderBy,
  orderingOf,
  pairMonoid,
  productMonoid,
  recordMonoid,
  reverseOrder,
  sortedSetLattice,
  sortedUnionMonoid,
  stringMonoid,
  stringOrder,
  structMonoid,
  sumMonoid,
  thenOrder,
  xorGroup,
} from "./index.ts";
import type { Functor, Kind, Monoid } from "./index.ts";
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
} from "./laws-entry.ts";
import type { Arbitrary } from "./laws-entry.ts";

// A made-up type constructor, added to the registry as an adopter adds its own.
interface Tagged<A> {
  readonly tag: string;
  readonly value: A;
}
declare module "./core/interfaces.ts" {
  interface Kinds<A> {
    readonly Tagged: Tagged<A>;
  }
}

const safeIntegers: Arbitrary<number> = { sample: (r) => r.pick([0, 1, -1, Number.MAX_SAFE_INTEGER >> 1, r.int(-1000, 1000)]) };
const smallIntegers: Arbitrary<number> = { sample: (r) => r.int(-30, 30) };
const doubles: Arbitrary<number> = { sample: (r) => r.pick([0, -0, 1, -1, Infinity, -Infinity, r.normal(0, 1e6)]) };
const bigints: Arbitrary<bigint> = { sample: (r) => BigInt(r.int(-1e6, 1e6)) * BigInt(r.int(-1e6, 1e6)) };
const booleans: Arbitrary<boolean> = { sample: (r) => r.chance(0.5), elements: [false, true] };
const words: Arbitrary<string> = { sample: (r) => r.pick(["", "a", "b", "ab", "ba", "é", "\u{1F600}"]) };
const sortedSets = (r: Random): readonly number[] => [...new Set(Array.from({ length: r.int(0, 6) }, () => r.int(0, 9)))].sort((a, b) => a - b);

describe("the instances of the core", () => {
  it("each number monoid passes its laws on its exact values", () => {
    assertLaws(checkGroup(sumMonoid, safeIntegers, { name: "sum", commutative: true }));
    assertLaws(checkMonoid(productMonoid, smallIntegers, { name: "product", commutative: true }));
    assertLaws(checkMonoid(minMonoid, doubles, { name: "min", commutative: true, idempotent: true }));
    assertLaws(checkMonoid(maxMonoid, doubles, { name: "max", commutative: true, idempotent: true }));
  });

  it("the sum of doubles is not associative, and the check finds it", () => {
    const floats: Arbitrary<number> = { sample: (r) => r.normal(0, 1) };
    const reports = checkMonoid(sumMonoid, floats, { name: "double-sum" });
    expect(reports.find((r) => r.law === "associative")?.failure).not.toBeNull();
  });

  it("the bigint, boolean and string instances pass their laws", () => {
    assertLaws(checkGroup(bigintSum, bigints, { commutative: true }));
    assertLaws(checkMonoid(bigintProduct, bigints, { commutative: true }));
    assertLaws(checkMonoid(allMonoid, booleans, { commutative: true, idempotent: true }));
    assertLaws(checkMonoid(anyMonoid, booleans, { commutative: true, idempotent: true }));
    assertLaws(checkGroup(xorGroup, booleans, { commutative: true }));
    assertLaws(checkMonoid(stringMonoid, words));
    assertLaws(checkSemigroup(firstSemigroup<string>(), words, { idempotent: true }));
    assertLaws(checkSemigroup(lastSemigroup<string>(), words, { idempotent: true }));
    assertLaws(checkMonoid(arrayMonoid<number>(), { sample: sortedSets }));
  });

  it("the sorted union is a commutative idempotent monoid, and the sorted sets are a distributive lattice", () => {
    assertLaws(checkMonoid(sortedUnionMonoid(numberOrder), { sample: sortedSets }, { commutative: true, idempotent: true }));
    assertLaws(checkLattice(sortedSetLattice(numberOrder), { sample: sortedSets }, { distributive: true }));
    expect(sortedUnionMonoid(numberOrder).combine([1, 3, 5], [2, 3, 6])).toEqual([1, 2, 3, 5, 6]);
    expect(sortedSetLattice(numberOrder).meet([1, 3, 5], [2, 3, 5, 6])).toEqual([3, 5]);
  });

  it("the orders pass their laws", () => {
    assertLaws(checkOrder(numberOrder, { ...doubles, equals: (a, b) => a === b }));
    assertLaws(checkOrder(bigintOrder, bigints));
    assertLaws(checkOrder(stringOrder, words));
    assertLaws(checkOrder(booleanOrder, booleans));
    assertLaws(checkOrder(reverseOrder(numberOrder), smallIntegers));
    assertLaws(checkOrder(thenOrder(orderBy(numberOrder, (s: string) => s.length), stringOrder), words));
  });

  it("the lattices pass their laws", () => {
    assertLaws(checkBoundedLattice(booleanLattice, booleans, { distributive: true }));
    assertLaws(checkBoundedLattice(numberLattice, doubles, { distributive: true }));
    assertLaws(checkLattice(latticeOfOrder(stringOrder), words, { distributive: true }));
  });

  it("the array monad passes the laws of a functor and of a monad", () => {
    const lists = (r: Random): readonly number[] => Array.from({ length: r.int(0, 4) }, () => r.int(-9, 9));
    const functions = [(a: number) => a + 1, (a: number) => a * 2, (a: number) => -a];
    const kleisli = [(a: number) => [a, a], (_a: number) => [], (a: number) => [a - 1, a + 1, a * 3]];
    assertLaws(checkFunctor(arrayMonad, { sample: lists, functions }));
    assertLaws(checkMonad(arrayMonad, { sample: lists, functions, kleisli, value: (r) => r.int(-9, 9) }));
  });
});

describe("the helpers of the core", () => {
  it("fold and foldMap combine in order from the identity", () => {
    expect(fold(stringMonoid, ["a", "b", "c"])).toBe("abc");
    expect(fold(stringMonoid, [])).toBe("");
    expect(foldMap(sumMonoid, ["ab", "cde"], (s) => s.length)).toBe(5);
    expect(fold(dualMonoid(stringMonoid), ["a", "b", "c"])).toBe("cba");
  });

  it("the products of monoids pass the laws of a monoid", () => {
    const pairs = pairMonoid(sumMonoid, stringMonoid);
    assertLaws(checkMonoid(pairs, { sample: (r) => [r.int(-9, 9), r.pick(["", "x", "yz"])] as const }));
    const counts = structMonoid<{ readonly n: number; readonly any: boolean }>({ n: sumMonoid, any: anyMonoid });
    assertLaws(checkMonoid(counts, { sample: (r) => ({ n: r.int(-9, 9), any: r.chance(0.5) }) }, { commutative: true }));
    const costs = recordMonoid(sumMonoid);
    const record = (r: Random): Readonly<Record<string, number>> =>
      Object.fromEntries(r.sample(["add", "mul", "div"], r.int(0, 3)).map((key) => [key, r.int(0, 9)]));
    assertLaws(checkMonoid(costs, { sample: record }, { commutative: true }));
    expect(costs.combine({ mul: 1, add: 2 }, { add: 3, div: 4 })).toEqual({ add: 5, div: 4, mul: 1 });
  });

  it("orderingOf gives the sign of a comparison", () => {
    expect([orderingOf(-7), orderingOf(0), orderingOf(-0), orderingOf(3)]).toEqual([-1, 0, 0, 1]);
  });

  it("a monoid with methods is an instance with no adapter", () => {
    const counter: Monoid<number> = {
      empty: 0,
      combine(a: number, b: number): number {
        return a + b;
      },
    };
    expect(fold(counter, [1, 2, 3])).toBe(6);
  });

  it("a package adds a type constructor to the registry and gives its functor", () => {
    const taggedFunctor: Functor<"Tagged"> = { map: (fa, f) => ({ tag: fa.tag, value: f(fa.value) }) };
    const sample = (r: Random): Kind<"Tagged", number> => ({ tag: r.pick(["p", "q"]), value: r.int(-9, 9) });
    assertLaws(checkFunctor(taggedFunctor, { sample, functions: [(a: number) => a + 1, (a: number) => a * a] }));
  });
});
