import { defineConfig } from "tsdown";

// The build of the package for npm: one ES module and its declarations for each entry, in build/. The workspace uses the source.
// The entry `index` is the core, and it imports no package.
export default defineConfig({
  entry: { index: "src/index.ts", laws: "src/laws-entry.ts", catalog: "src/catalog-entry.ts" },
  outDir: "build",
  format: "esm",
  platform: "neutral",
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  publint: true,
});
