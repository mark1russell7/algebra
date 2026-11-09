/**
 * The census part of the page: the four classes of the float-wrong tests of each set, and the table of the real
 * float-wrong records. A button of a record opens it in the explorer.
 *
 * @packageDocumentation
 */
import type { NearMiss, NearMissFile } from "./presets.ts";
import { escapeAttribute as esc } from "@mark1russell7/text";

/** The id of a class of the float-wrong tests. */
export type ClassId = 1 | 2 | 3 | 4;

/** The counts of one set of the census. */
export interface CensusSet {
  readonly set: string;
  readonly tests: number;
  readonly undecided: number;
  readonly floatWrong: number;
  readonly classes: Readonly<Record<ClassId, number>>;
}

/** The float-wrong tests of one call site, over all sets. */
export interface CensusSite {
  readonly class: ClassId;
  readonly fn: string;
  readonly via: string;
  readonly tests: number;
}

/** The file `data/census-classes.json`. A test compares it with the kept reports of the census. */
export interface CensusFile {
  readonly highways: { readonly census: string; readonly dump: string; readonly sets: readonly CensusSet[]; readonly sites: readonly CensusSite[] };
  readonly packing: { readonly census: string; readonly dump: string; readonly set: string; readonly tests: number; readonly undecided: number; readonly floatWrong: number };
}

/** The text of one class. */
export interface CensusClass {
  readonly id: ClassId;
  readonly name: string;
  readonly meaning: string;
  readonly finding: string;
}

/** The four classes of `wrongClassOf` of the census. */
export const CLASSES: readonly CensusClass[] = [
  {
    id: 1,
    name: "A defect of the bound",
    meaning: "A float sign differs from an exact sign that the bound fixes.",
    finding: "No test of any set is in this class. A value other than 0 is a defect of the bound.",
  },
  {
    id: 2,
    name: "A sign near zero",
    meaning: "The bound cannot fix a sign, so rounding decides the float answer.",
    finding: "In this class, an exact sign can change a decision of highways. Highways examines these sites with the A5 predicates.",
  },
  {
    id: 3,
    name: "A crossing measure",
    meaning: "This class is a class 2 segment pair in a crossing measure of the bench of highways.",
    finding: "A router does not read these answers. On exact-v1, one such pair is a lane that leaves a shared lane. Exact signs do not fix that pair: its fix is a rule for a shared run.",
  },
  {
    id: 4,
    name: "A tie at the tolerance",
    meaning: "The exact part of the segment in the box has a length of exactly eps 0.5. The float length is a little larger, so the float test says that the segment hits the box.",
    finding: "Each record is such a tie, and a test examines this on the kept records. An earlier A/B run of the router on exact-v1 showed no change of a route, a cost or a measure. No A/B run covers the other sets.",
  },
];

/** This function gives the sum of the counts of the sets, as one more row. */
export function sumOfSets(sets: readonly CensusSet[]): CensusSet {
  const sum = (pick: (s: CensusSet) => number): number => sets.reduce((total, s) => total + pick(s), 0);
  return {
    set: "All",
    tests: sum((s) => s.tests),
    undecided: sum((s) => s.undecided),
    floatWrong: sum((s) => s.floatWrong),
    classes: { 1: sum((s) => s.classes[1]), 2: sum((s) => s.classes[2]), 3: sum((s) => s.classes[3]), 4: sum((s) => s.classes[4]) },
  };
}

/** This function gives the share of a class in a set, in percent. */
export function sharePercent(set: CensusSet, id: ClassId): number {
  return set.floatWrong === 0 ? 0 : (set.classes[id] / set.floatWrong) * 100;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element as T;
}

const count = (n: number): string => n.toLocaleString("en-US");
const giga = (n: number): string => `${(n / 1e9).toFixed(1)} G`;

function tile(value: string, caption: string, sub: string): string {
  return `<div class="tile big good"><span class="num">${esc(value)}</span><span class="cap">${caption}</span><span class="sub">${sub}</span></div>`;
}

function rowOf(row: CensusSet, selected: ClassId, isSum: boolean): string {
  const segments = CLASSES.filter((entry) => row.classes[entry.id] > 0)
    .map((entry) => {
      const label = `${row.set}, class ${entry.id}: ${count(row.classes[entry.id])} tests, ${sharePercent(row, entry.id).toFixed(1)} percent`;
      return `<button type="button" class="class-seg class-c${entry.id}${entry.id === selected ? " on" : ""}" data-class="${entry.id}" style="flex:${row.classes[entry.id]} 1 0" title="${esc(label)}" aria-label="${esc(label)}"></button>`;
    })
    .join("");
  return `<div class="class-row${isSum ? " all" : ""}"><span class="set">${esc(row.set)}</span><span class="class-track">${segments}</span><span class="count">${count(row.floatWrong)}</span></div>`;
}

/**
 * This function starts the tiles, the bars and the table of the classes.
 *
 * @param file - The counts of the census.
 */
export function startClasses(file: CensusFile): void {
  const { sets, sites } = file.highways;
  const all = sumOfSets(sets);
  const exact = sets.find((s) => s.set === "exact-v1");
  byId("census-totals").innerHTML = [
    exact ? tile(count(exact.tests), "tests on <code>exact-v1</code> of highways, 40 boards", `float-wrong ${count(exact.floatWrong)} · class 1: ${count(exact.classes[1])}`) : "",
    tile(giga(all.tests), `tests on ${sets.length} sets of highways, with the rule of each call site`, `float-wrong ${count(all.floatWrong)} · class 1: ${count(all.classes[1])}`),
    tile(giga(file.packing.tests), `tests on <code>${esc(file.packing.set)}</code> of packing`, `float-wrong ${count(file.packing.floatWrong)} · undecided ${count(file.packing.undecided)}`),
  ].join("");
  const open = sites.filter((s) => s.class === 2).slice(0, 2);
  byId("census-open").innerHTML = `The largest open call sites of highways are ${open.map((s) => `<code>${esc(s.fn)}</code> at <code>${esc(s.via)}</code> (${count(s.tests)} tests)`).join(" and ")}. These sums count a board again if two sets have it.`;
  byId("census-result").textContent = `On these inputs, class 1 is ${count(all.classes[1])} in each set. So a float answer differs from the exact answer only at a tie or at a sign near zero, and the value of item A5 is its robustness there.`;
  byId("class-table").innerHTML = `<table><thead><tr><th scope="col">Set</th><th scope="col">Tests</th><th scope="col">Undecided</th><th scope="col">Float-wrong</th>${CLASSES.map((entry) => `<th scope="col">Class ${entry.id}</th>`).join("")}</tr></thead><tbody>${[...sets, all]
    .map((s) => `<tr><td>${esc(s.set)}</td><td>${count(s.tests)}</td><td>${count(s.undecided)}</td><td>${count(s.floatWrong)}</td>${CLASSES.map((entry) => `<td>${count(s.classes[entry.id])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

  let selected: ClassId = 2;
  const legend = byId("class-legend");
  const chart = byId("classes");
  const show = (): void => {
    legend.innerHTML = CLASSES.map(
      (entry) => `<button type="button" class="class-key" data-class="${entry.id}" aria-pressed="${entry.id === selected}"><span class="swatch class-c${entry.id}"></span>${entry.id}: ${esc(entry.name)} <span class="n">${count(all.classes[entry.id])}</span></button>`,
    ).join("");
    chart.innerHTML = [rowOf(all, selected, true), ...sets.map((s) => rowOf(s, selected, false))].join("");
    const entry = CLASSES.find((item) => item.id === selected);
    if (!entry) return;
    const here = sites.filter((s) => s.class === selected);
    const list = here.length === 0 ? "" : `<ul class="class-sites">${here.map((s) => `<li><code>${esc(s.fn)} ${esc(s.via)}</code><span class="n">${count(s.tests)}</span></li>`).join("")}</ul>`;
    byId("class-detail").innerHTML = `<h4>Class ${entry.id}: ${esc(entry.name)}</h4><p>${esc(entry.meaning)}</p><p>${esc(entry.finding)}</p>${list}`;
  };
  const pick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-class]");
    const id = Number(target?.dataset["class"]) as ClassId;
    if (!target || id === selected) return;
    selected = id;
    show();
  };
  legend.addEventListener("click", pick);
  chart.addEventListener("click", pick);
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
