/**
 * The integers over `bigint`: a commutative ring with no zero divisors. The values are exact, so each law holds with
 * exact equality. The quotients of this ring are the integers modulo `n`.
 *
 * @packageDocumentation
 */
import type { Random } from "@mark1russell7/rigor-generators";
import type { Carrier, Commutative, CommutativeRing, Group, Monoid } from "./structure.ts";

const EDGES: readonly bigint[] = [0n, 1n, -1n, 2n, -2n];

const BOUNDS: readonly number[] = [2 ** 4, 2 ** 16, 2 ** 31];

/** This function draws an integer: an edge value, or a product of two integers of up to 31 bits. */
const sampleInteger = (random: Random): bigint => {
  if (random.chance(0.15)) return random.pick(EDGES);
  const bound = random.pick(BOUNDS);
  return BigInt(random.int(-bound, bound)) * BigInt(random.int(1, bound));
};

/** The carrier of the integers. */
export const INTEGERS: Carrier<bigint> = {
  name: "Z",
  description: "the integers over bigint",
  exact: true,
  equals: (a, b) => a === b,
  contains: (a) => typeof a === "bigint",
  sample: sampleInteger,
  show: (a) => `${a}`,
};

/** The commutative group of the integers under add. */
export const INTEGER_ADD: Commutative<Group<bigint>> = {
  level: "group",
  name: "Z (+)",
  carrier: INTEGERS,
  op: { name: "add", symbol: "+", arity: 2, apply: (a, b) => a + b },
  identity: { name: "zero", symbol: "0", arity: 0, value: 0n },
  inverse: { name: "neg", symbol: "-", arity: 1, apply: (a) => -a },
  claims: {
    closed: true,
    associative: true,
    commutative: true,
    leftIdentity: true,
    rightIdentity: true,
    inverseClosed: true,
    leftInverse: true,
    rightInverse: true,
  },
};

/** The commutative monoid of the integers under multiplication. */
export const INTEGER_MUL: Commutative<Monoid<bigint>> = {
  level: "monoid",
  name: "Z (×)",
  carrier: INTEGERS,
  op: { name: "mul", symbol: "×", arity: 2, apply: (a, b) => a * b },
  identity: { name: "one", symbol: "1", arity: 0, value: 1n },
  claims: { closed: true, associative: true, commutative: true, leftIdentity: true, rightIdentity: true },
};

/** The ring of the integers. */
export const INTEGER_RING: CommutativeRing<bigint> = {
  level: "ring",
  name: "Z",
  carrier: INTEGERS,
  additive: INTEGER_ADD,
  multiplicative: INTEGER_MUL,
  claims: { leftDistributive: true, rightDistributive: true, noZeroDivisors: true },
};
