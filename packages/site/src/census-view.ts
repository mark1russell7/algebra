/**
 * The census part of the page: the three classes of the `exact-v1` cases, and the table of the real float-wrong
 * records. A button of a record opens it in the explorer.
 *
 * @packageDocumentation
 */
import type { NearMiss, NearMissFile } from "./presets.ts";

/** One class of the cases of the A13 census on `exact-v1`. */
export interface CensusClass {
  readonly id: number;
  readonly name: string;
  readonly cases: number;
  readonly meaning: string;
  readonly finding: string;
}

/** The three classes of the A13 census on the `exact-v1` dump of highways. */
export const CLASSES: readonly CensusClass[] = [
  {
    id: 1,
    name: "A wrong sign that exact signs fix",
    cases: 0,
    meaning: "The float sign is wrong, a user sees the error in the drawing, and the exact sign gives the correct drawing.",
    finding: "No test of the dump is in this class. This class is the reason for exact predicates, and it is empty.",
  },
  {
    id: 2,
    name: "A tie at a tolerance or a touch",
    cases: 5,
    meaning: "The exact clipped length of a segment in a box is equal to the tolerance eps 0.5. The float length is a little larger, so the float test says that the segment hits the box.",
    finding: "Four ties are in a measure and one is in a router. An A/B run of the router showed no change of a route, a cost or a measure.",
  },
  {
    id: 3,
    name: "The rule of the measure",
    cases: 1,
    meaning: "Two routes share a run of a line, and one route leaves on the other side. The crossing count misses this true crossing.",
    finding: "Exact signs do not fix this case. The fix is a rule for a shared run in the crossing measure of highways, with no new predicate.",
  },
];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element as T;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** This function starts the bars of the classes. */
export function startClasses(): void {
  const most = Math.max(...CLASSES.map((entry) => entry.cases), 1);
  let selected = 2;
  const box = byId("classes");
  box.innerHTML = CLASSES.map((entry) => {
    const width = (entry.cases / most) * 100;
    return `<button type="button" class="bar-row" data-class="${entry.id}" aria-pressed="false">
      <span class="bar-label">Class ${entry.id}<span class="bar-name">${esc(entry.name)}</span></span>
      <span class="bar-track"><span class="bar c${entry.id}" style="width:${width}%"></span><span class="bar-value">${entry.cases} ${entry.cases === 1 ? "case" : "cases"}</span></span>
    </button>`;
  }).join("");
  const show = (): void => {
    for (const row of box.querySelectorAll<HTMLElement>(".bar-row")) row.setAttribute("aria-pressed", String(Number(row.dataset["class"]) === selected));
    const entry = CLASSES.find((item) => item.id === selected) ?? CLASSES[0];
    if (!entry) return;
    byId("class-detail").innerHTML = `<h4>Class ${entry.id}: ${esc(entry.name)}</h4><p>${esc(entry.meaning)}</p><p>${esc(entry.finding)}</p>`;
  };
  const pick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(".bar-row");
    const id = Number(target?.dataset["class"]);
    if (!target || id === selected) return;
    selected = id;
    show();
  };
  box.addEventListener("click", pick);
  box.addEventListener("mouseover", (event) => {
    if (window.matchMedia("(hover: hover)").matches) pick(event);
  });
  show();
}

/** This function counts the records of each set, in the order of the file. */
export function countBySet(records: readonly NearMiss[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.set, (counts.get(r.set) ?? 0) + 1);
  return [...counts.entries()];
}

const answerText = (x: boolean | number): string => (typeof x === "boolean" ? (x ? "true" : "false") : x > 0 ? "+1" : x < 0 ? "−1" : "0");
const signText = (s: number): string => (s > 0 ? "+" : s < 0 ? "−" : "0");

/**
 * This function starts the table of the records.
 *
 * @param file - The file of the records.
 * @param open - This function opens the record with the index in the explorer.
 */
export function startRecords(file: NearMissFile, open: (index: number) => void): void {
  const runLink = (repo: string, id: string): string => `<a href="https://github.com/mark1russell7/${repo}/actions/runs/${esc(id)}">${esc(id)}</a>`;
  const first = file.records[0];
  byId("nm-note").innerHTML = first
    ? `${file.records.length} records from census run ${runLink("algebra", first.source.census)} of the highways dump run ${runLink("highways", first.source.dump)}. Each record has a sign where the float sign is not the exact sign. These records come from the rerun, so they are not only <code>exact-v1</code>.`
    : "No records.";
  const sets = countBySet(file.records);
  let shown = "all";
  const chips = byId("nm-sets");
  const renderChips = (): void => {
    const chip = (value: string, label: string, n: number): string =>
      `<button type="button" data-set="${esc(value)}" aria-pressed="${shown === value}">${esc(label)} <span class="n">${n}</span></button>`;
    chips.innerHTML = chip("all", "All", file.records.length) + sets.map(([set, n]) => chip(set, set, n)).join("");
  };
  const renderRows = (): void => {
    byId("nm-rows").innerHTML = file.records
      .map((r, k) => ({ r, k }))
      .filter(({ r }) => shown === "all" || r.set === shown)
      .map(
        ({ r, k }) => `<tr>
          <td><span class="case">${esc(r.case)}</span><span class="fn"><code>${esc(r.fn)}</code></span></td>
          <td>${r.flips.map((f) => `<span class="flip"><code>${esc(f.name)}</code> <span class="chip zero" title="float sign">${signText(f.floatSign)}</span>&rarr;<span class="chip ${f.exactSign > 0 ? "pos" : "neg"}" title="exact sign">${signText(f.exactSign)}</span></span>`).join("")}</td>
          <td class="ans"><span title="float answer">${answerText(r.floatAnswer)}</span> &rarr; <strong title="exact answer">${answerText(r.exactAnswer)}</strong></td>
          <td><button type="button" class="open" data-open="${k}" aria-label="Open the record ${k + 1} in the explorer">Open</button></td>
        </tr>`,
      )
      .join("");
  };
  chips.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b) return;
    shown = b.dataset["set"] ?? "all";
    renderChips();
    renderRows();
  });
  byId("nm-rows").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-open]");
    if (b) open(Number(b.dataset["open"]));
  });
  renderChips();
  renderRows();
}
