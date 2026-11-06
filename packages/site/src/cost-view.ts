/**
 * The controls and the marks of the cost section.
 *
 * @packageDocumentation
 */
import type { Question } from "@algebra/evaluator-select";
import { logPlace, overallText, planAt, questionName, questionsOf, rawRecordsLink, scaleExact, stageRows } from "./cost.ts";
import type { CostReport } from "./cost.ts";

const LABELS: Readonly<Record<string, string>> = {
  sign: "The sign",
  "abs 1e-9": "Absolute 1e-9",
  "rel 1e-12": "Relative 1e-12",
  "rel 0": "Relative 0",
};

const FAMILIES: Readonly<Record<string, string>> = {
  small: "Small",
  large: "Large",
  well: "Well-conditioned",
  ill: "Ill-conditioned",
  "orient-random": "Orientation, random",
  "orient-near": "Orientation, near-degenerate",
  "incircle-random": "In-circle, random",
  "incircle-near": "In-circle, near-degenerate",
};

const STAGE_AXIS: readonly [number, number] = [1, 100000];
const RATIO_AXIS: readonly [number, number] = [0.001, 1000];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element as T;
}

const ns = (x: number): string => (x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US"));
const percent = (x: number): string => `${(x * 100).toFixed(1)} %`;

/** This function draws the ratio of the stitched plan to fixed `exact` for each family. */
function renderFamilies(report: CostReport): void {
  const exact = report.pairs.find((p) => p.stage === "exact");
  if (!exact) throw new Error("The report has no pair with the stage exact.");
  const [low, high] = RATIO_AXIS;
  const one = logPlace(1, low, high) * 100;
  byId("cost-families").innerHTML = exact.families
    .map((f) => {
      const name = FAMILIES[f.family] ?? f.family;
      const at = logPlace(f.medianRatio, low, high) * 100;
      const title = `${name}: the median time of the stitched plan is ${f.medianRatio.toPrecision(3)} times the time of exact. Verdict: ${f.outcome}.`;
      return `<li title="${title}">
        <span class="cost-name">${name}</span>
        <span class="cost-track" aria-hidden="true"><i class="cost-ratio" style="left:${Math.min(at, one)}%;width:${Math.abs(at - one)}%"></i><i class="cost-one" style="left:${one}%"></i></span>
        <span class="cost-value">× ${f.medianRatio.toPrecision(3)}</span>
        <span class="cost-verdict">${f.outcome}</span>
      </li>`;
    })
    .join("");
}

/** This function starts the cost section on the page. The bench names the run of the report and its kept folder. */
export function startCost(report: CostReport, bench: { readonly run: string; readonly folder: string }): void {
  byId("cost-overall").textContent = overallText(report);
  const link = rawRecordsLink(bench);
  const raw = byId<HTMLAnchorElement>("cost-raw");
  raw.href = link.href;
  raw.textContent = link.text;
  const questions = questionsOf(report.model);
  const chips = byId("cost-questions");
  const factorInput = byId<HTMLInputElement>("cost-factor");
  const factorOut = byId("cost-factor-out");
  const summary = byId("cost-summary");
  const stages = byId("cost-stages");
  let question: Question = questions[0]!;

  chips.innerHTML = questions
    .map((q, k) => `<button type="button" data-k="${k}" aria-pressed="false">${LABELS[questionName(q)] ?? questionName(q)}</button>`)
    .join("");

  const render = (): void => {
    const factor = 2 ** Number(factorInput.value);
    const model = scaleExact(report.model, factor);
    const { plan, expectedCost } = planAt(question, report.model, factor);
    factorOut.textContent = `× ${factor < 1 ? factor.toPrecision(2) : factor.toFixed(0)}`;
    for (const b of chips.querySelectorAll("button")) b.setAttribute("aria-pressed", String(questions[Number(b.dataset["k"])] === question));
    summary.innerHTML = `<span class="cost-plan">${plan.join(" → ")}</span>
      <span>${ns(expectedCost)} ns expected, against ${ns(model.cost.exact)} ns for fixed exact</span>`;
    const [low, high] = STAGE_AXIS;
    stages.innerHTML = stageRows(question, model, plan)
      .map((r) => {
        const reach = r.reach === null ? "not in the plan" : `${percent(r.reach)} of the points reach it`;
        return `<li class="${r.inPlan ? "in-plan" : ""}" title="${r.stage}: ${ns(r.cost)} ns for one node and one point. It answers ${percent(r.share)} of the points alone. ${reach}.">
          <span class="cost-name">${r.stage}</span>
          <span class="cost-track" aria-hidden="true"><i class="cost-bar" style="width:${logPlace(r.cost, low, high) * 100}%"></i></span>
          <span class="cost-value">${ns(r.cost)} ns</span>
          <span class="cost-verdict">answers ${percent(r.share)}, ${reach}</span>
        </li>`;
      })
      .join("");
  };

  chips.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    question = questions[Number(button.dataset["k"])]!;
    render();
  });
  factorInput.addEventListener("input", render);
  renderFamilies(report);
  render();
}
