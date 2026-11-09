/**
 * The law checks of the plain interfaces of the core. A check tests each law of an instance on seeded samples, with
 * the runner of the catalog. Only this entry and the catalog import `@mark1russell7/rigor-generators`.
 *
 * @packageDocumentation
 */
import type { Random } from "@mark1russell7/rigor-generators";
import { orderingOf } from "./core/helpers.ts";
import type { BoundedLattice, Functor, Group, Kind, KindName, Lattice, Monad, Monoid, Order, Semigroup } from "./core/interfaces.ts";
import { checkClaims, checkLaw } from "./runner.ts";
import type { LawReport, LawSource, RunOptions } from "./runner.ts";
import type * as Catalog from "./structure.ts";

export type { Random } from "@mark1russell7/rigor-generators";
export type { LawCheck, LawReport, LawSource, RunOptions } from "./runner.ts";
export { checkLaw, DEFAULT_SAMPLES, DEFAULT_SEED } from "./runner.ts";

/**
 * The values of a law check. The default `equals` compares arrays and plain objects by their parts, and other values
 * with `Object.is`. The default `show` gives JSON, with bigints as text.
 */
export interface Arbitrary<T> {
  /** This function draws a value from a seeded source. Include the edge values in the draw. */
  readonly sample: (random: Random) => T;
  /** The exact equality of the values. */
  readonly equals?: (a: T, b: T) => boolean;
  /** This function gives the text of a value, for the report of a failure. */
  readonly show?: (a: T) => string;
  /** This function tells if a value is in the set. The default accepts each value. */
  readonly contains?: (a: T) => boolean;
  /** The list of the members of a small finite set. The check then examines each tuple, not a sample. */
  readonly elements?: readonly T[];
}

/** The options of a check: the name of the instance in the reports, and the seed and the count of samples. */
export interface CheckOptions extends RunOptions {
  /** The name of the instance. It starts the path of each report. The default is the name of the interface. */
  readonly name?: string;
}

/** The optional laws of an operation. A check tests only the laws that the options claim. */
export interface OperationClaims {
  readonly commutative?: boolean;
  readonly idempotent?: boolean;
}

/**
 * This function compares two values by their parts. Arrays and plain objects are equal when their parts are equal.
 * Other values are equal by `Object.is`.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `true` when the values are equal.
 */
export const structuralEquals = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => structuralEquals(value, b[i]));
  if (isPlain(a) && isPlain(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && structuralEquals(a[key], b[key]));
  }
  return false;
};

const isPlain = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const showValue = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : (JSON.stringify(value, (_key, part: unknown) => (typeof part === "bigint" ? `${part}n` : part)) ?? String(value));

const carrierOf = <T>(name: string, values: Arbitrary<T>): Catalog.Carrier<T> => ({
  name,
  description: `the samples of ${name}`,
  exact: true,
  equals: values.equals ?? structuralEquals,
  contains: values.contains ?? (() => true),
  sample: values.sample,
  show: values.show ?? showValue,
  ...(values.elements === undefined ? {} : { elements: values.elements }),
});

const binary = <T>(name: string, symbol: string, apply: (a: T, b: T) => T): Catalog.Binary<T> => ({ name, symbol, arity: 2, apply });

const constant = <T>(name: string, value: T): Catalog.Constant<T> => ({ name, symbol: name, arity: 0, value });

const optionalClaims = (claims: OperationClaims): { readonly commutative?: true; readonly idempotent?: true } => ({
  ...(claims.commutative === true ? { commutative: true } : {}),
  ...(claims.idempotent === true ? { idempotent: true } : {}),
});

const asSemigroup = <T>(name: string, carrier: Catalog.Carrier<T>, semigroup: Semigroup<T>, claims: OperationClaims): Catalog.Semigroup<T> => ({
  level: "semigroup",
  name,
  carrier,
  op: binary("combine", "·", semigroup.combine),
  claims: { closed: true, associative: true, ...optionalClaims(claims) },
});

const asMonoid = <T>(name: string, carrier: Catalog.Carrier<T>, monoid: Monoid<T>, claims: OperationClaims): Catalog.Monoid<T> => ({
  level: "monoid",
  name,
  carrier,
  op: binary("combine", "·", monoid.combine),
  identity: constant("empty", monoid.empty),
  claims: { closed: true, associative: true, leftIdentity: true, rightIdentity: true, ...optionalClaims(claims) },
});

/**
 * This function tests the laws of a semigroup: the closure and the associativity, and each optional law that the
 * options claim.
 *
 * @param semigroup - The instance.
 * @param values - The values of the test.
 * @param options - The optional laws, the name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkSemigroup = <T>(semigroup: Semigroup<T>, values: Arbitrary<T>, options: CheckOptions & OperationClaims = {}): readonly LawReport[] => {
  const name = options.name ?? "semigroup";
  return checkClaims(asSemigroup(name, carrierOf(name, values), semigroup, options), options);
};

/**
 * This function tests the laws of a monoid: the laws of a semigroup, and the left and the right identity.
 *
 * @param monoid - The instance.
 * @param values - The values of the test.
 * @param options - The optional laws, the name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkMonoid = <T>(monoid: Monoid<T>, values: Arbitrary<T>, options: CheckOptions & OperationClaims = {}): readonly LawReport[] => {
  const name = options.name ?? "monoid";
  return checkClaims(asMonoid(name, carrierOf(name, values), monoid, options), options);
};

/**
 * This function tests the laws of a group: the laws of a monoid, and the left and the right inverse.
 *
 * @param group - The instance.
 * @param values - The values of the test.
 * @param options - The claim of commutativity, the name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkGroup = <T>(
  group: Group<T>,
  values: Arbitrary<T>,
  options: CheckOptions & { readonly commutative?: boolean } = {},
): readonly LawReport[] => {
  const name = options.name ?? "group";
  const carrier = carrierOf(name, values);
  const structure: Catalog.Group<T> = {
    ...asMonoid(name, carrier, group, options),
    level: "group",
    inverse: { name: "invert", symbol: "⁻¹", arity: 1, apply: group.invert },
    claims: {
      closed: true,
      associative: true,
      leftIdentity: true,
      rightIdentity: true,
      inverseClosed: true,
      leftInverse: true,
      rightInverse: true,
      ...optionalClaims(options),
    },
  };
  return checkClaims(structure, options);
};

/** The laws of `compare` that the order of the catalog does not state. */
export type CompareLaw = "signAntisymmetric" | "zeroIsEqual";

/**
 * This function tests the laws of a total order. The order `compare(a, b) <= 0` must be reflexive, antisymmetric,
 * transitive and total. The sign of `compare(b, a)` must be the opposite sign, and a zero must tell equal values.
 *
 * @param order - The instance.
 * @param values - The values of the test.
 * @param options - The name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkOrder = <T>(order: Order<T>, values: Arbitrary<T>, options: CheckOptions = {}): readonly LawReport<string>[] => {
  const name = options.name ?? "order";
  const carrier = carrierOf(name, values);
  const structure: Catalog.Order<T> = {
    level: "order",
    name,
    carrier,
    leq: { name: "compare", symbol: "≤", arity: 2, apply: (a, b) => order.compare(a, b) <= 0 },
    claims: { reflexive: true, antisymmetric: true, transitive: true, total: true },
  };
  const compareLaw = (law: CompareLaw, holds: (a: T, b: T) => boolean): LawReport<CompareLaw> =>
    checkLaw({ path: name, law, arity: 2, source: carrier, holds: ([a, b]) => holds(a as T, b as T) }, options);
  return [
    ...checkClaims(structure, options),
    compareLaw("signAntisymmetric", (a, b) => orderingOf(order.compare(a, b)) === -orderingOf(order.compare(b, a))),
    compareLaw("zeroIsEqual", (a, b) => (order.compare(a, b) === 0) === carrier.equals(a, b)),
  ];
};

const asLattice = <T>(name: string, carrier: Catalog.Carrier<T>, lattice: Lattice<T>, distributive: boolean): Catalog.Lattice<T> => {
  const semilattice = (field: "meet" | "join"): Catalog.Semilattice<Catalog.Semigroup<T>> => ({
    ...asSemigroup(`${name}/${field}`, carrier, { combine: lattice[field] }, {}),
    claims: { closed: true, associative: true, commutative: true, idempotent: true },
  });
  return {
    level: "lattice",
    name,
    carrier,
    leq: { name: "meet", symbol: "≤", arity: 2, apply: (a, b) => carrier.equals(lattice.meet(a, b), a) },
    meet: semilattice("meet"),
    join: semilattice("join"),
    claims: {
      reflexive: true,
      antisymmetric: true,
      transitive: true,
      meetAgrees: true,
      joinAgrees: true,
      meetAbsorbs: true,
      joinAbsorbs: true,
      ...(distributive ? { distributive: true } : {}),
    },
  };
};

/**
 * This function tests the laws of a lattice. The order is `a ≤ b` when `meet(a, b)` equals `a`. The meet and the join
 * must be commutative, associative and idempotent, and each one must absorb the other.
 *
 * @param lattice - The instance.
 * @param values - The values of the test.
 * @param options - The claim of distributivity, the name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkLattice = <T>(
  lattice: Lattice<T>,
  values: Arbitrary<T>,
  options: CheckOptions & { readonly distributive?: boolean } = {},
): readonly LawReport[] => {
  const name = options.name ?? "lattice";
  return checkClaims(asLattice(name, carrierOf(name, values), lattice, options.distributive === true), options);
};

/**
 * This function tests the laws of a bounded lattice. These are the laws of a lattice, and two identities: the top for
 * the meet and the bottom for the join.
 *
 * @param lattice - The instance.
 * @param values - The values of the test.
 * @param options - The claim of distributivity, the name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkBoundedLattice = <T>(
  lattice: BoundedLattice<T>,
  values: Arbitrary<T>,
  options: CheckOptions & { readonly distributive?: boolean } = {},
): readonly LawReport[] => {
  const name = options.name ?? "bounded-lattice";
  const carrier = carrierOf(name, values);
  const base = asLattice(name, carrier, lattice, options.distributive === true);
  const bounded = (field: "meet" | "join", identity: T): Catalog.Semilattice<Catalog.Monoid<T>> => ({
    ...asMonoid(`${name}/${field}`, carrier, { empty: identity, combine: lattice[field] }, {}),
    claims: { closed: true, associative: true, leftIdentity: true, rightIdentity: true, commutative: true, idempotent: true },
  });
  const structure: Catalog.BoundedLattice<T> = {
    ...base,
    level: "bounded-lattice",
    meet: bounded("meet", lattice.top),
    join: bounded("join", lattice.bottom),
  };
  return checkClaims(structure, options);
};

/** The values of a law check of a functor. */
export interface FunctorArbitrary<F extends KindName, A> {
  /** This function draws a container from a seeded source. */
  readonly sample: (random: Random) => Kind<F, A>;
  /** The exact equality of the containers. The default is `structuralEquals`. */
  readonly equals?: (a: Kind<F, A>, b: Kind<F, A>) => boolean;
  /** This function gives the text of a container. */
  readonly show?: (a: Kind<F, A>) => string;
  /** The functions of the law of composition. The check draws two of them for each case. Give at least one. */
  readonly functions: readonly ((a: A) => A)[];
}

/** The values of a law check of a monad. */
export interface MonadArbitrary<F extends KindName, A> extends FunctorArbitrary<F, A> {
  /** This function draws a value for the law of the left identity. */
  readonly value: (random: Random) => A;
  /** The functions to containers of the laws of `flatMap`. The check draws them for each case. Give at least one. */
  readonly kleisli: readonly ((a: A) => Kind<F, A>)[];
}

/** The laws of a functor and of a monad. */
export type FunctorLaw = "mapIdentity" | "mapComposition" | "leftIdentity" | "rightIdentity" | "flatMapAssociative" | "mapAgrees";

interface Case<F extends KindName, A> {
  readonly container: Kind<F, A>;
  readonly value: A | undefined;
  readonly first: number;
  readonly second: number;
}

const functorLaws = <F extends KindName, A>(
  name: string,
  functor: Functor<F>,
  values: FunctorArbitrary<NoInfer<F>, A>,
  draw: (random: Random) => A | undefined,
  pick: number,
  options: CheckOptions,
): {
  readonly reports: readonly LawReport<FunctorLaw>[];
  readonly law: (law: FunctorLaw, holds: (c: Case<F, A>) => boolean) => LawReport<FunctorLaw>;
  readonly same: (a: Kind<F, A>, b: Kind<F, A>) => boolean;
} => {
  if (values.functions.length === 0) throw new RangeError("a functor check needs at least one function");
  const same = values.equals ?? structuralEquals;
  const count = Math.max(values.functions.length, pick);
  const show = values.show ?? showValue;
  const source: LawSource<Case<F, A>> = {
    sample: (random) => ({
      container: values.sample(random),
      value: draw(random),
      first: random.below(count),
      second: random.below(count),
    }),
    show: (c) => `${show(c.container)} (functions ${c.first} and ${c.second}${c.value === undefined ? "" : `, value ${showValue(c.value)}`})`,
  };
  const law = (law: FunctorLaw, holds: (c: Case<F, A>) => boolean): LawReport<FunctorLaw> =>
    checkLaw({ path: name, law, arity: 1, source, holds: ([c]) => holds(c as Case<F, A>) }, options);
  const f = (i: number): ((a: A) => A) => values.functions[i % values.functions.length] as (a: A) => A;
  const reports = [
    law("mapIdentity", (c) => same(functor.map(c.container, (a: A) => a), c.container)),
    law("mapComposition", (c) =>
      same(
        functor.map(functor.map(c.container, f(c.first)), f(c.second)),
        functor.map(c.container, (a: A) => f(c.second)(f(c.first)(a))),
      ),
    ),
  ];
  return { reports, law, same };
};

/**
 * This function tests the laws of a functor: `map` with the identity gives the same container, and `map` keeps the
 * composition of two functions.
 *
 * @param functor - The instance.
 * @param values - The containers and the functions of the test.
 * @param options - The name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkFunctor = <F extends KindName, A>(
  functor: Functor<F>,
  values: FunctorArbitrary<NoInfer<F>, A>,
  options: CheckOptions = {},
): readonly LawReport<FunctorLaw>[] => functorLaws(options.name ?? "functor", functor, values, () => undefined, 0, options).reports;

/**
 * This function tests the laws of a monad. These are the laws of a functor, the left and the right identity of `of`
 * and the associativity of `flatMap`. The last law tells that `map` agrees with `flatMap` and `of`.
 *
 * @param monad - The instance.
 * @param values - The containers, the values and the functions of the test.
 * @param options - The name, the seed and the count of samples.
 * @returns One report for each law.
 */
export const checkMonad = <F extends KindName, A>(
  monad: Monad<F>,
  values: MonadArbitrary<NoInfer<F>, A>,
  options: CheckOptions = {},
): readonly LawReport<FunctorLaw>[] => {
  if (values.kleisli.length === 0) throw new RangeError("a monad check needs at least one function to a container");
  const k = (i: number): ((a: A) => Kind<F, A>) => values.kleisli[i % values.kleisli.length] as (a: A) => Kind<F, A>;
  const f = (i: number): ((a: A) => A) => values.functions[i % values.functions.length] as (a: A) => A;
  const { reports, law, same } = functorLaws(options.name ?? "monad", monad, values, values.value, values.kleisli.length, options);
  return [
    ...reports,
    law("leftIdentity", (c) => same(monad.flatMap(monad.of(c.value as A), k(c.first)), k(c.first)(c.value as A))),
    law("rightIdentity", (c) => same(monad.flatMap(c.container, (a: A) => monad.of(a)), c.container)),
    law("flatMapAssociative", (c) =>
      same(
        monad.flatMap(monad.flatMap(c.container, k(c.first)), k(c.second)),
        monad.flatMap(c.container, (a: A) => monad.flatMap(k(c.first)(a), k(c.second))),
      ),
    ),
    law("mapAgrees", (c) => same(monad.map(c.container, f(c.first)), monad.flatMap(c.container, (a: A) => monad.of(f(c.first)(a))))),
  ];
};

/**
 * This function gives the reports of the laws that fail.
 *
 * @param reports - The reports of a check.
 * @returns The reports with a failure.
 */
export const lawFailures = <Name extends string>(reports: readonly LawReport<Name>[]): readonly LawReport<Name>[] =>
  reports.filter((report) => report.failure !== null);

/**
 * This function throws when a law fails. A test can give it the reports of a check.
 *
 * @param reports - The reports of a check.
 * @throws Error with each failing law, its seed and its first failing tuple.
 */
export const assertLaws = <Name extends string>(reports: readonly LawReport<Name>[]): void => {
  const failures = lawFailures(reports);
  if (failures.length === 0) return;
  const lines = failures.map((r) => `${r.path} ${r.law} (seed ${r.seed}, case ${r.cases}): ${(r.failure ?? []).join(", ")}`);
  throw new Error(`${failures.length} law(s) fail:\n${lines.join("\n")}`);
};
