/**
 * The playground of the evaluators: an expression, its variables, and the result of each evaluator side by side.
 *
 * @packageDocumentation
 */
import type { Document } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import { approx, evaluateAll, formatFloat, variables } from "./evaluate.ts";
import type { Evaluation } from "./evaluate.ts";
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
    label: "A square root",
    text: "root(x, 2) * root(x, 2) - x",
    values: { x: "2" },
    note: "The float evaluator and the interval know the kind root. The exact evaluator of the census does not, so the page cannot check the bound.",
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
  const verdict =
    fo !== null && !fo.comparison && e.exact.ok
      ? Math.sign(fo.value) === Q.sign(e.exact.value)
        ? `<p class="pg-verdict">The float sign is right here.</p>`
        : `<p class="pg-verdict bad">The float sign is <strong>wrong</strong>: float ${Math.sign(fo.value) > 0 ? "+" : Math.sign(fo.value) < 0 ? "−" : "0"}, exact ${Q.sign(e.exact.value) > 0 ? "+" : Q.sign(e.exact.value) < 0 ? "−" : "0"}.</p>`
      : "";
  return `${note ? `<p class="pg-note">${esc(note)}</p>` : ""}${verdict}<div class="ev-row">
    ${card("float", "Float", "A3, <code>compileFloat</code> of <code>expression</code>", float, floatErr)}
    ${card("interval", "Interval", "<code>@mark1russell7/expression</code>", ivBody, ivErr)}
    ${card("exact", "Exact", "the dyadic values of the census", exact, exactErr)}
  </div>`;
}
