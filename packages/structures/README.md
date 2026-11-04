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

Quotients, polynomial rings and field extensions come in later pull requests.
