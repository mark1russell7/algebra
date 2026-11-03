/**
 * The playground of the evaluators: an expression, its variables, and the result of each evaluator side by side.
 *
 * @packageDocumentation
 */
import type { Document } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import { NO_CLAIM } from "@mark1russell7/expression";
import { approx, decisions, evaluateAll, formatFloat, variables, widthOf } from "./evaluate.ts";
import type { Decision, Evaluation } from "./evaluate.ts";
import { readExpression } from "./syntax.ts";

/** An example of the playground: a text and the values of its variables. */
export interface Example {
  readonly label: string;
  readonly text: string;
  readonly values: Readonly<Record<string, string>>;
  readonly note: string;
}

/** The examples of the playground. The orientation uses a real input of the census. */
export const EXAMPLES: readonly Example[] = [
  {
    label: "(a + b) − a",
    text: "(a + b) - a",
    values: { a: "1e16", b: "1" },
    note: "The float sum a + b rounds to a, so the float value is 0. The exact value is 1, and the bound of A3 contains it.",
  },
  {
    label: "An orientation of the census",
    text: "(qx - px) * (ry - py) - (qy - py) * (rx - px)",
    values: { px: "129.4905948334925", py: "438.382847321023", qx: "97.32557977413207", qy: "374.54016591532275", rx: "90", ry: "360" },
    note: "The points are a real input of the board fixtures/small-clustered. The float value is 0, but the exact sign is +.",
  },
  {
    label: "A difference of squares",
    text: "(x + y) * (x - y) - (x * x - y * y)",
    values: { x: "100000001", y: "100000000" },
    note: "The exact value is 0. The float product x * x rounds, so the float value is not 0.",
  },
  {
    label: "A comparison",
    text: "(a + b) - a < 1",
    values: { a: "1e16", b: "1" },
    note: "The float comparison 0 < 1 is true, but the exact comparison 1 < 1 is false. The A4 interval and the A4 ball do not decide it, so they give no wrong answer.",
  },
  {
    label: "A square root",
    text: "root(x, 2) * root(x, 2) - x",
    values: { x: "2" },
    note: "The float, the interval and the ball evaluators know the kind root. The exact evaluator of the census does not, so the page cannot check the bounds.",
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

/** This function starts the playground on the page. */
export function startPlayground(): void {
  const text = byId<HTMLInputElement>("pg-text");
  const varsBox = byId("pg-vars");
  const values = new Map<string, string>();
  let note = "";
  let doc: Document | null = null;

  const presets = byId("pg-presets");
  presets.innerHTML = EXAMPLES.map((ex, k) => `<button type="button" data-k="${k}" aria-pressed="false">${esc(ex.label)}</button>`).join("");

  const use = (k: number): void => {
    const ex = EXAMPLES[k];
    if (!ex) return;
    text.value = ex.text;
    values.clear();
    for (const [name, v] of Object.entries(ex.values)) values.set(name, v);
    note = ex.note;
    presets.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["k"] === String(k))));
    read();
  };

  const read = (): void => {
    const r = readExpression(text.value);
    const err = byId("pg-error");
    if (!r.ok) {
      err.textContent = r.offset === null ? r.message : `${r.message} (at character ${r.offset + 1})`;
      text.setAttribute("aria-invalid", "true");
      return;
    }
    err.textContent = "";
    text.removeAttribute("aria-invalid");
    doc = r.doc;
    byId("pg-doc").textContent = JSON.stringify(doc, null, 1);
    const names = variables(doc);
    varsBox.innerHTML = names
      .map((name) => `<label class="field var"><span class="field-label"><code>${esc(name)}</code></span><input type="text" inputmode="decimal" spellcheck="false" data-var="${esc(name)}" value="${esc(values.get(name) ?? "1")}" /></label>`)
      .join("");
    compute();
  };

  const compute = (): void => {
    if (doc === null) return;
    const point: Record<string, number> = {};
    const bad: string[] = [];
    varsBox.querySelectorAll<HTMLInputElement>("input[data-var]").forEach((input) => {
      const name = input.dataset["var"] as string;
      values.set(name, input.value);
      const x = Number(input.value);
      if (input.value.trim() === "" || !Number.isFinite(x)) {
        bad.push(name);
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
        point[name] = x;
      }
    });
    const out = byId("pg-results");
    if (bad.length > 0) {
      out.innerHTML = `<p class="pg-error">Give a finite number for ${bad.map((b) => `<code>${esc(b)}</code>`).join(", ")}.</p>`;
      return;
    }
    out.innerHTML = renderResults(evaluateAll(doc, point), note);
  };

  presets.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (b) use(Number(b.dataset["k"]));
  });
  text.addEventListener("input", () => {
    note = "";
    presets.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    read();
  });
  varsBox.addEventListener("input", () => {
    note = "";
    compute();
  });
  use(0);
}

function renderResults(e: Evaluation, note: string): string {
  const card = (cls: string, title: string, sub: string, body: string, error: string): string =>
    `<article class="ev ${cls}"><header><h3>${title}</h3><p>${sub}</p></header><div class="ev-body">${body}</div><p class="ev-error">${error}</p></article>`;
  const fo = e.float.ok ? e.float.value : null;
  const float = !e.float.ok
    ? `<p class="ev-missing">${esc(e.float.reason)}</p>`
    : `<p class="ev-value"><code>${esc(formatFloat(e.float.value.value, 17))}</code></p><p class="small">${
        e.float.value.comparison
          ? "A comparison gives 1 for true and 0 for false."
          : `Error bound <code>± ${esc(e.float.value.error === Infinity ? "∞" : formatFloat(e.float.value.error, 4))}</code>, from a running forward bound.`
      }</p>`;
  const floatErr =
    fo === null
      ? ""
      : fo.comparison
        ? fo.error === 0
          ? "The bound decides the truth value."
          : "The bound does not decide the truth value."
        : fo.error === Infinity
          ? "The bound is infinite, so it makes no claim."
          : e.boundHolds === null || e.floatError === null
            ? "No exact value here, so the page cannot check the bound."
            : `The true error is <code>${Q.sign(e.floatError) === 0 ? "0" : esc(approx(e.floatError, 4))}</code>. ${e.boundHolds ? "The bound contains the exact value." : "The bound does not contain the exact value: a defect."}`;
  const iv = e.interval.ok ? e.interval.value : null;
  const ivBody = !e.interval.ok
    ? `<p class="ev-missing">${esc(e.interval.reason)}</p>`
    : iv === null
      ? `<p class="ev-value"><code>empty</code></p><p class="small">No point gives a real value.</p>`
      : `<p class="ev-value"><code>[${esc(formatFloat(iv[0], 17))},<wbr> ${esc(formatFloat(iv[1], 17))}]</code></p><p class="small">The bounds of the summary of A1, with outward rounding.</p>`;
  const ivErr = iv === null ? "" : `Width <code>${esc(formatFloat(iv[1] - iv[0], 4))}</code>. ${e.contained === null ? "" : e.contained ? "It contains the exact value." : "It does not contain the exact value: a defect."}`;
  const exact = e.exact.ok
    ? `<p class="ev-value"><code>${esc(Q.toString(e.exact.value).length > 60 ? `${Q.toString(e.exact.value).slice(0, 57)}…` : Q.toString(e.exact.value))}</code></p><p class="small">${Q.sign(e.exact.value) === 0 ? "Exactly 0." : `About <code>${esc(approx(e.exact.value, 8))}</code>.`} A rational over <code>bigint</code>.</p>`
    : `<p class="ev-missing">${esc(e.exact.reason)}</p>`;
  const exactErr = e.exact.ok ? "Error 0. The value is exact." : "";
  const comparisonNote = e.comparison ? `<p class="small">A comparison gives 1 for true and 0 for false.</p>` : "";
  const en = e.enclosure.ok ? e.enclosure.value : null;
  const enBody = !e.enclosure.ok
    ? `<p class="ev-missing">${esc(e.enclosure.reason)}</p>`
    : en === null
      ? `<p class="ev-value"><code>null</code></p><p class="small">A claim: no point of the inputs gives a real value.</p>`
      : en === NO_CLAIM
        ? `<p class="ev-value"><code>no claim</code></p><p class="small">The evaluator cannot tell. A divisor that holds 0 gives this result.</p>`
        : `<p class="ev-value"><code>[${esc(formatFloat(en[0], 17))},<wbr> ${esc(formatFloat(en[1], 17))}]</code></p>${comparisonNote || `<p class="small">Each operation rounds outward by one float step at most.</p>`}`;
  const enErr = en === null || en === NO_CLAIM ? "" : `Width <code>${esc(formatFloat(widthOf(en), 4))}</code>, rounded up.`;
  const ba = e.ball.ok ? e.ball.value : null;
  const baBody = !e.ball.ok
    ? `<p class="ev-missing">${esc(e.ball.reason)}</p>`
    : `<p class="ev-value"><code>${esc(formatFloat(e.ball.value.mid, 17))} ± ${esc(e.ball.value.rad === Infinity ? "∞" : formatFloat(e.ball.value.rad, 4))}</code></p>${comparisonNote || `<p class="small">The midpoint is the A3 float value. The radius rounds upward.</p>`}`;
  const baErr = ba === null ? "" : ba.rad === Infinity ? "The radius is infinite, so it makes no claim." : `Width <code>${esc(formatFloat(2 * ba.rad, 4))}</code>, two times the radius.`;
  const verdict =
    fo !== null && !fo.comparison && e.exact.ok
      ? Math.sign(fo.value) === Q.sign(e.exact.value)
        ? `<p class="pg-verdict">The float sign is right here.</p>`
        : `<p class="pg-verdict bad">The float sign is <strong>wrong</strong>: float ${Math.sign(fo.value) > 0 ? "+" : Math.sign(fo.value) < 0 ? "−" : "0"}, exact ${Q.sign(e.exact.value) > 0 ? "+" : Q.sign(e.exact.value) < 0 ? "−" : "0"}.</p>`
      : "";
  return `${note ? `<p class="pg-note">${esc(note)}</p>` : ""}${verdict}<div class="ev-row">
    ${card("float", "Float", "A3, <code>compileFloat</code>", float, floatErr)}
    ${card("enclosure", "Interval", "A4, <code>compileInterval</code>", enBody, enErr)}
    ${card("ball", "Ball", "A4, <code>compileBall</code>", baBody, baErr)}
    ${card("interval", "Summary bounds", "A1, <code>summarize</code>", ivBody, ivErr)}
    ${card("exact", "Exact", "the dyadic values of the census", exact, exactErr)}
  </div>${renderDecisions(e)}`;
}

const DECIDERS: readonly { readonly key: keyof ReturnType<typeof decisions>; readonly label: string }[] = [
  { key: "float", label: "A3 float" },
  { key: "enclosure", label: "A4 interval" },
  { key: "ball", label: "A4 ball" },
  { key: "interval", label: "A1 bounds" },
  { key: "exact", label: "Exact" },
];

function decisionChip(d: Decision | null): string {
  if (d === null) return `<span class="chip undecided">no result</span>`;
  if (d === "undecided" || d === "no value") return `<span class="chip undecided">${d}</span>`;
  if (typeof d === "boolean") return `<span class="chip ${d ? "pos" : "neg"}">${d}</span>`;
  return `<span class="chip ${d > 0 ? "pos" : d < 0 ? "neg" : "zero"}">${d > 0 ? "+" : d < 0 ? "−" : "0"}</span>`;
}

/** This function writes the row of the answers: the sign, or the truth value, that each evaluator proves. */
function renderDecisions(e: Evaluation): string {
  const d = decisions(e);
  const exact = d.exact;
  const wrong = (x: Decision | null): boolean => x !== null && exact !== null && x !== "undecided" && x !== "no value" && x !== exact;
  const n = DECIDERS.filter((k) => k.key !== "exact" && d[k.key] !== null && d[k.key] !== "undecided" && d[k.key] !== "no value").length;
  const cells = DECIDERS.map((k) => `<li${wrong(d[k.key]) ? ` class="bad"` : ""}><span>${k.label}</span>${decisionChip(d[k.key])}</li>`).join("");
  const what = e.comparison ? "the truth value" : "the sign";
  return `<div class="decide"><h3>Which evaluators prove ${what}</h3><ul>${cells}</ul><p class="small">${n} of 4 evaluators with an error bound prove ${what} here. An undecided evaluator sends the input to the exact evaluator.</p></div>`;
}
