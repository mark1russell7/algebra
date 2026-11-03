import "./style.css";
import costReport from "../../evaluator-bench/results/2026-11-03/report.json";
import nearMissJson from "../data/near-misses.json";
import { startClasses, startRecords } from "./census-view.ts";
import type { CostReport } from "./cost.ts";
import { startCost } from "./cost-view.ts";
import { Explorer } from "./explorer.ts";
import { inlineHtml, type PackageInfo, type RoadmapItem, type StatusKind } from "./index.ts";
import { startPlayground } from "./playground.ts";
import { CLASSROOM, INCIRCLE, parseNearMisses, presetOfRecord } from "./presets.ts";

declare const __ROADMAP__: readonly RoadmapItem[];
declare const __PACKAGES__: readonly PackageInfo[];
declare const __BUILD__: { readonly sha: string; readonly date: string };

/** This function finds an element of the page. A missing element is a fault of the page, so it throws. */
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element;
}

// The explorer: the classroom input, then each real record of the census.
const file = parseNearMisses(nearMissJson);
const records = file.records.map((r, k) => presetOfRecord(r, k));
const groups = new Map<string, string>();
for (const p of CLASSROOM) groups.set(p.id, "Classroom");
for (const p of INCIRCLE) groups.set(p.id, "In-circle (A5)");
for (const p of records) groups.set(p.id, `Census records: ${p.record?.set ?? ""}`);
const explorer = new Explorer(byId("ex"));
explorer.setPresets([...CLASSROOM, ...INCIRCLE, ...records], groups);
// A link can name a preset, for example ?preset=record-13.
const asked = new URLSearchParams(window.location.search).get("preset");
if (asked) explorer.load(asked);

startPlayground();
startCost(costReport as unknown as CostReport);
startClasses();
startRecords(file, (index) => {
  explorer.load(`record-${index}`);
  byId("explorer").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

// The packages, from the package.json of each package at build time.
byId("package-list").innerHTML = __PACKAGES__.map((pkg) => {
  const where = pkg.private
    ? `<span class="badge later">not on npm yet</span>`
    : `<a class="badge done" href="https://www.npmjs.com/package/${inlineHtml(pkg.name)}">npm ${inlineHtml(pkg.version)}</a>`;
  const folder = pkg.name.replace(/^@[^/]+\//, "");
  return `<li><div class="pkg-head"><a href="https://github.com/mark1russell7/algebra/tree/main/packages/${inlineHtml(folder)}"><code>${inlineHtml(pkg.name)}</code></a>${where}</div><p>${inlineHtml(pkg.description)}</p></li>`;
}).join("");

// The roadmap, from docs/ROADMAP.md at build time.
const labels: Record<StatusKind, string> = { done: "Done", progress: "In progress", planned: "Not started", later: "Later" };
const kinds: StatusKind[] = ["done", "progress", "planned", "later"];
let shown: StatusKind | "all" = "all";

function renderItems(): void {
  byId("items").innerHTML = __ROADMAP__.filter((item) => shown === "all" || item.kind === shown)
    .map((item) => `<li class="item ${item.kind}"><details><summary><span class="id">${inlineHtml(item.id)}</span><span class="title">${inlineHtml(item.title)}</span><span class="badge ${item.kind}">${inlineHtml(item.status)}</span></summary><p>${inlineHtml(item.summary)}</p></details></li>`)
    .join("");
}

function renderFilters(): void {
  const count = (kind: StatusKind): number => __ROADMAP__.filter((item) => item.kind === kind).length;
  const button = (value: StatusKind | "all", label: string, n: number): string =>
    `<button type="button" data-kind="${value}" aria-pressed="${shown === value}">${label} <span class="n">${n}</span></button>`;
  byId("filters").innerHTML = button("all", "All", __ROADMAP__.length) + kinds.filter((kind) => count(kind) > 0).map((kind) => button(kind, labels[kind], count(kind))).join("");
}

byId("filters").addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest("button");
  if (!target) return;
  shown = (target.dataset["kind"] ?? "all") as StatusKind | "all";
  renderFilters();
  renderItems();
});
renderFilters();
renderItems();

byId("foot").innerHTML = `Built from commit <code>${inlineHtml(__BUILD__.sha)}</code> on ${inlineHtml(__BUILD__.date)}. Each number on this page comes from the packages of this repository, live in your browser, or from the census records. MIT license. No trackers, no external fonts.`;
