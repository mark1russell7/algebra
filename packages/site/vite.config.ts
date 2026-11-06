import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { siteKpi, siteStamps } from "@mark1russell7/site-pages/vite";
import { defineConfig } from "vite";
import { parseRoadmap, type PackageInfo } from "./src/index.ts";
import { siteKpiInput } from "./src/kpi.ts";
import { siteDataStamps } from "./src/stamps.ts";

// The Pages workflow sets SITE_BASE to "/algebra". A local build uses the root.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const base = env["SITE_BASE"] ? `${env["SITE_BASE"].replace(/\/$/, "")}/` : "/";

const root = new URL("../../", import.meta.url);

// The page shows the items of docs/ROADMAP.md. A bad table stops the build, and the old site stays.
const roadmap = parseRoadmap(readFileSync(new URL("docs/ROADMAP.md", root), "utf8"));

// The page shows each package of the repository (each folder of packages/ with a package.json), but not the site.
const packages: PackageInfo[] = readdirSync(fileURLToPath(new URL("packages/", root)))
  .filter((folder) => folder !== "site" && existsSync(new URL(`packages/${folder}/package.json`, root)))
  .map((folder) => {
    const manifest = JSON.parse(readFileSync(new URL(`packages/${folder}/package.json`, root), "utf8")) as Record<string, unknown>;
    return {
      name: String(manifest["name"]),
      version: String(manifest["version"]),
      description: String(manifest["description"] ?? ""),
      private: manifest["private"] === true,
    };
  });

export default defineConfig({
  base,
  build: { target: "es2022" },
  plugins: [
    siteKpi(() => siteKpiInput(fileURLToPath(new URL("packages/evaluator-bench/results/", root)))),
    siteStamps(() =>
      siteDataStamps({
        census: JSON.parse(readFileSync(new URL("packages/site/data/census-classes.json", root), "utf8")),
        nearMisses: JSON.parse(readFileSync(new URL("packages/site/data/near-misses.json", root), "utf8")),
        kept: JSON.parse(readFileSync(new URL("packages/site/data/kept-runs.json", root), "utf8")),
      }),
    ),
  ],
  define: {
    __ROADMAP__: JSON.stringify(roadmap),
    __PACKAGES__: JSON.stringify(packages),
    __BUILD__: JSON.stringify({ sha: (env["GITHUB_SHA"] ?? "local").slice(0, 7), date: new Date().toISOString().slice(0, 10) }),
  },
});
