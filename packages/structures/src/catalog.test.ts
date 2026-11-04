import { describe, expect, it } from "vitest";
import { CATALOG, DOUBLE_ADD, RATIONAL_FIELD, describe as describeStructure, describeCatalog, describeLaw, describeLaws, product } from "./index.ts";
import type { AnyStructure } from "./index.ts";

/** This function copies a value, and it replaces each function with a function that throws. */
const poisoned = <T>(value: T): T => {
  if (typeof value === "function") {
    return (() => {
      throw new Error("a description must not run an operation");
    }) as T;
  }
  if (Array.isArray(value)) return value.map(poisoned) as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, poisoned(entry)])) as T;
  }
  return value;
};

describe("the descriptions", () => {
  const descriptions = describeCatalog();

  it("survive a JSON round trip", () => {
    expect(JSON.parse(JSON.stringify(descriptions))).toEqual(descriptions);
    expect(JSON.parse(JSON.stringify(describeLaws()))).toEqual(describeLaws());
  });

  it.each(CATALOG.map((structure) => [structure.name, structure] as const))("of %s need no operation", (_, structure: AnyStructure) => {
    const copy = poisoned(structure);
    expect(() => copy.carrier.show(0)).toThrow();
    expect(describeStructure(copy)).toEqual(describeStructure(structure));
  });

  it("list the carrier, the operations and the claims of a structure", () => {
    const field = describeStructure(RATIONAL_FIELD);
    expect(field).toMatchObject({ name: "Q", level: "field", carrier: { name: "Q", exact: true } });
    expect(field.claims).toEqual(["leftDistributive", "rightDistributive", "nontrivial", "unitsAreNonzero", "unitsAgree"]);
    expect(Object.keys(field.parts)).toEqual(["additive", "multiplicative", "units"]);
    expect(field.parts["units"]?.operations).toEqual([
      { field: "op", name: "mul", symbol: "×", arity: 2 },
      { field: "identity", name: "one", symbol: "1", arity: 0 },
      { field: "inverse", name: "inverse", symbol: "⁻¹", arity: 1 },
    ]);
  });

  it("show what a structure does not claim", () => {
    const description = describeStructure(DOUBLE_ADD);
    expect(description.claims).not.toContain("associative");
    expect(description.refuted).toHaveLength(1);
    expect(description.refuted[0]?.law).toBe("associative");
    expect(description.carrier.exact).toBe(false);
  });

  it("cover a product too", () => {
    const description = describeStructure(product(RATIONAL_FIELD, RATIONAL_FIELD));
    expect(description.level).toBe("ring");
    expect(description.carrier.name).toBe("Q × Q");
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });

  it("cover each construction, with its inputs and its evidence as text", () => {
    const byName = new Map(descriptions.map((entry) => [entry.name, entry]));
    expect(byName.get("Z/(6)")?.construction?.name).toBe("quotient");
    expect(byName.get("Z/(6)")?.construction?.inputs["ideal"]?.level).toBe("ideal");
    expect(byName.get("Z/(6)")?.construction?.inputs["ideal"]?.parts["ring"]?.name).toBe("Z");
    expect(byName.get("S3/A3")?.level).toBe("group");
    expect(byName.get("Q/Z")?.carrier.exact).toBe(true);
    expect(byName.get("Q[x]")?.construction).toMatchObject({ name: "polynomial-ring", inputs: { coefficients: { name: "Q" } } });
    const field = byName.get("Q[x]/(x^2 + -2)");
    expect(field).toMatchObject({ level: "field", construction: { name: "root-extension", evidence: { verdict: "irreducible", method: "rational-root" } } });
    const ring = byName.get("Q[x]/(x^2 + -1)");
    expect(ring).toMatchObject({ level: "ring", construction: { evidence: { verdict: "reducible" } } });
    expect(ring?.refuted.map((entry) => entry.law)).toEqual(["noZeroDivisors"]);
    expect(ring?.refuted[0]?.note).toContain("is 0 modulo");
    expect(byName.get("Z/2[x]/(x^2 + x + 1)")?.carrier.size).toBe(4);
    expect(byName.get("Q")).not.toHaveProperty("construction");
  });

  it("give each law as data", () => {
    expect(describeLaw("associative")).toEqual({
      name: "associative",
      level: "magma",
      arity: 3,
      statement: "(a · b) · c = a · (b · c)",
      preservedByProduct: true,
      preservedByQuotient: true,
    });
  });
});
