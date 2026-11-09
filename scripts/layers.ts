/**
 * The layers of the repository (item A16) as one table. `.dependency-cruiser.ts` makes a rule for each layer from the
 * table, and `layers.test.ts` examines the `package.json` files with it. `docs/LAYERS.md` tells the rule.
 *
 * @packageDocumentation
 */
import type { Rule } from "@mark1russell7/boundaries";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One layer: its number, its name and the npm names of its packages. */
export interface Layer {
  readonly level: number;
  readonly name: string;
  readonly packages: readonly string[];
}

/**
 * The layers, the lowest first. The table also names the packages that come into the repository on 2026-11-21.
 * Their imports from npm obey the same rule.
 */
export const LAYERS: readonly Layer[] = [
  { level: 1, name: "numbers", packages: ["@mark1russell7/rational", "@algebra/bigfloat", "@mark1russell7/interval", "@mark1russell7/quantity"] },
  { level: 2, name: "random", packages: ["@mark1russell7/rigor-generators"] },
  { level: 3, name: "structures", packages: ["@mark1russell7/structures"] },
  { level: 4, name: "probability", packages: [] },
  { level: 5, name: "statistics", packages: ["@mark1russell7/rigor-statistics"] },
  { level: 6, name: "expressions", packages: ["@mark1russell7/expression", "@algebra/polynomial", "@algebra/evaluator-select"] },
  { level: 7, name: "geometry checks", packages: ["@mark1russell7/predicates", "@mark1russell7/predicate-census"] },
  {
    level: 8,
    name: "tools",
    packages: [
      "@algebra/expression-corpus",
      "@algebra/bigfloat-bench",
      "@algebra/evaluator-bench",
      "@algebra/expression-bench",
      "@algebra/polynomial-bench",
      "@algebra/predicates-bench",
      "@algebra/rational-bench",
      "@algebra/site",
    ],
  },
];

/** The fields of a `package.json` that the check reads. */
export interface Manifest {
  readonly name: string;
  readonly private?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

/** A package of the workspace: its folder, relative to the root with `/`, and its `package.json`. */
export interface WorkspaceManifest {
  readonly dir: string;
  readonly manifest: Manifest;
}

/** This function gives the level of a package, or `undefined` when no layer names it. */
export function levelOf(name: string, layers: readonly Layer[] = LAYERS): number | undefined {
  return layers.find((l) => l.packages.includes(name))?.level;
}

/** This function gives each package of the folder `packages` that has a `package.json`, in the order of the names. */
export function workspaceManifests(root: string): WorkspaceManifest[] {
  const dirs = readdirSync(join(root, "packages"), { withFileTypes: true }).filter((d) => d.isDirectory());
  return dirs
    .map((d) => `packages/${d.name}`)
    .filter((dir) => existsSync(join(root, dir, "package.json")))
    .sort()
    .map((dir) => ({ dir, manifest: JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")) as Manifest }));
}

/** This function gives the runtime dependencies of a package: `dependencies`, `peerDependencies` and `optionalDependencies`. */
function runtimeOf(m: Manifest): string[] {
  return [...Object.keys(m.dependencies ?? {}), ...Object.keys(m.peerDependencies ?? {}), ...Object.keys(m.optionalDependencies ?? {})];
}

/** This function gives each dependency of a package, the test dependencies too. */
function allOf(m: Manifest): string[] {
  return [...runtimeOf(m), ...Object.keys(m.devDependencies ?? {})];
}

/** This function gives a cycle of the graph as a list of names, or `undefined` when the graph has no cycle. */
function cycleOf(graph: ReadonlyMap<string, readonly string[]>): string[] | undefined {
  const state = new Map<string, "open" | "done">();
  const path: string[] = [];
  const visit = (node: string): string[] | undefined => {
    if (state.get(node) === "done") return undefined;
    if (state.get(node) === "open") return [...path.slice(path.indexOf(node)), node];
    state.set(node, "open");
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle !== undefined) return cycle;
    }
    path.pop();
    state.set(node, "done");
    return undefined;
  };
  for (const node of [...graph.keys()].sort()) {
    const cycle = visit(node);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

/**
 * This function examines the `package.json` files with the layers and gives one text for each break of the rule.
 * An empty list tells that the packages obey the rule.
 */
export function layerFindings(packages: readonly WorkspaceManifest[], layers: readonly Layer[] = LAYERS): string[] {
  const findings: string[] = [];
  const names = layers.flatMap((l) => l.packages);
  for (const name of new Set(names)) {
    if (names.filter((n) => n === name).length > 1) findings.push(`${name} is in more than one layer.`);
  }
  const workspace = new Map(packages.map((p) => [p.manifest.name, p]));
  for (const { dir, manifest } of packages) {
    const level = levelOf(manifest.name, layers);
    if (level === undefined) {
      findings.push(`${manifest.name} (${dir}) is in no layer. Add it to LAYERS in scripts/layers.ts and to docs/LAYERS.md.`);
      continue;
    }
    for (const dep of runtimeOf(manifest)) {
      const depLevel = levelOf(dep, layers);
      if (depLevel !== undefined && depLevel > level) {
        findings.push(`${manifest.name} (layer ${level}) imports ${dep} (layer ${depLevel}) at run time. A runtime import goes to the same or a lower layer.`);
      }
      if (manifest.private !== true && workspace.get(dep)?.manifest.private === true) {
        findings.push(`${manifest.name} is published, and it imports the private package ${dep} at run time.`);
      }
    }
  }
  const graph = new Map(packages.map((p) => [p.manifest.name, allOf(p.manifest).filter((d) => workspace.has(d))]));
  const cycle = cycleOf(graph);
  if (cycle !== undefined) findings.push(`The imports make a cycle: ${cycle.join(" -> ")}.`);
  return findings;
}

/** The path of a test helper. Only the tests import a test helper, so its imports are test imports. */
export const TEST_HELPER = "\\.test-helper\\.[cm]?[jt]sx?$";

/** This function gives a regular expression that matches the text `s` and nothing more. */
function escaped(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * This function gives one `forbidden` rule of dependency-cruiser for each layer below the top layer. The rule stops an
 * import from the source of a package of the layer to a package of a higher layer. That package is in the workspace or
 * in `node_modules`. dependency-cruiser does not examine the tests, so a test import can go up. A test helper
 * (`*.test-helper.ts`) is test code too, so the rule does not examine it.
 */
export function layerRules(packages: readonly WorkspaceManifest[], layers: readonly Layer[] = LAYERS): Rule[] {
  const dirOf = new Map(packages.map((p) => [p.manifest.name, p.dir]));
  const rules: Rule[] = [];
  for (const layer of layers) {
    const from = layer.packages.flatMap((n) => dirOf.get(n) ?? []);
    const higher = layers.filter((l) => l.level > layer.level).flatMap((l) => l.packages);
    if (from.length === 0 || higher.length === 0) continue;
    const to = higher.flatMap((n) => {
      const dir = dirOf.get(n);
      return dir === undefined ? [`node_modules/${escaped(n)}/`] : [`^${escaped(dir)}/`, `node_modules/${escaped(n)}/`];
    });
    rules.push({
      name: `layer-${layer.level}-imports-up`,
      severity: "error",
      comment: `A package of the layer ${layer.name} (${layer.level}) imports a package of a higher layer at run time. See docs/LAYERS.md.`,
      from: { path: `^(${from.map(escaped).join("|")})/`, pathNot: TEST_HELPER },
      to: { path: `(${to.join("|")})` },
    });
  }
  return rules;
}
