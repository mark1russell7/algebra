/**
 * The catalog of the instances, and their descriptions as JSON. A consumer lists each structure, each operation and
 * each law from these descriptions. No operation runs. This list is the first input of the type graph.
 *
 * @packageDocumentation
 */
import { ONE, ZERO, fromNumber } from "@mark1russell7/rational";
import { BOOLEAN_LATTICE, BOOLEAN_RING } from "./booleans.ts";
import { DOUBLE_ADD, DOUBLE_LATTICE } from "./doubles.ts";
import { integersMod, primeField } from "./integers-mod.ts";
import { LAW_NAMES, LAWS } from "./laws.ts";
import { fieldOf, inputsOf, operationFields, partsOf } from "./levels.ts";
import { extendFinite, extendRationals } from "./extension.ts";
import type { RootExtension } from "./extension.ts";
import { INTEGER_RING } from "./integers.ts";
import { alternatingSubgroup, symmetricGroup } from "./permutations.ts";
import { polynomial, polynomialRing } from "./polynomial-ring.ts";
import { integerIdeal, quotientGroup, quotientRing, RATIONALS_MOD_INTEGERS } from "./quotient.ts";
import { RATIONAL_FIELD, RATIONAL_LATTICE } from "./rationals.ts";
import type { AnyStructure, Constant, Construction, Evidence, LawName, Level, Unary } from "./structure.ts";

/** One operation, as text. */
export interface OperationDescription {
  /** The field of the structure. */
  readonly field: string;
  readonly name: string;
  readonly symbol: string;
  readonly arity: number;
}

/** One law, as text. */
export interface LawDescription {
  readonly name: LawName;
  readonly level: Level;
  readonly arity: number;
  readonly statement: string;
  readonly preservedByProduct: boolean;
  readonly preservedByQuotient: boolean;
}

/** A structure as JSON. It has no function and no `bigint`. */
export interface StructureDescription {
  readonly name: string;
  readonly level: Level;
  readonly carrier: {
    readonly name: string;
    readonly description: string;
    readonly exact: boolean;
    /** The count of the listed elements, for a small finite carrier. */
    readonly size?: number;
  };
  readonly operations: readonly OperationDescription[];
  readonly claims: readonly LawName[];
  readonly refuted: readonly { readonly law: LawName; readonly note: string }[];
  readonly parts: Readonly<Record<string, StructureDescription>>;
  /** How the structure came from its inputs. A plain instance has no such field. */
  readonly construction?: {
    readonly name: Construction["name"];
    readonly inputs: Readonly<Record<string, StructureDescription>>;
    readonly evidence?: Evidence;
  };
}

const SYMMETRIC_3 = symmetricGroup(3);

const fieldOrRing = <T>(extension: RootExtension<T>): AnyStructure => extension.field ?? extension.ring;

/** The structures of the catalog. Each one holds its lower levels as parts, and each construction holds its inputs. */
export const CATALOG: readonly AnyStructure[] = [
  RATIONAL_FIELD,
  RATIONAL_LATTICE,
  integersMod(6n),
  primeField(7n),
  BOOLEAN_RING,
  BOOLEAN_LATTICE,
  DOUBLE_ADD,
  DOUBLE_LATTICE,
  INTEGER_RING,
  SYMMETRIC_3,
  quotientRing(integerIdeal(6n)),
  quotientGroup(alternatingSubgroup(SYMMETRIC_3)),
  RATIONALS_MOD_INTEGERS,
  polynomialRing(RATIONAL_FIELD),
  polynomialRing(primeField(2n)),
  polynomialRing(integersMod(6n)),
  fieldOrRing(extendRationals(polynomial(RATIONAL_FIELD, [fromNumber(-2), ZERO, ONE]))),
  extendRationals(polynomial(RATIONAL_FIELD, [fromNumber(-1), ZERO, ONE])).ring,
  fieldOrRing(extendFinite(primeField(2n), [1n, 1n, 1n])),
];

/** This function gives the description of a law. */
export const describeLaw = (name: LawName): LawDescription => {
  const { level, arity, statement, preservedByProduct, preservedByQuotient } = LAWS[name];
  return { name, level, arity, statement, preservedByProduct, preservedByQuotient };
};

/** This function gives the description of each law of the catalog. */
export const describeLaws = (): readonly LawDescription[] => LAW_NAMES.map(describeLaw);

/**
 * This function gives the description of a structure and of its parts. It reads only the names of the data. It does
 * not start an operation, `sample` or `equals`.
 *
 * @param structure - The structure.
 */
export const describe = (structure: AnyStructure): StructureDescription => {
  const { name, description, exact, elements } = structure.carrier;
  const claimed = new Set(Object.keys(structure.claims));
  const { construction } = structure;
  return {
    name: structure.name,
    level: structure.level,
    carrier: { name, description, exact, ...(elements === undefined ? {} : { size: elements.length }) },
    operations: operationFields(structure.level).map((field) => {
      const operation = fieldOf(structure, field) as Constant<unknown> | Unary<unknown>;
      return { field, name: operation.name, symbol: operation.symbol, arity: operation.arity };
    }),
    claims: LAW_NAMES.filter((law) => claimed.has(law)),
    refuted: (structure.refuted ?? []).map(({ law, note }) => ({ law, note })),
    parts: Object.fromEntries(partsOf(structure).map(([field, part]) => [field, describe(part)])),
    ...(construction === undefined
      ? {}
      : {
          construction: {
            name: construction.name,
            inputs: Object.fromEntries(inputsOf(structure).map(([role, input]) => [role, describe(input)])),
            ...(construction.evidence === undefined ? {} : { evidence: { ...construction.evidence } }),
          },
        }),
  };
};

/** This function gives the description of each structure of the catalog. */
export const describeCatalog = (): readonly StructureDescription[] => CATALOG.map(describe);
