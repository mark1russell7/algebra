/**
 * The marks and the controls of the precision section.
 *
 * @packageDocumentation
 */
import type { CostModel } from "@algebra/evaluator-select";
import { logPlace, rawRecordsLink } from "./cost.ts";
import { FAMILIES, LABELS } from "./cost-view.ts";
import { armName, costRows, stagePlans, stageVerdict, verdictGrid } from "./precision.ts";
import type { Baseline, PrecisionReport } from "./precision.ts";

const COST_AXIS: readonly [number, number] = [10, 10000];

const BASELINES: readonly { readonly baseline: Baseline; readonly label: string }[] = [
  { baseline: "exact", label: "Against exact" },
  { baseline: "interval", label: "Against interval" },
];

/** The class and the short word of each verdict. The word goes with the color, so the color is not alone at any time. */
const VERDICTS: Readonly<Record<string, { readonly css: string; readonly word: string }>> = {
  faster: { css: "is-faster", word: "faster" },
  slower: { css: "is-slower", word: "slower" },
  "cannot decide": { css: "is-open", word: "no claim" },
};

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element as T;
}

const ns = (x: number): string => (x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US"));
const head = (arm: string): string => (arm === "stage" ? "stage" : arm);

/** This function draws the cost of one node and one point of each arm, on a logarithmic axis. */
function renderCosts(report: PrecisionReport): void {
  const rows = costRows(report);
  const exact = rows.find((r) => r.arm === "exact")!.cost;
  const [low, high] = COST_AXIS;
  byId("precision-costs").innerHTML = rows
    .map((r) => {
      const ratio = r.cost / exact;
      const versus = r.arm === "exact" ? "the base" : `× ${ratio.toPrecision(3)} of exact`;
      const kind = r.arm === "interval" || r.arm === "exact" ? "is-verb" : "";
      return `<li class="${kind}" title="${armName(r.arm)}: ${ns(r.cost)} ns for one node and one point, ${versus}.">
        <span class="cost-name">${armName(r.arm)}</span>
        <span class="cost-track" aria-hidden="true"><i class="cost-bar" style="width:${logPlace(r.cost, low, high) * 100}%"></i></span>
        <span class="cost-value">${ns(r.cost)} ns</span>
        <span class="cost-verdict">${versus}</span>
      </li>`;
    })
    .join("");
}

/** This function draws the verdict of each precision and of the stage against a verb, for each family. */
function renderGrid(report: PrecisionReport, baseline: Baseline): void {
  const { arms, rows } = verdictGrid(report, baseline);
  const cell = (c: { readonly arm: string; readonly outcome: string; readonly medianRatio: number }, family: string): string => {
    const v = VERDICTS[c.outcome] ?? { css: "is-open", word: c.outcome };
    const title = `${armName(c.arm)} against ${baseline}, ${family}: median × ${c.medianRatio.toPrecision(3)}. Verdict: ${c.outcome}.`;
    return `<td class="${v.css}" title="${title}"><span class="grid-ratio">× ${c.medianRatio.toPrecision(2)}</span><span class="grid-word">${v.word}</span></td>`;
  };
  byId("precision-grid").innerHTML = `<caption>The median time of each arm over the time of ${baseline}, by family</caption>
    <thead><tr><th scope="col">Family</th>${arms.map((a) => `<th scope="col">${head(a)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((row) => {
        const name = row.family === "all" ? "All families" : (FAMILIES[row.family] ?? row.family);
        return `<tr class="${row.family === "all" ? "is-all" : ""}"><th scope="row">${name}</th>${row.cells.map((c) => cell(c, name)).join("")}</tr>`;
      })
      .join("")}</tbody>`;
}

/** This function draws the answers of the stage and the plan of the selector for each question of the run. */
function renderStage(report: PrecisionReport, model: CostModel): void {
  const plans = stagePlans(model, report);
  byId("precision-verdict").textContent = stageVerdict(plans);
  byId("precision-stage").innerHTML = `<caption>The stage on each question of the run, and the plan of the selector</caption>
    <thead><tr><th scope="col">Question</th><th scope="col">Answered</th><th scope="col">Wrong</th><th scope="col">Bits, median and largest</th><th scope="col">Plan of the selector</th></tr></thead>
    <tbody>${plans
      .map((p) => {
        const name = LABELS[p.question] ?? p.question;
        const plan = p.selection.plan.map((s) => (s === "bigfloat" ? `<strong>${s}</strong>` : s)).join(" → ");
        return `<tr><th scope="row">${name}</th><td>${p.met} of ${p.records}</td><td>${p.wrong}</td><td>${p.medianPrecision}, ${p.maxPrecision}</td>
          <td><span class="cost-plan">${plan}</span> <span class="grid-word">${ns(p.selection.expectedCost)} ns</span></td></tr>`;
      })
      .join("")}</tbody>`;
}

/** This function starts the precision section. The model is the model of A6, and the run names the kept folder of A7. */
export function startPrecision(report: PrecisionReport, model: CostModel, run: { readonly run: string; readonly folder: string }): void {
  const link = rawRecordsLink(run, "bigfloat-bench");
  const raw = byId<HTMLAnchorElement>("precision-raw");
  raw.href = link.href;
  raw.textContent = link.text;
  byId("precision-limit").textContent = `${report.model.limit}`;
  const chips = byId("precision-baseline");
  let baseline: Baseline = "exact";
  chips.innerHTML = BASELINES.map((b) => `<button type="button" data-baseline="${b.baseline}" aria-pressed="false">${b.label}</button>`).join("");
  const render = (): void => {
    for (const b of chips.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset["baseline"] === baseline));
    renderGrid(report, baseline);
  };
  chips.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    baseline = button.dataset["baseline"] as Baseline;
    render();
  });
  renderCosts(report);
  renderStage(report, model);
  render();
}
