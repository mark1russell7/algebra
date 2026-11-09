/**
 * The helpers of the core: folds, products of structures, the dual of a structure, and the structures that an order
 * gives.
 *
 * @packageDocumentation
 */
import type { Lattice, Monoid, Order, Ordering, Semigroup } from "./interfaces.ts";

/**
 * This function combines the values in order, from the identity.
 *
 * @param monoid - The monoid.
 * @param values - The values.
 * @returns The combination of the values, or `monoid.empty` for no values.
 */
export const fold = <T>(monoid: Monoid<T>, values: Iterable<T>): T => {
  let total = monoid.empty;
  for (const value of values) total = monoid.combine(total, value);
  return total;
};

/**
 * This function maps each value into a monoid, and combines the results in order.
 *
 * @param monoid - The monoid of the results.
 * @param values - The values.
 * @param f - The map of one value.
 * @returns The combination of the results, or `monoid.empty` for no values.
 */
export const foldMap = <A, T>(monoid: Monoid<T>, values: Iterable<A>, f: (value: A) => T): T => {
  let total = monoid.empty;
  for (const value of values) total = monoid.combine(total, f(value));
  return total;
};

/**
 * This function gives the monoid of pairs. It combines each part with its own monoid.
 *
 * @param first - The monoid of the first part.
 * @param second - The monoid of the second part.
 * @returns The monoid of pairs.
 */
export const pairMonoid = <A, B>(first: Monoid<A>, second: Monoid<B>): Monoid<readonly [A, B]> => ({
  empty: [first.empty, second.empty],
  combine: (a, b) => [first.combine(a[0], b[0]), second.combine(a[1], b[1])],
});

/**
 * This function gives the monoid of records with the same keys. It combines each field with the monoid of that key.
 *
 * @param monoids - The monoid of each key.
 * @returns The monoid of the records.
 */
export const structMonoid = <R extends Readonly<Record<string, unknown>>>(monoids: { readonly [K in keyof R]: Monoid<R[K]> }): Monoid<R> => {
  const keys = Object.keys(monoids) as (keyof R & string)[];
  const build = (value: (key: keyof R & string) => unknown): R => Object.fromEntries(keys.map((key) => [key, value(key)])) as R;
  return {
    empty: build((key) => monoids[key].empty),
    combine: (a, b) => build((key) => monoids[key].combine(a[key], b[key])),
  };
};

/**
 * This function gives the monoid of records with any keys. A key of one record keeps its value. A key of the two
 * records gets the combination of the two values. The keys of the result are sorted, so equal results have equal JSON.
 *
 * @param values - The semigroup of the values.
 * @returns The monoid. The identity is the empty record.
 */
export const recordMonoid = <V>(values: Semigroup<V>): Monoid<Readonly<Record<string, V>>> => ({
  empty: {},
  combine: (a, b) => {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return Object.fromEntries(
      keys.map((key) => {
        const inA = Object.hasOwn(a, key);
        const inB = Object.hasOwn(b, key);
        return [key, inA && inB ? values.combine(a[key] as V, b[key] as V) : ((inA ? a[key] : b[key]) as V)];
      }),
    );
  },
});

/**
 * This function gives the dual of a semigroup: the operation with its two arguments in the opposite order.
 *
 * @param semigroup - The semigroup.
 * @returns The dual semigroup.
 */
export const dualSemigroup = <T>(semigroup: Semigroup<T>): Semigroup<T> => ({ combine: (a, b) => semigroup.combine(b, a) });

/**
 * This function gives the dual of a monoid: the operation with its two arguments in the opposite order.
 *
 * @param monoid - The monoid.
 * @returns The dual monoid, with the same identity.
 */
export const dualMonoid = <T>(monoid: Monoid<T>): Monoid<T> => ({ empty: monoid.empty, combine: (a, b) => monoid.combine(b, a) });

/**
 * This function gives the sign of a comparison as `-1`, `0` or `1`.
 *
 * @param compared - The result of a `compare`.
 * @returns The sign.
 */
export const orderingOf = (compared: number): Ordering => (compared < 0 ? -1 : compared > 0 ? 1 : 0);

/**
 * This function gives the opposite order.
 *
 * @param order - The order.
 * @returns The order with each sign reversed.
 */
export const reverseOrder = <T>(order: Order<T>): Order<T> => ({ compare: (a, b) => order.compare(b, a) });

/**
 * This function gives the order of values by a key of each value.
 *
 * @param order - The order of the keys.
 * @param key - The key of a value.
 * @returns The order of the values. Values with equal keys compare as equal.
 */
export const orderBy = <A, K>(order: Order<K>, key: (value: A) => K): Order<A> => ({
  compare: (a, b) => order.compare(key(a), key(b)),
});

/**
 * This function gives the order that uses each order in turn, until one order tells a difference.
 *
 * @param orders - The orders, first the most important.
 * @returns The lexicographic order.
 */
export const thenOrder = <T>(...orders: readonly Order<T>[]): Order<T> => ({
  compare: (a, b) => {
    for (const order of orders) {
      const sign = order.compare(a, b);
      if (sign !== 0) return sign;
    }
    return 0;
  },
});

/**
 * This function gives the semigroup of the minimum by an order. On a tie, it keeps the first value.
 *
 * @param order - The order.
 * @returns The semigroup.
 */
export const minSemigroup = <T>(order: Order<T>): Semigroup<T> => ({ combine: (a, b) => (order.compare(b, a) < 0 ? b : a) });

/**
 * This function gives the semigroup of the maximum by an order. On a tie, it keeps the first value.
 *
 * @param order - The order.
 * @returns The semigroup.
 */
export const maxSemigroup = <T>(order: Order<T>): Semigroup<T> => ({ combine: (a, b) => (order.compare(b, a) > 0 ? b : a) });

/**
 * This function gives the lattice of a total order: the meet is the minimum, and the join is the maximum.
 *
 * @param order - The order.
 * @returns The lattice.
 */
export const latticeOfOrder = <T>(order: Order<T>): Lattice<T> => ({
  meet: minSemigroup(order).combine,
  join: maxSemigroup(order).combine,
});
