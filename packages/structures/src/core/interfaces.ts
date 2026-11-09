/**
 * The plain interfaces of the core. Each interface has only its operations: no carrier, no names and no claims. A
 * value of each repository can be an instance with no adapter. The entry `./laws` tests the laws of an instance.
 *
 * @packageDocumentation
 */

/** A set of values with an associative operation: `combine(combine(a, b), c)` equals `combine(a, combine(b, c))`. */
export interface Semigroup<T> {
  readonly combine: (a: T, b: T) => T;
}

/** A semigroup with an identity: `combine(empty, a)` and `combine(a, empty)` equal `a`. */
export interface Monoid<T> extends Semigroup<T> {
  readonly empty: T;
}

/** A monoid with an inverse for each value: `combine(a, invert(a))` and `combine(invert(a), a)` equal `empty`. */
export interface Group<T> extends Monoid<T> {
  readonly invert: (a: T) => T;
}

/**
 * A total order. Only the sign of `compare(a, b)` has a meaning. A negative sign puts `a` before `b`, and a positive
 * sign puts `a` after `b`. The sign is zero only for equal values, and it is antisymmetric and transitive.
 */
export interface Order<T> {
  readonly compare: (a: T, b: T) => number;
}

/** The sign of a comparison. */
export type Ordering = -1 | 0 | 1;

/**
 * A lattice. The meet and the join are each commutative, associative and idempotent, and each one absorbs the other:
 * `meet(a, join(a, b))` equals `a`, and `join(a, meet(a, b))` equals `a`.
 */
export interface Lattice<T> {
  readonly meet: (a: T, b: T) => T;
  readonly join: (a: T, b: T) => T;
}

/** A lattice with a top and a bottom. The top is the identity of the meet, and the bottom is the identity of the join. */
export interface BoundedLattice<T> extends Lattice<T> {
  readonly top: T;
  readonly bottom: T;
}

/**
 * The registry of the type constructors of `Functor` and `Monad`. TypeScript has no type parameter of a higher kind, so
 * each constructor has a name in this registry. A package adds its constructor with an augmentation of this interface:
 *
 * ```ts
 * declare module "@mark1russell7/structures" {
 *   interface Kinds<A> {
 *     readonly Optional: Optional<A>;
 *   }
 * }
 * ```
 */
export interface Kinds<A> {
  /** The read-only arrays. The instance is `arrayMonad`. */
  readonly Array: readonly A[];
}

/** The name of a type constructor in the registry `Kinds`. */
export type KindName = keyof Kinds<unknown>;

/** The type that the constructor `F` gives for the type `A`. */
export type Kind<F extends KindName, A> = Kinds<A>[F];

/**
 * A functor: a map that keeps the shape. `map(fa, (a) => a)` equals `fa`, and `map(map(fa, f), g)` equals
 * `map(fa, (a) => g(f(a)))`. The container is the first argument, as in `@mark1russell7/optional`.
 */
export interface Functor<F extends KindName> {
  /** The name of the constructor. An instance can omit it: it lets TypeScript infer `F` from the type of an instance. */
  readonly kind?: F;
  readonly map: <A, B>(fa: Kind<F, A>, f: (a: A) => B) => Kind<F, B>;
}

/**
 * A monad: a functor with `of` and `flatMap`. The laws are the left identity `flatMap(of(a), k)` equals `k(a)`, the
 * right identity `flatMap(m, of)` equals `m`, and the associativity of `flatMap`.
 */
export interface Monad<F extends KindName> extends Functor<F> {
  readonly of: <A>(a: A) => Kind<F, A>;
  readonly flatMap: <A, B>(fa: Kind<F, A>, f: (a: A) => Kind<F, B>) => Kind<F, B>;
}
