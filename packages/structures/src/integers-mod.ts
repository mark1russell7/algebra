/**
 * The integers modulo `n`: a ring for each `n`, and a field for a prime `n`. A value is a `bigint` in `[0, n)`, so each
 * law holds with exact equality.
 *
 * @packageDocumentation
 */
import { withoutZero } from "./structure.ts";
import type { Binary, Carrier, Commutative, CommutativeRing, Field, Group, Monoid } from "./structure.ts";

/** The largest modulus. The seeded draws of `@mark1russell7/rigor-generators` give values of at most 32 bits. */
export const MAX_MODULUS: bigint = 2n ** 32n;

/** The largest carrier that lists its elements. The runner examines each tuple of a small carrier. */
const LISTED_LIMIT = 64n;

const checked = (n: bigint): bigint => {
  if (n < 1n || n > MAX_MODULUS) throw new RangeError(`not a modulus from 1 to 2^32: ${n}`);
  return n;
};

/** This function tells if `p` is a prime. It tries each divisor up to the square root, at most 65536 values. */
export const isPrime = (p: bigint): boolean => {
  if (p < 2n) return false;
  for (let d = 2n; d * d <= p; d += 1n) {
    if (p % d === 0n) return false;
  }
  return true;
};

/** This function gives the inverse of `a` modulo a prime `p`, from the extended Euclid algorithm. */
const inverseModulo = (a: bigint, p: bigint): bigint => {
  let [r, nextR] = [p, a];
  let [t, nextT] = [0n, 1n];
  while (nextR !== 0n) {
    const q = r / nextR;
    [r, nextR] = [nextR, r - q * nextR];
    [t, nextT] = [nextT, t - q * nextT];
  }
  return ((t % p) + p) % p;
};

const carrierOf = (n: bigint): Carrier<bigint> => {
  const listed = n <= LISTED_LIMIT ? { elements: Array.from({ length: Number(n) }, (_, i) => BigInt(i)) } : {};
  return {
    name: `Z/${n}`,
    description: `the integers from 0 to ${n - 1n}`,
    exact: true,
    equals: (a, b) => a === b,
    contains: (a) => a >= 0n && a < n,
    sample: (random) => BigInt(random.below(Number(n))),
    show: (a) => `${a}`,
    ...listed,
  };
};

const additiveOf = (carrier: Carrier<bigint>, n: bigint): Commutative<Group<bigint>> => ({
  level: "group",
  name: `${carrier.name} (+)`,
  carrier,
  op: { name: "add", symbol: "+", arity: 2, apply: (a, b) => (a + b) % n },
  identity: { name: "zero", symbol: "0", arity: 0, value: 0n },
  inverse: { name: "neg", symbol: "-", arity: 1, apply: (a) => (n - a) % n },
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
});

const multiplicationOf = (n: bigint): Binary<bigint> => ({ name: "mul", symbol: "×", arity: 2, apply: (a, b) => (a * b) % n });

const multiplicativeOf = (carrier: Carrier<bigint>, n: bigint): Commutative<Monoid<bigint>> => ({
  level: "monoid",
  name: `${carrier.name} (×)`,
  carrier,
  op: multiplicationOf(n),
  identity: { name: "one", symbol: "1", arity: 0, value: 1n % n },
  claims: { closed: true, associative: true, commutative: true, leftIdentity: true, rightIdentity: true },
});

/**
 * This function gives the ring of the integers modulo `n`.
 *
 * @param n - The modulus, from 1 to `MAX_MODULUS`.
 * @throws RangeError when `n` is not in this range.
 */
export const integersMod = (n: bigint): CommutativeRing<bigint> => {
  const carrier = carrierOf(checked(n));
  return {
    level: "ring",
    name: carrier.name,
    carrier,
    additive: additiveOf(carrier, n),
    multiplicative: multiplicativeOf(carrier, n),
    claims: { leftDistributive: true, rightDistributive: true },
  };
};

/**
 * This function gives the field of the integers modulo a prime `p`.
 *
 * @param p - A prime, not more than `MAX_MODULUS`.
 * @throws RangeError when `p` is not a prime in this range. The integers modulo a composite are not a field.
 */
export const primeField = (p: bigint): Field<bigint> => {
  if (!isPrime(checked(p))) throw new RangeError(`not a prime: ${p}`);
  const ring = integersMod(p);
  const multiplicative = multiplicativeOf(ring.carrier, p);
  const units: Commutative<Group<bigint>> = {
    ...multiplicative,
    level: "group",
    name: `${ring.name}* (×)`,
    carrier: withoutZero(`${ring.name}*`, ring.carrier, 0n),
    inverse: { name: "inverse", symbol: "⁻¹", arity: 1, apply: (a) => inverseModulo(a, p) },
    claims: { ...multiplicative.claims, inverseClosed: true, leftInverse: true, rightInverse: true },
  };
  return {
    ...ring,
    level: "field",
    multiplicative,
    units,
    claims: { ...ring.claims, nontrivial: true, unitsAreNonzero: true, unitsAgree: true },
  };
};
