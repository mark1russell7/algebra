/**
 * The standard instances of the core. The number instances are exact on the safe integers only. On other doubles, the
 * rounding of `+` and `*` breaks the associativity. The bigint instances are exact on each value.
 *
 * @packageDocumentation
 */
import type { BoundedLattice, Group, Lattice, Monad, Monoid, Order, Semigroup } from "./interfaces.ts";

/** The sum of numbers. It is exact on the safe integers. On other doubles the rounding breaks the associativity. */
export const sumMonoid: Group<number> = { empty: 0, combine: (a, b) => a + b, invert: (a) => -a };

/** The product of numbers. It is exact while each product is a safe integer. */
export const productMonoid: Monoid<number> = { empty: 1, combine: (a, b) => a * b };

/** The sum of bigints. It is exact on each value. */
export const bigintSum: Group<bigint> = { empty: 0n, combine: (a, b) => a + b, invert: (a) => -a };

/** The product of bigints. It is exact on each value. */
export const bigintProduct: Monoid<bigint> = { empty: 1n, combine: (a, b) => a * b };

/** The minimum of numbers, by `Math.min`. The identity is `Infinity`. `-0` is less than `0`, and a `NaN` gives `NaN`. */
export const minMonoid: Monoid<number> = { empty: Infinity, combine: (a, b) => Math.min(a, b) };

/** The maximum of numbers, by `Math.max`. The identity is `-Infinity`. `0` is more than `-0`, and a `NaN` gives `NaN`. */
export const maxMonoid: Monoid<number> = { empty: -Infinity, combine: (a, b) => Math.max(a, b) };

/** The logical and. The identity is `true`. */
export const allMonoid: Monoid<boolean> = { empty: true, combine: (a, b) => a && b };

/** The logical or. The identity is `false`. */
export const anyMonoid: Monoid<boolean> = { empty: false, combine: (a, b) => a || b };

/** The exclusive or. Each value is its own inverse. */
export const xorGroup: Group<boolean> = { empty: false, combine: (a, b) => a !== b, invert: (a) => a };

/** The join of strings. The identity is the empty string. */
export const stringMonoid: Monoid<string> = { empty: "", combine: (a, b) => a + b };

/**
 * This function gives the semigroup that keeps the first value. It has no identity.
 *
 * @returns The semigroup.
 */
export const firstSemigroup = <T>(): Semigroup<T> => ({ combine: (a) => a });

/**
 * This function gives the semigroup that keeps the last value. It has no identity.
 *
 * @returns The semigroup.
 */
export const lastSemigroup = <T>(): Semigroup<T> => ({ combine: (_a, b) => b });

/**
 * This function gives the monoid of the joins of read-only arrays. The identity is the empty array.
 *
 * @returns The monoid.
 */
export const arrayMonoid = <T>(): Monoid<readonly T[]> => ({ empty: [], combine: (a, b) => [...a, ...b] });

/**
 * This function gives the monoid of the unions of sorted lists with no duplicates. The operation is commutative and
 * idempotent. The order tells the sort, and a compare of zero tells a duplicate.
 *
 * @param order - The order of the values.
 * @returns The monoid. Give it lists that `order` sorts, with no duplicates.
 */
export const sortedUnionMonoid = <T>(order: Order<T>): Monoid<readonly T[]> => ({
  empty: [],
  combine: (a, b) => {
    const union: T[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      const left = a[i] as T;
      const right = b[j] as T;
      const sign = order.compare(left, right);
      if (sign <= 0) {
        union.push(left);
        i += 1;
        if (sign === 0) j += 1;
      } else {
        union.push(right);
        j += 1;
      }
    }
    for (; i < a.length; i += 1) union.push(a[i] as T);
    for (; j < b.length; j += 1) union.push(b[j] as T);
    return union;
  },
});

/** The order of numbers. Its equality is `===`, so `-0` equals `0`. `NaN` is not a member, because no position agrees with it. */
export const numberOrder: Order<number> = { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };

/** The order of bigints. */
export const bigintOrder: Order<bigint> = { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };

/** The order of strings by UTF-16 code units, as the operator `<` compares them. It does not use a locale. */
export const stringOrder: Order<string> = { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };

/** The order of booleans: `false` is before `true`. */
export const booleanOrder: Order<boolean> = { compare: (a, b) => Number(a) - Number(b) };

/** The lattice of booleans: the meet is the and, and the join is the or. */
export const booleanLattice: BoundedLattice<boolean> = {
  meet: (a, b) => a && b,
  join: (a, b) => a || b,
  top: true,
  bottom: false,
};

/** The lattice of numbers: the meet is `Math.min`, and the join is `Math.max`. The bounds are the infinities. */
export const numberLattice: BoundedLattice<number> = {
  meet: minMonoid.combine,
  join: maxMonoid.combine,
  top: Infinity,
  bottom: -Infinity,
};

/**
 * This function gives the lattice of sorted lists with no duplicates: the meet is the intersection, and the join is
 * the union.
 *
 * @param order - The order of the values.
 * @returns The lattice. Give it lists that `order` sorts, with no duplicates.
 */
export const sortedSetLattice = <T>(order: Order<T>): Lattice<readonly T[]> => ({
  meet: (a, b) => {
    const meet: T[] = [];
    let j = 0;
    for (const value of a) {
      while (j < b.length && order.compare(b[j] as T, value) < 0) j += 1;
      if (j < b.length && order.compare(b[j] as T, value) === 0) meet.push(value);
    }
    return meet;
  },
  join: sortedUnionMonoid(order).combine,
});

/** The monad of read-only arrays. `flatMap` joins the arrays of each value, in order. */
export const arrayMonad: Monad<"Array"> = {
  of: (a) => [a],
  map: (fa, f) => fa.map((a) => f(a)),
  flatMap: (fa, f) => fa.flatMap((a) => f(a)),
};
