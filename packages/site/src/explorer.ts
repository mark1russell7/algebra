/**
 * The explorer of the page: three canvases of one grid (float, interval and exact), the controls, the readout of a
 * cell and the scene of the input. A Web Worker fills the grid, so the main thread stays free.
 *
 * @packageDocumentation
 */
import { exactValue, floatValue } from "./census.ts";
import type { Point, PointVars, SignForm } from "./census.ts";
import * as Q from "@mark1russell7/rational";
import { approx, formatFloat } from "./evaluate.ts";
import { buildForm, cellDetail, decode, dyadicToRational, exactLine, fillRows, tally, ulp } from "./grid.ts";
import type { CellDetail, CellSegment, GridJob, View } from "./grid.ts";
import type { Preset, Scene, SignChoice } from "./presets.ts";
import type { BandMessage, JobMessage } from "./grid.worker.ts";

type PanelName = "float" | "interval" | "exact";
const PANELS: readonly PanelName[] = ["float", "interval", "exact"];

/** The colors of the grid, read from the CSS tokens of the page. */
interface Palette {
  readonly pos: [number, number, number];
  readonly neg: [number, number, number];
  readonly zero: [number, number, number];
  readonly wrong: [number, number, number];
  readonly undecided: [number, number, number];
  readonly hatch: string;
  readonly pending: [number, number, number];
  readonly line: string;
  readonly cursor: string;
}

function rgb(text: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(text.trim());
  if (m === null) return [128, 128, 128];
  const v = Number.parseInt(m[1] as string, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function readPalette(root: HTMLElement): Palette {
  const css = getComputedStyle(root);
  const token = (name: string): string => css.getPropertyValue(name).trim();
  return {
    pos: rgb(token("--grid-pos")),
    neg: rgb(token("--grid-neg")),
    zero: rgb(token("--grid-zero")),
    wrong: rgb(token("--grid-wrong")),
    undecided: rgb(token("--grid-undecided")),
    hatch: token("--grid-hatch"),
    pending: rgb(token("--grid-pending")),
    line: token("--grid-line"),
    cursor: token("--grid-cursor"),
  };
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no element #${id}.`);
  return element as T;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const signText = (s: -1 | 0 | 1 | null): string => (s === null ? "no sign" : s > 0 ? "+" : s < 0 ? "−" : "0");
const signClass = (s: -1 | 0 | 1 | null): string => (s === null ? "undecided" : s > 0 ? "pos" : s < 0 ? "neg" : "zero");
const full = (x: number): string => (Number.isInteger(x) ? String(x) : x.toPrecision(17));
const MAX_STEP = 2 ** 40;

/** The old image of a panel, kept on screen while the worker fills the new grid. */
interface Ghost {
  readonly images: Record<PanelName, HTMLCanvasElement>;
  readonly view: View;
}

/** The state and the elements of the explorer. */
export class Explorer {
  private presets: readonly Preset[] = [];
  private preset!: Preset;
  private sign!: SignChoice;
  private move!: PointVars;
  private view!: View;
  private form!: SignForm;
  private codes = new Uint8Array(0);
  private rows = 0;
  private jobId = 0;
  private ms = 0;
  private ghost: Ghost | null = null;
  private cursor: [number, number] | null = null;
  private pinned = false;
  private line: CellSegment | null = null;
  private drag: { x: number; y: number; dx: number; dy: number; id: number; moved: boolean } | null = null;
  private readonly worker: Worker | null;
  private readonly canvases: Record<PanelName, HTMLCanvasElement>;
  private readonly images: Record<PanelName, ImageData | null> = { float: null, interval: null, exact: null };
  private palette: Palette;
  private frame = 0;

  constructor(private readonly root: HTMLElement) {
    this.canvases = Object.fromEntries(
      PANELS.map((name) => [name, root.querySelector<HTMLCanvasElement>(`[data-panel="${name}"] canvas`) as HTMLCanvasElement]),
    ) as Record<PanelName, HTMLCanvasElement>;
    this.palette = readPalette(document.documentElement);
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./grid.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<BandMessage>) => this.onBand(event.data);
    } catch {
      worker = null;
    }
    this.worker = worker;
    // A phone gets the smaller grid, so the first picture comes fast.
    if (window.matchMedia("(max-width: 720px)").matches) byId<HTMLSelectElement>("ex-size").value = "128";
    this.wire();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      this.palette = readPalette(document.documentElement);
      this.repaintAll();
    });
  }

  /** This method sets the list of presets and loads the first one. */
  setPresets(presets: readonly Preset[], groups: ReadonlyMap<string, string>): void {
    this.presets = presets;
    const select = byId<HTMLSelectElement>("ex-preset");
    const byGroup = new Map<string, Preset[]>();
    for (const p of presets) {
      const g = groups.get(p.id) ?? "Inputs";
      byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
    }
    select.innerHTML = [...byGroup.entries()]
      .map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</optgroup>`)
      .join("");
    const first = presets[0];
    if (first) this.load(first.id);
  }

  /** This method loads a preset by its id. */
  load(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.preset = preset;
    byId<HTMLSelectElement>("ex-preset").value = id;
    const signSelect = byId<HTMLSelectElement>("ex-sign");
    signSelect.innerHTML = preset.signs.map((s, k) => `<option value="${k}">${esc(s.label)}</option>`).join("");
    signSelect.disabled = preset.signs.length < 2;
    this.pickSign(0);
    this.renderNote();
    this.renderScene();
  }

  private pickSign(k: number): void {
    const sign = this.preset.signs[k] ?? this.preset.signs[0];
    if (!sign) return;
    this.sign = sign;
    this.form = buildForm(sign.form);
    this.move = sign.move;
    this.renderMove();
    this.view = { ...this.preset.view, n: Number(byId<HTMLSelectElement>("ex-size").value) || this.preset.view.n };
    if (this.preset.view.ox !== 0) this.view = { ...this.view, ox: this.view.n / 2, oy: this.view.n / 2 };
    this.pinned = false;
    this.cursor = this.center();
    this.start(false);
    this.renderReadout();
  }

  /** This method gives the cell of the real input: offset 0, 0. */
  private center(): [number, number] {
    const half = Math.floor(this.view.n / 2);
    return [half, half - 1];
  }

  private renderMove(): void {
    const box = byId("ex-move");
    box.innerHTML = this.sign.movable
      .map((m) => {
        const on = m.vars[0] === this.move[0];
        return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-x="${esc(m.vars[0])}" data-y="${esc(m.vars[1])}">${esc(m.label)}</button>`;
      })
      .join("");
  }

  private job(): GridJob {
    return { vars: this.preset.vars, form: this.sign.form, move: this.move, view: this.view };
  }

  /** This method starts a new grid. With `keep`, the old image stays under the new rows. */
  private start(keep: boolean): void {
    const n = this.view.n;
    if (keep && this.ghost === null && this.images.float !== null && this.images.float.width === n) {
      const copies = {} as Record<PanelName, HTMLCanvasElement>;
      for (const name of PANELS) {
        const c = document.createElement("canvas");
        c.width = n;
        c.height = n;
        (c.getContext("2d") as CanvasRenderingContext2D).putImageData(this.images[name] as ImageData, 0, 0);
        copies[name] = c;
      }
      this.ghost = { images: copies, view: this.lastView ?? this.view };
    } else if (!keep) {
      this.ghost = null;
    }
    this.lastView = this.view;
    this.codes = new Uint8Array(n * n);
    this.rows = 0;
    for (const name of PANELS) {
      this.images[name] = new ImageData(n, n);
      const canvas = this.canvases[name];
      if (canvas.width !== n * 2) {
        canvas.width = n * 2;
        canvas.height = n * 2;
      }
    }
    this.fillPending();
    this.line = exactLine(this.job(), this.form);
    byId("ex-step").textContent = `${this.view.step === 1 ? "1 ulp" : `2^${Math.log2(this.view.step)} ulps`}`;
    (byId("ex-zoom-in") as HTMLButtonElement).disabled = this.view.step <= 1;
    (byId("ex-zoom-out") as HTMLButtonElement).disabled = this.view.step >= MAX_STEP;
    this.jobId++;
    const message: JobMessage = { id: this.jobId, job: this.job() };
    if (this.worker) this.worker.postMessage(message);
    else void this.runHere(message);
    this.renderTiles();
    this.schedule();
  }

  private lastView: View | null = null;

  /** This method fills the grid on the main thread in small bands, when the page has no worker. */
  private async runHere({ id, job }: JobMessage): Promise<void> {
    const form = buildForm(job.form);
    const n = job.view.n;
    const t = performance.now();
    for (let j0 = 0; j0 < n; j0 += 4) {
      if (id !== this.jobId) return;
      const j1 = Math.min(n, j0 + 4);
      const codes = new Uint8Array(n * (j1 - j0));
      fillRows(job, form, j0, j1, codes);
      this.onBand({ id, j0, j1, codes, ms: performance.now() - t });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  private fillPending(): void {
    const [r, g, b] = this.palette.pending;
    for (const name of PANELS) {
      const data = (this.images[name] as ImageData).data;
      for (let k = 0; k < data.length; k += 4) {
        data[k] = r;
        data[k + 1] = g;
        data[k + 2] = b;
        data[k + 3] = this.ghost ? 0 : 255;
      }
    }
  }

  private onBand(message: BandMessage): void {
    if (message.id !== this.jobId) return;
    if ("error" in message) {
      byId("ex-tiles").innerHTML = `<p class="pg-error">The grid failed: ${esc(message.error)}</p>`;
      return;
    }
    const n = this.view.n;
    this.codes.set(message.codes, message.j0 * n);
    this.paintRows(message.j0, message.j1);
    this.rows = Math.max(this.rows, message.j1);
    this.ms = message.ms;
    if (this.rows >= n) {
      this.ghost = null;
      this.renderTiles();
      this.renderReadout();
    } else if (message.j0 % 64 === 0) {
      this.renderTiles();
    }
    this.schedule();
  }

  private paintRows(j0: number, j1: number): void {
    const n = this.view.n;
    const p = this.palette;
    const color = (s: -1 | 0 | 1 | null): [number, number, number] => (s === null ? p.undecided : s > 0 ? p.pos : s < 0 ? p.neg : p.zero);
    const put = (data: Uint8ClampedArray, k: number, c: readonly number[]): void => {
      data[k] = c[0] as number;
      data[k + 1] = c[1] as number;
      data[k + 2] = c[2] as number;
      data[k + 3] = 255;
    };
    const f = (this.images.float as ImageData).data;
    const iv = (this.images.interval as ImageData).data;
    const ex = (this.images.exact as ImageData).data;
    for (let k = j0 * n; k < j1 * n; k++) {
      const s = decode(this.codes[k] as number);
      put(f, k * 4, s.float !== s.exact ? p.wrong : color(s.float));
      put(iv, k * 4, color(s.bound));
      put(ex, k * 4, color(s.exact));
    }
  }

  private repaintAll(): void {
    this.fillPending();
    this.paintRows(0, this.rows);
    this.schedule();
  }

  private schedule(): void {
    if (this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  /** This function maps a cell coordinate of an old view to the new view. */
  private mapX(c: number, from: View, to: View): number {
    const half = Math.floor(to.n / 2);
    return (from.ox - to.ox) / to.step + (c - 0.5 - half) * (from.step / to.step) + half + 0.5;
  }

  private mapY(r: number, from: View, to: View): number {
    const half = Math.floor(to.n / 2);
    return half - 0.5 - (from.oy - to.oy) / to.step - (half - 0.5 - r) * (from.step / to.step);
  }

  private draw(): void {
    const n = this.view.n;
    const scale = 2;
    const shift = this.drag ? [this.drag.dx, this.drag.dy] : [0, 0];
    for (const name of PANELS) {
      const canvas = this.canvases[name];
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgb(${this.palette.pending.join(",")})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, (shift[0] as number) * scale, (shift[1] as number) * scale);
      if (this.ghost) {
        const g = this.ghost.view;
        const x0 = this.mapX(0, g, this.view);
        const x1 = this.mapX(n, g, this.view);
        const y0 = this.mapY(0, g, this.view);
        const y1 = this.mapY(n, g, this.view);
        ctx.drawImage(this.ghost.images[name], x0, y0, x1 - x0, y1 - y0);
      }
      const image = this.images[name] as ImageData;
      const tmp = this.tmpCanvas(n);
      (tmp.getContext("2d") as CanvasRenderingContext2D).putImageData(image, 0, 0);
      if (this.ghost) ctx.drawImage(tmp, 0, 0, n, this.rows, 0, 0, n, this.rows);
      else ctx.drawImage(tmp, 0, 0);
      if (name === "interval") this.drawHatch(ctx, n);
      if (this.line) {
        ctx.strokeStyle = this.palette.line;
        ctx.lineWidth = 1.25 / scale;
        ctx.setLineDash([3 / scale, 2 / scale]);
        ctx.beginPath();
        ctx.moveTo(this.line.x0, this.line.y0);
        ctx.lineTo(this.line.x1, this.line.y1);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.cursor) {
        const [i, j] = this.cursor;
        ctx.strokeStyle = this.palette.cursor;
        ctx.lineWidth = 1 / scale;
        ctx.strokeRect(i - 1.5, j - 1.5, 4, 4);
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(i + 0.5, 0);
        ctx.lineTo(i + 0.5, j - 1.5);
        ctx.moveTo(i + 0.5, j + 2.5);
        ctx.lineTo(i + 0.5, n);
        ctx.moveTo(0, j + 0.5);
        ctx.lineTo(i - 1.5, j + 0.5);
        ctx.moveTo(i + 2.5, j + 0.5);
        ctx.lineTo(n, j + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  private tmp: HTMLCanvasElement | null = null;
  private tmpCanvas(n: number): HTMLCanvasElement {
    if (this.tmp === null || this.tmp.width !== n) {
      this.tmp = document.createElement("canvas");
      this.tmp.width = n;
      this.tmp.height = n;
    }
    return this.tmp;
  }

  private hatch: { mask: HTMLCanvasElement; pattern: string } | null = null;

  /** This method draws diagonal lines over each cell whose sign the interval does not fix. */
  private drawHatch(ctx: CanvasRenderingContext2D, n: number): void {
    const size = n * 2;
    if (this.hatch === null || this.hatch.mask.width !== size || this.hatch.pattern !== this.palette.hatch) {
      const mask = document.createElement("canvas");
      mask.width = size;
      mask.height = size;
      this.hatch = { mask, pattern: this.palette.hatch };
    }
    const mask = this.hatch.mask;
    const m = mask.getContext("2d") as CanvasRenderingContext2D;
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, size, size);
    m.fillStyle = "#000";
    for (let j = 0; j < this.rows; j++) {
      let run = -1;
      for (let i = 0; i <= n; i++) {
        const undecided = i < n && decode(this.codes[j * n + i] as number).bound === null;
        if (undecided && run < 0) run = i;
        if (!undecided && run >= 0) {
          m.fillRect(run * 2, j * 2, (i - run) * 2, 2);
          run = -1;
        }
      }
    }
    m.globalCompositeOperation = "source-in";
    m.strokeStyle = this.palette.hatch;
    m.lineWidth = 1;
    m.beginPath();
    for (let d = -size; d < size; d += 4) {
      m.moveTo(d, size);
      m.lineTo(d + size, 0);
    }
    m.stroke();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, this.drag ? this.drag.dx * 2 : 0, this.drag ? this.drag.dy * 2 : 0);
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  }

  private renderTiles(): void {
    const done = this.rows >= this.view.n;
    const part = this.codes.subarray(0, this.rows * this.view.n);
    const c = tally(part);
    const pct = (x: number): string => (c.cells === 0 ? "" : `${((100 * x) / c.cells).toFixed(x > 0 && x < c.cells / 1000 ? 2 : 1)}%`);
    const fmt = (x: number): string => x.toLocaleString("en-US").replace(/,/g, " ");
    const tile = (cls: string, value: string, cap: string, sub = ""): string =>
      `<div class="tile ${cls}"><span class="num">${value}</span><span class="cap">${cap}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</div>`;
    byId("ex-tiles").innerHTML = [
      tile("", fmt(c.cells), done ? "cells tested" : `cells tested so far`, done ? `in ${Math.round(this.ms)} ms, in a worker` : "the worker fills the rows"),
      tile("bad", fmt(c.floatWrong), "float signs that are wrong", pct(c.floatWrong)),
      tile("warn", fmt(c.undecided), "cells where the interval fixes no sign", pct(c.undecided)),
      tile(c.wrongButDecided === 0 ? "good" : "bad", fmt(c.wrongButDecided), "wrong float signs that the interval fixed", c.wrongButDecided === 0 ? "0: the interval flags each wrong cell" : "a defect of the interval"),
    ].join("");
  }

  private detail(): CellDetail | null {
    if (!this.cursor) return null;
    const [i, j] = this.cursor;
    return cellDetail(this.job(), this.form, i, j);
  }

  private renderReadout(): void {
    const box = byId("ex-readout");
    const d = this.detail();
    if (d === null) {
      box.innerHTML = `<h3>A cell</h3><p class="small">Point at a cell, or click it, to see its numbers. With the keyboard, focus a grid and use the arrow keys.</p>`;
      return;
    }
    const [xName, yName] = this.move;
    const label = this.sign.movable.find((m) => m.vars[0] === xName)?.label ?? "the point";
    const wrong = d.float !== d.exact;
    const verdict = wrong
      ? `The float sign is <strong>wrong</strong>. ${d.bound === null ? "The interval fixes no sign here, so it does not give a wrong answer." : "The interval fixes a sign here: a defect."}`
      : d.bound === null
        ? "The float sign is right here, but the interval cannot prove it. A filter sends this cell to the exact evaluator."
        : "The float sign is right, and the interval proves it. A filter stops here.";
    const off = (k: number): string => (k > 0 ? `+${k}` : `${k}`);
    box.innerHTML = `
      <h3>Cell ${off(d.offset[0])}, ${off(d.offset[1])} ulps from ${esc(label)}${this.pinned ? ` <span class="pin">kept</span>` : ""}</h3>
      <p class="coords"><code>${esc(label)} = (${full(d.point[xName] as number)}, ${full(d.point[yName] as number)})</code></p>
      <dl class="values">
        <div><dt>Float value</dt><dd><code>${formatFloat(d.floatValue, 17)}</code></dd><dd><span class="chip ${signClass(d.float)}">${signText(d.float)}</span></dd></div>
        <div><dt>A1 interval</dt><dd><code>${d.bounds === null ? "empty" : `[${formatFloat(d.bounds[0], 4)}, ${formatFloat(d.bounds[1], 4)}]`}</code></dd><dd><span class="chip ${signClass(d.bound)}">${signText(d.bound)}</span></dd></div>
        <div><dt>Exact value</dt><dd><code>${Q.sign(d.exactValue) === 0 ? "0" : `≈ ${approx(d.exactValue, 6)}`}</code></dd><dd><span class="chip ${signClass(d.exact)}">${signText(d.exact)}</span></dd></div>
      </dl>
      <p class="verdict ${wrong ? "bad" : ""}">${verdict}</p>`;
  }

  private renderNote(): void {
    const p = this.preset;
    const r = p.record;
    const note = byId("ex-note");
    if (!r) {
      note.innerHTML = `${esc(p.summary)} This picture is in Kettner, Mehlhorn, Pion, Schirra and Yap, <em>Classroom examples of robustness problems in geometric computations</em> (2008).`;
      return;
    }
    const answer = (x: boolean | number): string => (typeof x === "boolean" ? (x ? "true" : "false") : signText(x as -1 | 0 | 1));
    note.innerHTML = `A real input of the census: board <code>${esc(r.case)}</code>, call site <code>${esc(r.fn)}</code> at <code>${esc(r.via)}</code>. The float answer is <code>${answer(r.floatAnswer)}</code>, and the exact answer is <code>${answer(r.exactAnswer)}</code>. The grid starts at the real input, in its center.`;
  }

  /** This method draws the input at its own scale, and writes how near the moved point is to the zero line. */
  private renderScene(): void {
    const svg = byId("ex-scene") as unknown as SVGSVGElement;
    const scene: Scene = this.preset.scene;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [a, b] of scene.segments) xs.push(a[0], b[0]), ys.push(a[1], b[1]);
    for (const b of scene.boxes) xs.push(b.x, b.x + b.w), ys.push(b.y, b.y + b.h);
    for (const p of scene.points) xs.push(p.at[0]), ys.push(p.at[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const span = Math.max(maxX - minX, maxY - minY, 1e-9);
    const W = 320;
    const pad = 28;
    const k = (W - 2 * pad) / span;
    const H = Math.max(140, Math.min(W, (maxY - minY) * k + 2 * pad));
    const X = (x: number): number => pad + (x - minX) * k + ((W - 2 * pad) - (maxX - minX) * k) / 2;
    // The boards of highways have y down, as on a screen. The classroom input has y up.
    const yDown = this.preset.record !== undefined;
    const Y = (y: number): number => (yDown ? pad + (y - minY) * k : H - pad - (y - minY) * k);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const moving = this.move[0].replace(/x$/, "");
    const parts: string[] = [];
    for (const b of scene.boxes) {
      const y0 = Math.min(Y(b.y), Y(b.y + b.h));
      const [w, h] = [b.w * k, b.h * k];
      parts.push(`<rect class="sc-box" x="${X(b.x)}" y="${y0}" width="${w}" height="${h}" />`);
      // A small box gets a ring and a label, so the reader finds it.
      if (Math.min(w, h) < 12) {
        const [cx, cy] = [X(b.x) + w / 2, y0 + h / 2];
        parts.push(`<circle class="sc-ring" cx="${cx}" cy="${cy}" r="${Math.max(w, h) / 2 + 8}" />`);
        parts.push(`<text class="sc-label" x="${cx + Math.max(w, h) / 2 + 12}" y="${cy + 4}">box</text>`);
      }
    }
    const pts = this.form.points;
    if (pts) {
      const at = pts.findIndex((q) => q[0] === this.move[0]);
      const a = pts[(at + 1) % 3] as PointVars;
      const b = pts[(at + 2) % 3] as PointVars;
      const v = this.preset.vars;
      const [ax, ay, bx, by] = [v[a[0]], v[a[1]], v[b[0]], v[b[1]]] as number[];
      const len = Math.hypot((bx as number) - (ax as number), (by as number) - (ay as number)) || 1;
      const ext = (2 * span) / len;
      const ux = ((bx as number) - (ax as number)) * ext;
      const uy = ((by as number) - (ay as number)) * ext;
      parts.push(`<line class="sc-ext" x1="${X((ax as number) - ux)}" y1="${Y((ay as number) - uy)}" x2="${X((bx as number) + ux)}" y2="${Y((by as number) + uy)}" />`);
    }
    scene.segments.forEach(([a, b], idx) => {
      parts.push(`<line class="sc-seg s${idx}" x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" />`);
    });
    for (const p of scene.points) {
      const on = p.name === moving;
      parts.push(`<circle class="sc-pt${on ? " on" : ""}" cx="${X(p.at[0])}" cy="${Y(p.at[1])}" r="${on ? 5 : 3}" />`);
      parts.push(`<text class="sc-label" x="${X(p.at[0]) + 7}" y="${Y(p.at[1]) - 6}">${esc(p.name)}</text>`);
    }
    svg.innerHTML = parts.join("");
    this.renderSceneNote();
  }

  private renderSceneNote(): void {
    const note = byId("ex-scene-note");
    const vars: Point = this.preset.vars;
    const x = vars[this.move[0]] as number;
    const value = dyadicToRational(exactValue(this.form.doc, vars));
    const fv = floatValue(this.form.doc, vars);
    const pts = this.form.points;
    const moving = this.sign.movable.find((m) => m.vars[0] === this.move[0])?.label ?? "the point";
    if (pts) {
      const at = pts.findIndex((p) => p[0] === this.move[0]);
      const others = [pts[(at + 1) % 3], pts[(at + 2) % 3]].map((p) => (p as PointVars)[0].replace(/x$/, ""));
      const [a, b] = [pts[(at + 1) % 3] as PointVars, pts[(at + 2) % 3] as PointVars];
      const length = Math.hypot((vars[b[0]] as number) - (vars[a[0]] as number), (vars[b[1]] as number) - (vars[a[1]] as number));
      const distance = Math.abs(Q.toNumber(value)) / length;
      note.innerHTML = `At this scale, <strong>${esc(moving)}</strong> is on the line through ${others.map(esc).join(" and ")}. Its exact distance from that line is ${distance === 0 ? "0" : `about <code>${formatFloat(distance, 3)}</code>`}. One ulp of its x is <code>${formatFloat(ulp(x), 3)}</code>. The float value of the sign is <code>${formatFloat(fv, 6)}</code>, and the exact value is <code>${Q.sign(value) === 0 ? "0" : approx(value, 4)}</code>.`;
      return;
    }
    note.innerHTML = `The sign <code>${esc(this.sign.label)}</code> compares where the segment meets two sides of the box. It is near 0 when the line of the segment goes near a corner. The float value is <code>${formatFloat(fv, 6)}</code>, and the exact value is <code>${Q.sign(value) === 0 ? "0" : approx(value, 4)}</code>.`;
  }

  private setStep(step: number, anchor: [number, number] | null): void {
    const s = Math.min(MAX_STEP, Math.max(1, step));
    if (s === this.view.step) return;
    const v = this.view;
    const half = Math.floor(v.n / 2);
    const [ci, cj] = anchor ?? [half, half - 1];
    // The offset of the anchor cell stays at the anchor cell.
    const kx = v.ox + (ci - half) * v.step;
    const ky = v.oy + (half - 1 - cj) * v.step;
    this.view = { ...v, step: s, ox: kx - (ci - half) * s, oy: ky - (half - 1 - cj) * s };
    this.start(true);
  }

  private pan(di: number, dj: number): void {
    if (di === 0 && dj === 0) return;
    this.view = { ...this.view, ox: this.view.ox + di * this.view.step, oy: this.view.oy - dj * this.view.step };
    this.start(true);
  }

  private cellAt(canvas: HTMLCanvasElement, event: PointerEvent | WheelEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const n = this.view.n;
    const i = Math.floor(((event.clientX - rect.left) / rect.width) * n);
    const j = Math.floor(((event.clientY - rect.top) / rect.height) * n);
    return [Math.min(n - 1, Math.max(0, i)), Math.min(n - 1, Math.max(0, j))];
  }

  private setCursor(cell: [number, number] | null): void {
    this.cursor = cell;
    this.renderReadout();
    this.schedule();
  }

  private wire(): void {
    byId<HTMLSelectElement>("ex-preset").addEventListener("change", (e) => this.load((e.target as HTMLSelectElement).value));
    byId<HTMLSelectElement>("ex-sign").addEventListener("change", (e) => {
      this.pickSign(Number((e.target as HTMLSelectElement).value));
      this.renderScene();
    });
    byId<HTMLSelectElement>("ex-size").addEventListener("change", (e) => {
      const n = Number((e.target as HTMLSelectElement).value);
      this.view = { ...this.view, n };
      this.pinned = false;
      this.cursor = this.center();
      this.start(false);
      this.renderReadout();
    });
    const move = byId("ex-move");
    const pickMove = (button: HTMLElement): void => {
      const x = button.dataset["x"];
      const y = button.dataset["y"];
      if (!x || !y || x === this.move[0]) return;
      this.move = [x, y];
      this.view = { ...this.view, ox: 0, oy: 0 };
      this.renderMove();
      (move.querySelector<HTMLElement>('[aria-checked="true"]') as HTMLElement | null)?.focus();
      this.pinned = false;
      this.cursor = this.center();
      this.start(false);
      this.renderReadout();
      this.renderScene();
    };
    move.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("button");
      if (b) pickMove(b);
    });
    move.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const buttons = [...move.querySelectorAll<HTMLElement>("button")];
      const at = buttons.findIndex((b) => b.getAttribute("aria-checked") === "true");
      const next = buttons[(at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? buttons.length - 1 : 1)) % buttons.length];
      if (next) pickMove(next);
      e.preventDefault();
    });
    byId("ex-zoom-in").addEventListener("click", () => this.setStep(this.view.step / 2, null));
    byId("ex-zoom-out").addEventListener("click", () => this.setStep(this.view.step * 2, null));
    byId("ex-reset").addEventListener("click", () => {
      this.view = { ...this.preset.view, n: this.view.n };
      if (this.preset.view.ox !== 0) this.view = { ...this.view, ox: this.view.n / 2, oy: this.view.n / 2 };
      this.start(false);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-pan]").forEach((b) =>
      b.addEventListener("click", () => {
        const d = Math.max(8, Math.floor(this.view.n / 8));
        const dir = b.dataset["pan"];
        this.pan(dir === "left" ? -d : dir === "right" ? d : 0, dir === "up" ? -d : dir === "down" ? d : 0);
      }),
    );
    for (const name of PANELS) {
      const canvas = this.canvases[name];
      canvas.addEventListener("pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        this.drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, id: e.pointerId, moved: false };
      });
      canvas.addEventListener("pointermove", (e) => {
        if (this.drag && this.drag.id === e.pointerId) {
          const rect = canvas.getBoundingClientRect();
          const per = rect.width / this.view.n;
          const dx = (e.clientX - this.drag.x) / per;
          const dy = (e.clientY - this.drag.y) / per;
          if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
          if (this.drag.moved) {
            this.drag.dx = dx;
            this.drag.dy = dy;
            this.schedule();
          }
          return;
        }
        if (!this.pinned && e.pointerType === "mouse") this.setCursor(this.cellAt(canvas, e));
      });
      const end = (e: PointerEvent): void => {
        const d = this.drag;
        if (!d || d.id !== e.pointerId) return;
        this.drag = null;
        if (d.moved) {
          this.pan(-Math.round(d.dx), -Math.round(d.dy));
          this.schedule();
          return;
        }
        if (e.type === "pointercancel") return;
        const cell = this.cellAt(canvas, e);
        const same = this.cursor !== null && this.cursor[0] === cell[0] && this.cursor[1] === cell[1];
        this.pinned = !(same && this.pinned);
        this.setCursor(cell);
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this.setStep(e.deltaY > 0 ? this.view.step * 2 : this.view.step / 2, this.cellAt(canvas, e));
        },
        { passive: false },
      );
      canvas.addEventListener("keydown", (e) => this.onKey(e));
      canvas.addEventListener("focus", () => {
        if (!this.cursor) {
          const half = Math.floor(this.view.n / 2);
          this.setCursor([half, half]);
        }
      });
    }
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.view.n;
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (d) {
      e.preventDefault();
      if (e.shiftKey) {
        this.pan(d[0] * 16, d[1] * 16);
        return;
      }
      const [i, j] = this.cursor ?? [Math.floor(n / 2), Math.floor(n / 2)];
      this.pinned = true;
      this.setCursor([Math.min(n - 1, Math.max(0, i + d[0])), Math.min(n - 1, Math.max(0, j + d[1]))]);
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      this.setStep(this.view.step / 2, this.cursor);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      this.setStep(this.view.step * 2, this.cursor);
    } else if (e.key === "Escape") {
      this.pinned = false;
      this.setCursor(this.center());
    }
  }
}
