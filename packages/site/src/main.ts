import "./style.css";
import { inlineHtml, type PackageInfo, type RoadmapItem, type StatusKind } from "./index.ts";

declare const __ROADMAP__: readonly RoadmapItem[];
declare const __PACKAGES__: readonly PackageInfo[];
declare const __BUILD__: { readonly sha: string; readonly date: string };

/** This function finds an element of the page. A missing element is a fault of the page, so it throws. */
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element;
}

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

// The three classes of the A13 census on the exact-v1 dump of highways.
interface CensusClass {
  readonly id: number;
  readonly name: string;
  readonly cases: number;
  readonly meaning: string;
  readonly finding: string;
}

const classes: readonly CensusClass[] = [
  {
    id: 1,
    name: "A wrong sign that exact signs fix",
    cases: 0,
    meaning: "The float sign is wrong, a user sees the error in the drawing, and the exact sign gives the correct drawing.",
    finding: "No test of the dump is in this class. This class is the reason for exact predicates, and it is empty.",
  },
  {
    id: 2,
    name: "A tie at a tolerance",
    cases: 5,
    meaning: "The exact clipped length of a segment in a box is equal to the tolerance eps 0.5. The float length is a little larger, so the float test says that the segment hits the box.",
    finding: "Four ties are in a measure and one is in a router. An A/B run of the router showed no change of a route, a cost or a measure.",
  },
  {
    id: 3,
    name: "A fault in the rule of the measure",
    cases: 1,
    meaning: "Two routes share a run of a line, and one route leaves on the other side. The crossing count misses this true crossing.",
    finding: "Exact signs do not fix this case. The fix is a rule for a shared run in the crossing measure of highways, with no new predicate.",
  },
];

const most = Math.max(...classes.map((entry) => entry.cases), 1);
let selected = 2;

byId("classes").innerHTML = classes.map((entry) => {
  const width = (entry.cases / most) * 100;
  return `<button type="button" class="bar-row" data-class="${entry.id}" aria-pressed="false">
    <span class="bar-label">Class ${entry.id}<span class="bar-name">${entry.name}</span></span>
    <span class="bar-track"><span class="bar c${entry.id}" style="width:${width}%"></span><span class="bar-value">${entry.cases} ${entry.cases === 1 ? "case" : "cases"}</span></span>
  </button>`;
}).join("");

function showClass(): void {
  for (const row of byId("classes").querySelectorAll<HTMLElement>(".bar-row")) {
    row.setAttribute("aria-pressed", String(Number(row.dataset["class"]) === selected));
  }
  const entry = classes.find((item) => item.id === selected) ?? classes[0];
  if (!entry) return;
  byId("class-detail").innerHTML = `<h3>Class ${entry.id}: ${entry.name}</h3><p>${inlineHtml(entry.meaning)}</p><p>${inlineHtml(entry.finding)}</p>`;
}

function pick(event: Event): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>(".bar-row");
  const id = Number(target?.dataset["class"]);
  if (!target || id === selected) return;
  selected = id;
  showClass();
}

byId("classes").addEventListener("click", pick);
byId("classes").addEventListener("mouseover", (event) => {
  if (window.matchMedia("(hover: hover)").matches) pick(event);
});
showClass();

byId("foot").innerHTML = `Built from commit <code>${inlineHtml(__BUILD__.sha)}</code> on ${inlineHtml(__BUILD__.date)}. MIT license. No trackers, no external fonts.`;
