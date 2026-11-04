# @algebra/structures

Monoid, group, ring, field, order and lattice as data instances, with law tests. This package is roadmap item A9.

This package is private. It is the first input of the type graph, and the domains of vex use it later (A10).

## A structure is data

A structure names its carrier, its operations and the laws that it claims. A consumer lists them with no call of an operation.

```ts
import { describe, DOUBLE_ADD } from "@algebra/structures";

describe(DOUBLE_ADD);
// { name: "double (+)", level: "unital-magma", claims: ["closed", "commutative", "leftIdentity", "rightIdentity"],
//   refuted: [{ law: "associative", note: "(0.1 + 0.2) + 0.3 is 0.6000000000000001, and 0.1 + (0.2 + 0.3) is 0.6" }], ... }
```

`describe` gives JSON. `CATALOG` lists the instances, `describeCatalog()` gives their descriptions, and `describeLaws()` gives the laws.

## The levels

Each level adds to the level below. The types state this, so a `Group<T>` is assignable to a `Monoid<T>`. The table `LEVELS` states the same reduction as data, and `conforms` compares a structure with the table.

| Level | Adds |
| --- | --- |
| `magma` | a carrier, one operation and closure |
| `semigroup` | associativity |
| `unital-magma` | an identity |
| `monoid` | both of these |
| `group` | an inverse |
| `ring` | an additive commutative group, a multiplicative monoid and distributivity |
| `field` | a commutative multiplication, and a group of units: the values that are not zero |
| `order` | a relation that is reflexive, antisymmetric and transitive |
| `lattice` | a meet and a join: semigroups that agree with the order |
| `bounded-lattice` | an identity for the meet and for the join |

## The instances

| Carrier | Instances | Equality |
| --- | --- | --- |
| The rationals | `RATIONAL_FIELD`, `RATIONAL_LATTICE` (no top, no bottom) | exact |
| The integers modulo `n` | `integersMod(n)` (a ring), `primeField(p)` (a field) | exact |
| The booleans | `BOOLEAN_RING`, `BOOLEAN_LATTICE` | exact |
| The doubles | `DOUBLE_ADD`, `DOUBLE_MIN`, `DOUBLE_MAX`, `DOUBLE_LATTICE` | `Object.is` |

An instance claims only the laws that hold. The doubles show this:

- Double add is not associative, so `DOUBLE_ADD` is a unital magma, not a monoid. Its field `refuted` has a counterexample, and a test replays it.
- The identity of double add is `-0`. The value `0` fails at `-0`, because `-0 + 0` is `0`.
- Double add has no inverse. A value and its negative give `0`, and the two infinities give `NaN`.
- Min and max are exact on the doubles without `NaN`, with `-0` below `0`. `NaN` is not in that carrier, because it breaks the law of absorption.

## The laws

A law is data: `LAWS` gives its name, its arity, its statement and its check. One runner tests each claimed law of each instance.

```ts
import { checkClaims, primeField } from "@algebra/structures";

const reports = checkClaims(primeField(7n), { seed: 1, samples: 500 });
reports.filter((report) => report.failure !== null); // []
```

The runner walks the parts of a structure too. A carrier with a list of elements gets each tuple when the count is not more than `samples`. Other carriers get seeded samples from `@mark1russell7/rigor-generators`. The variable `STRUCTURE_SAMPLES` sets the count for a long run of the tests in CI.

## The product

`product(a, b)` acts on each side of a pair. It claims exactly the laws that both factors claim and that a product preserves.

- The product of two fields is a ring. The pair `(1, 0)` has no inverse.
- The product of two total orders is a partial order. The pairs `(1, 0)` and `(0, 1)` are not comparable.
- The product of `RATIONAL_MUL` and `DOUBLE_ADD` is a unital magma, because one factor does not claim associativity.

## Constructions

A construction takes structures and gives a structure. Its field `construction` names its inputs, and its evidence when it has evidence. The runner and `conforms` walk the inputs too. `describe` gives them as JSON.

A construction claims a law only when the laws of its inputs give that law. A carrier that is not exact gets no construction: `requireExact` stops it with a `TypeError`.

### Quotients

An ideal or a normal subgroup is data. It has a test of membership and a map to the canonical representative of a coset. Its carrier is the whole input, so the laws of congruence get all values and not only the representatives.

```ts
import { checkClaims, integerIdeal, listedIdeal, quotientRing, integersMod } from "@algebra/structures";

quotientRing(integerIdeal(6n)); // agrees with integersMod(6n)
quotientRing(listedIdeal(integersMod(12n), [0n, 4n, 8n])); // agrees with integersMod(4n)
checkClaims(quotientRing(listedIdeal(integersMod(6n), [0n, 2n, 3n]))); // fails with an argument
```

- `idealOf` and `normalSubgroupOf` take a definition and check nothing. The runner does the check. This is how a forged ideal stays visible.
- The integers are a normal subgroup of the rationals, so `RATIONALS_MOD_INTEGERS` passes. The same set as an ideal fails the laws of absorption, with two arguments.
- The set `{0, x}` of the field of 4 elements is not an ideal, but its representatives pass their own laws. Only the walk of the inputs finds this failure.
- A quotient keeps the laws with the flag `preservedByQuotient`. It does not keep `noZeroDivisors`: 2 and 3 are zero divisors of `Z/(6)`.
- `quotientRing` does not claim a field. A field comes from `extendFinite` or `extendRationals`.

### Polynomial rings

`polynomialRing(ring)` gives the polynomials in one variable over a ring. A value is a list of coefficients, the constant first, with no zero at the end. This form is canonical, so the equality is exact.

- The result claims commutativity only when the multiplication of the coefficients claims it.
- It claims `noZeroDivisors` only over a field, or over a ring that claims this law.
- It does not keep `idempotent`: over the booleans, the square of `x + 1` is `x^2 + 1`.
- The polynomials over a field are a ring. The polynomial `x` has no inverse.

`polynomialIdeal(ring, modulus)` gives the multiples of a monic polynomial, over any commutative ring. `@algebra/polynomial` is a different package: it is a symbolic evaluator of expression documents.

### Field extensions

`extendFinite(field, modulus)` and `extendRationals(modulus, prime?)` give a ring, a field or `null`, and the evidence. These functions decide irreducibility. A caller cannot give the verdict.

| Method | Base | Tells | Limit |
| --- | --- | --- | --- |
| `trial-division` | a field with a list | irreducible or reducible | at most `SEARCH_LIMIT` divisors |
| `rational-root` | the rationals | reducible at each degree with a root, irreducible to degree 3 | outer coefficients to `ROOT_TEST_LIMIT` |
| `eisenstein` | the rationals | irreducible | the function examines the prime that the caller gives |
| `none` | either | `unknown` | the result is a ring with no claim of a field |

- A reducible modulus gives a ring and a refutation of `noZeroDivisors`, and a test replays it.
- The polynomial `x^4 + 4` has no rational root, but it is `(x^2 + 2x + 2)(x^2 - 2x + 2)`. So the verdict at degree 4 with no prime is `unknown`.
- The verdict `unknown` also applies to `x^4 + 1`, which is irreducible. The method is sound, and it is not complete.

### Limits

- Claims over an infinite carrier rest on samples and on the laws of the inputs. They are not proofs.
- Sampled polynomials stop at degree `SAMPLE_DEGREE`. A modulus of a higher degree gets samples of a lower degree only.
- The ideals with a ready form are the integer ideals, the multiples of a monic polynomial, and the listed ideals.
- The base of an extension is the rationals or a field with a list.
- `product` records no `construction` yet.
