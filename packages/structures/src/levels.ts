/**
 * The levels, as data. The types of `structure.ts` state the reduction for the compiler. This table states it for a
 * consumer: the levels below, and the operations, parts and laws that each level adds.
 *
 * @packageDocumentation
 */
import { LAWS } from "./laws.ts";
import type { AnyStructure, LawName, Level } from "./structure.ts";

/** A part of a structure: a field that holds a structure with one operation, at a level, with extra laws. */
export interface PartSpecification {
  /** The name of the field. */
  readonly field: string;
  readonly level: Level;
  /** The laws that the part claims in addition to the laws of its level. */
  readonly laws: readonly LawName[];
  /** `true` when the part has a smaller carrier than its structure. The units of a field have this. */
  readonly ownCarrier?: true;
}

/** What one level adds to the levels below it. */
export interface LevelSpecification {
  readonly level: Level;
  readonly below: readonly Level[];
  /** The names of the fields that hold operations. */
  readonly operations: readonly string[];
  /** The parts. A part with the field of a part below replaces it: the field must then be stronger. */
  readonly parts: readonly PartSpecification[];
  readonly laws: readonly LawName[];
}

const semilattice: readonly LawName[] = ["commutative", "idempotent"];

/** The table of the levels. */
export const LEVELS: Readonly<Record<Level, LevelSpecification>> = {
  magma: { level: "magma", below: [], operations: ["op"], parts: [], laws: ["closed"] },
  semigroup: { level: "semigroup", below: ["magma"], operations: [], parts: [], laws: ["associative"] },
  "unital-magma": {
    level: "unital-magma",
    below: ["magma"],
    operations: ["identity"],
    parts: [],
    laws: ["leftIdentity", "rightIdentity"],
  },
  monoid: { level: "monoid", below: ["semigroup", "unital-magma"], operations: [], parts: [], laws: [] },
  group: {
    level: "group",
    below: ["monoid"],
    operations: ["inverse"],
    parts: [],
    laws: ["inverseClosed", "leftInverse", "rightInverse"],
  },
  ring: {
    level: "ring",
    below: [],
    operations: [],
    parts: [
      { field: "additive", level: "group", laws: ["commutative"] },
      { field: "multiplicative", level: "monoid", laws: [] },
    ],
    laws: ["leftDistributive", "rightDistributive"],
  },
  field: {
    level: "field",
    below: ["ring"],
    operations: [],
    parts: [
      { field: "multiplicative", level: "monoid", laws: ["commutative"] },
      { field: "units", level: "group", laws: ["commutative"], ownCarrier: true },
    ],
    laws: ["nontrivial", "unitsAreNonzero", "unitsAgree"],
  },
  order: {
    level: "order",
    below: [],
    operations: ["leq"],
    parts: [],
    laws: ["reflexive", "antisymmetric", "transitive"],
  },
  lattice: {
    level: "lattice",
    below: ["order"],
    operations: [],
    parts: [
      { field: "meet", level: "semigroup", laws: semilattice },
      { field: "join", level: "semigroup", laws: semilattice },
    ],
    laws: ["meetAgrees", "joinAgrees", "meetAbsorbs", "joinAbsorbs"],
  },
  "bounded-lattice": {
    level: "bounded-lattice",
    below: ["lattice"],
    operations: [],
    parts: [
      { field: "meet", level: "monoid", laws: semilattice },
      { field: "join", level: "monoid", laws: semilattice },
    ],
    laws: [],
  },
};

/** This function gives the level and each level below it, with no repeats. */
export const levelsBelow = (level: Level): readonly Level[] => [
  ...new Set<Level>([level, ...LEVELS[level].below.flatMap(levelsBelow)]),
];

/** This function gives the laws that are necessary at a level, with the laws of the levels below it. */
export const requiredLaws = (level: Level): readonly LawName[] => [
  ...new Set(levelsBelow(level).flatMap((entry) => LEVELS[entry].laws)),
];

/** This function gives the names of the fields that hold the operations of a level, with the levels below it. */
export const operationFields = (level: Level): readonly string[] => [
  ...new Set(levelsBelow(level).flatMap((entry) => LEVELS[entry].operations)),
];

/** This function gives the parts of a level. A part of a higher level replaces the part of a lower level. */
export const partSpecifications = (level: Level): readonly PartSpecification[] => {
  const parts = new Map<string, PartSpecification>();
  for (const entry of levelsBelow(level).toReversed()) {
    for (const part of LEVELS[entry].parts) parts.set(part.field, part);
  }
  return [...parts.values()];
};

/** This function reads a field of a structure by the name that the table gives. */
export const fieldOf = (structure: AnyStructure, field: string): unknown => (structure as unknown as Record<string, unknown>)[field];

/** This function gives the parts of a structure, with their field names. */
export const partsOf = (structure: AnyStructure): readonly (readonly [string, AnyStructure])[] =>
  partSpecifications(structure.level).map((part) => [part.field, fieldOf(structure, part.field) as AnyStructure]);

/**
 * This function gives each way in which a structure does not agree with the table. It does not start an operation.
 * A problem is a missing operation, part or law, a part at a low level, or a part with another carrier. A law that
 * is both claimed and refuted is a problem too.
 *
 * @returns The problems as text. An empty list means that the structure conforms, with its parts.
 */
export const conforms = (structure: AnyStructure): readonly string[] => {
  const problems: string[] = [];
  const claims = structure.claims as Readonly<Partial<Record<LawName, true>>>;
  const report = (text: string): void => {
    problems.push(`${structure.name}: ${text}`);
  };
  for (const field of operationFields(structure.level)) {
    if (fieldOf(structure, field) === undefined) report(`no operation ${field}`);
  }
  for (const name of requiredLaws(structure.level)) {
    if (claims[name] !== true) report(`no claim of ${name}`);
  }
  for (const name of Object.keys(claims) as LawName[]) {
    if (!levelsBelow(structure.level).includes(LAWS[name].level)) report(`the level does not have the law ${name}`);
  }
  for (const refuted of structure.refuted ?? []) {
    if (claims[refuted.law] === true) report(`the law ${refuted.law} is both claimed and refuted`);
  }
  for (const specification of partSpecifications(structure.level)) {
    const part = fieldOf(structure, specification.field) as AnyStructure | undefined;
    if (part === undefined) {
      report(`no part ${specification.field}`);
      continue;
    }
    if (!levelsBelow(part.level).includes(specification.level)) report(`the part ${specification.field} is below ${specification.level}`);
    const partClaims = part.claims as Readonly<Partial<Record<LawName, true>>>;
    for (const name of specification.laws) {
      if (partClaims[name] !== true) report(`the part ${specification.field} has no claim of ${name}`);
    }
    if (specification.ownCarrier !== true && part.carrier !== structure.carrier) report(`the part ${specification.field} has another carrier`);
    problems.push(...conforms(part));
  }
  return problems;
};
