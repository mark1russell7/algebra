/**
 * The tests of the layers of `layers.ts`. The check passes on the packages of the repository and fails on a planted
 * mutant of them.
 *
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LAYERS, layerFindings, layerRules, levelOf, type Manifest, type WorkspaceManifest, workspaceManifests } from "./layers.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const packages = workspaceManifests(root);

/** This function gives the packages with one `package.json` changed. */
function changed(name: string, change: (m: Manifest) => Manifest): WorkspaceManifest[] {
  const found = packages.find((p) => p.manifest.name === name);
  assert.ok(found, name);
  return packages.map((p) => (p === found ? { dir: p.dir, manifest: change(p.manifest) } : p));
}

describe("the layers of the packages", () => {
  it("passes on the packages of the repository", () => {
    assert.ok(packages.length >= 16);
    assert.deepEqual(layerFindings(packages), []);
  });

  it("has 8 layers in order, and gives the level of a package", () => {
    assert.deepEqual(
      LAYERS.map((l) => l.level),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.equal(levelOf("@mark1russell7/rational"), 1);
    assert.equal(levelOf("@mark1russell7/rigor-statistics"), 5);
    assert.equal(levelOf("vitest"), undefined);
  });

  it("fails when a runtime import goes to a higher layer", () => {
    const up = changed("@algebra/bigfloat", (m) => ({ ...m, dependencies: { ...m.dependencies, "@mark1russell7/structures": "workspace:*" } }));
    const findings = layerFindings(up);
    assert.equal(findings.length, 1);
    assert.match(findings[0]!, /bigfloat \(layer 1\) imports @mark1russell7\/structures \(layer 3\)/);
    // This import also makes a cycle, and rational is published and expression is private: 3 findings.
    const all = layerFindings(changed("@mark1russell7/rational", (m) => ({ ...m, dependencies: { ...m.dependencies, "@mark1russell7/expression": "workspace:*" } })));
    assert.equal(all.length, 3);
  });

  it("allows a test import to a higher layer, but not a cycle", () => {
    const testUp = changed("@mark1russell7/rational", (m) => ({ ...m, devDependencies: { ...m.devDependencies, "@mark1russell7/expression": "workspace:*" } }));
    const findings = layerFindings(testUp);
    assert.equal(findings.length, 1);
    assert.match(findings[0]!, /^The imports make a cycle: .*@mark1russell7\/rational/);
    const noCycle = changed("@mark1russell7/structures", (m) => ({ ...m, devDependencies: { ...m.devDependencies, "@algebra/polynomial": "workspace:*" } }));
    assert.deepEqual(layerFindings(noCycle), []);
  });

  it("fails when a published package imports a private package at run time", () => {
    const priv = changed("@mark1russell7/predicates", (m) => ({ ...m, dependencies: { ...m.dependencies, "@mark1russell7/predicate-census": "workspace:*" } }));
    const findings = layerFindings(priv);
    assert.ok(findings.some((f) => /predicates is published, and it imports the private package @mark1russell7\/predicate-census/.test(f)));
  });

  it("fails when a package is in no layer, or in two layers", () => {
    const extra = [...packages, { dir: "packages/new", manifest: { name: "@algebra/new" } }];
    assert.deepEqual(layerFindings(extra), ["@algebra/new (packages/new) is in no layer. Add it to LAYERS in scripts/layers.ts and to docs/LAYERS.md."]);
    const twice = LAYERS.map((l) => (l.level === 8 ? { ...l, packages: [...l.packages, "@mark1russell7/rational"] } : l));
    assert.deepEqual(layerFindings(packages, twice), ["@mark1russell7/rational is in more than one layer."]);
  });
});

describe("the rules of dependency-cruiser", () => {
  const rules = layerRules(packages);
  const ruleOf = (level: number) => {
    const rule = rules.find((r) => r.name === `layer-${level}-imports-up`);
    assert.ok(rule, String(level));
    return { from: new RegExp(rule.from["path"] as string), to: new RegExp(rule.to["path"] as string) };
  };

  it("has a rule for each layer with packages in the workspace, below the top layer", () => {
    assert.deepEqual(
      rules.map((r) => r.name),
      ["layer-1-imports-up", "layer-3-imports-up", "layer-6-imports-up", "layer-7-imports-up"],
    );
  });

  it("stops an import from the source of a lower layer to a higher layer", () => {
    const numbers = ruleOf(1);
    assert.ok(numbers.from.test("packages/rational/src/index.ts"));
    assert.ok(!numbers.from.test("packages/rational-bench/src/index.ts"));
    assert.ok(numbers.to.test("packages/expression/src/index.ts"));
    assert.ok(numbers.to.test("node_modules/.pnpm/@mark1russell7+rigor-generators@0.1.8/node_modules/@mark1russell7/rigor-generators/build/index.js"));
    assert.ok(!numbers.to.test("packages/bigfloat/src/index.ts"));
    const expressions = ruleOf(6);
    assert.ok(expressions.to.test("packages/expression-corpus/src/index.ts"));
    assert.ok(!expressions.to.test("packages/expression/src/index.ts"));
    assert.ok(!expressions.to.test("node_modules/.pnpm/x/node_modules/@mark1russell7/rigor-statistics/build/index.js"));
  });

  it("does not examine a test helper, because only the tests import it", () => {
    for (const rule of rules) {
      const helper = new RegExp(rule.from["pathNot"] as string);
      assert.ok(helper.test("packages/interval/src/width.test-helper.ts"), rule.name);
      assert.ok(helper.test("packages/rational/src/random.test-helper.mts"), rule.name);
      assert.ok(!helper.test("packages/rational/src/index.ts"), rule.name);
      assert.ok(!helper.test("packages/rational/src/test-helper.ts"), rule.name);
    }
  });
});
