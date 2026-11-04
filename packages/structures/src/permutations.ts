/**
 * The symmetric groups: the permutations of `n` points. The group of 3 points is the smallest group that is not
 * commutative. Thus it has a subgroup that is not normal, and a quotient by that subgroup fails.
 *
 * @packageDocumentation
 */
import { listedNormalSubgroup } from "./quotient.ts";
import type { Carrier, Group, NormalSubgroup } from "./structure.ts";

/** A value of a symmetric group: entry `i` is the image of the point `i`. */
export type Permutation = readonly number[];

/** The largest count of points. The carrier lists each permutation, and 5 points give 120. */
export const MAX_POINTS = 5;

const permutationsOf = (points: readonly number[]): readonly Permutation[] =>
  points.length === 0 ? [[]] : points.flatMap((point) => permutationsOf(points.filter((other) => other !== point)).map((tail) => [point, ...tail]));

const compose = (a: Permutation, b: Permutation): Permutation => b.map((point) => a[point] ?? point);

const invert = (a: Permutation): Permutation => a.map((_, point) => a.indexOf(point));

/** This function tells if a permutation is even: its count of pairs in the wrong order is even. */
export const isEven = (a: Permutation): boolean => {
  const wrong = a.flatMap((value, i) => a.slice(i + 1).filter((later) => later < value));
  return wrong.length % 2 === 0;
};

const carrierOf = (n: number): Carrier<Permutation> => {
  const points = Array.from({ length: n }, (_, i) => i);
  const elements = permutationsOf(points);
  return {
    name: `S${n}`,
    description: `the permutations of ${n} points`,
    exact: true,
    equals: (a, b) => a.length === b.length && a.every((value, i) => value === b[i]),
    contains: (a) => a.length === n && points.every((point) => a.includes(point)),
    sample: (random) => random.pick(elements),
    show: (a) => `[${a.join(" ")}]`,
    elements,
  };
};

const swap = (n: number, i: number, j: number): Permutation => Array.from({ length: n }, (_, point) => (point === i ? j : point === j ? i : point));

/**
 * This function gives the symmetric group of `n` points. From 3 points, it states a refutation of commutativity.
 *
 * @param n - The count of points, from 1 to `MAX_POINTS`.
 * @throws RangeError when `n` is not in this range.
 */
export const symmetricGroup = (n: number): Group<Permutation> => {
  if (!Number.isInteger(n) || n < 1 || n > MAX_POINTS) throw new RangeError(`not a count of points from 1 to ${MAX_POINTS}: ${n}`);
  const carrier = carrierOf(n);
  const refuted =
    n < 3
      ? {}
      : { refuted: [{ law: "commutative" as const, arguments: [swap(n, 0, 1), swap(n, 1, 2)], note: "the swaps of the points 0, 1 and of the points 1, 2 do not commute" }] };
  return {
    level: "group",
    name: carrier.name,
    carrier,
    op: { name: "compose", symbol: "∘", arity: 2, apply: compose },
    identity: { name: "identity", symbol: "id", arity: 0, value: Array.from({ length: n }, (_, i) => i) },
    inverse: { name: "inverse", symbol: "⁻¹", arity: 1, apply: invert },
    claims: { closed: true, associative: true, leftIdentity: true, rightIdentity: true, inverseClosed: true, leftInverse: true, rightInverse: true },
    ...refuted,
  };
};

/**
 * This function gives the even permutations as a normal subgroup of a symmetric group.
 *
 * @param group - A symmetric group of `symmetricGroup`.
 */
export const alternatingSubgroup = (group: Group<Permutation>): NormalSubgroup<Permutation> => ({
  ...listedNormalSubgroup(group, (group.carrier.elements ?? []).filter(isEven)),
  name: `A${group.identity.value.length}`,
});
