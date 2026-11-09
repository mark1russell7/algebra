import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = resolve(SOURCE, "..");

/** The specifiers of each `import` and `export ... from` of a source text, the type imports too. */
const specifiersIn = (text: string): readonly string[] =>
  [...text.matchAll(/^\s*(?:import|export)\b[^'"]*?\sfrom\s+["']([^"']+)["']/gmu), ...text.matchAll(/^\s*import\s+["']([^"']+)["']/gmu)].map(
    (match) => match[1] as string,
  );

const specifiersOf = (file: string): readonly string[] => specifiersIn(readFileSync(file, "utf8"));

/** The source files that an entry reaches, and the bare specifiers that they import. */
const graphOf = (entry: string): { readonly files: readonly string[]; readonly bare: readonly string[] } => {
  const files = new Set<string>();
  const bare = new Set<string>();
  const visit = (file: string): void => {
    if (files.has(file)) return;
    files.add(file);
    for (const specifier of specifiersOf(file)) {
      if (specifier.startsWith(".")) visit(resolve(dirname(file), specifier));
      else bare.add(specifier);
    }
  };
  visit(join(SOURCE, entry));
  return { files: [...files].map((file) => relative(PACKAGE, file).replaceAll("\\", "/")).sort(), bare: [...bare].sort() };
};

describe("the entries of the package", () => {
  it("the core entry imports no package, and only the files of src/core", () => {
    const { files, bare } = graphOf("index.ts");
    expect(bare).toEqual([]);
    expect(files).toEqual(["src/core/helpers.ts", "src/core/instances.ts", "src/core/interfaces.ts", "src/index.ts"]);
  });

  it("the law entry imports only rigor-generators", () => {
    expect(graphOf("laws-entry.ts").bare).toEqual(["@mark1russell7/rigor-generators"]);
  });

  it("the catalog entry imports only rational and rigor-generators", () => {
    expect(graphOf("catalog-entry.ts").bare).toEqual(["@mark1russell7/rational", "@mark1russell7/rigor-generators"]);
  });

  it("the exports field names the three entries, for the source and for the build", () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
      readonly publishConfig: { readonly exports: Readonly<Record<string, unknown>> };
    };
    expect(manifest.exports).toEqual({
      ".": "./src/index.ts",
      "./laws": "./src/laws-entry.ts",
      "./catalog": "./src/catalog-entry.ts",
      "./package.json": "./package.json",
    });
    expect(Object.keys(manifest.publishConfig.exports)).toEqual(Object.keys(manifest.exports));
  });

  it("the planted import of a package in the core is found", () => {
    const planted = 'import {\n  random,\n} from "@mark1russell7/rigor-generators";\nimport type { X } from "./x.ts";\nexport { y } from "./y.ts";\nimport "side-effect";\n';
    expect(specifiersIn(planted)).toEqual(["@mark1russell7/rigor-generators", "./x.ts", "./y.ts", "side-effect"]);
  });
});
