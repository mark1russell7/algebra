import { compileExact, compileFloat, compileInterval, compileStatic, NO_CLAIM } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import { deriveSeed, random } from "@mark1russell7/rigor-generators";
import { median } from "@mark1russell7/rigor-statistics";
import { describe, expect, it } from "vitest";
import { corpus, type CorpusCase, FAMILIES, type Family } from "./index.ts";

type Box = readonly (readonly [number, number])[];

function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

/** This function gives the smallest box of the points of a case. */
const hull = (c: CorpusCase): Box => c.variables.map((_, i) => [Math.min(...c.points.map((p) => p[i] as number)), Math.max(...c.points.map((p) => p[i] as number))]);

/** This function gives a box of relative radius `2^-20` around the first point of a case. */
const narrow = (c: CorpusCase): Box =>
  (c.points[0] as readonly number[]).map((v) => {
    const r = (Math.abs(v) || 1) * 2 ** -20;
    return [v - r, v + r];
  });

/** This function gives the two extreme corners and 96 seeded points of a box. */
function pointsOf(box: Box, seed: number): number[][] {
  const rnd = random(seed);
  const inner = (): number[] => box.map(([low, high]) => Math.min(high, Math.max(low, rnd.range(low, high))));
  return [box.map((b) => b[0]), box.map((b) => b[1]), ...Array.from({ length: 96 }, inner)];
}

const all = corpus();

/** The count of the points and the ratios of one family and one kind of box. */
interface Tally {
  points: number;
  exact: number;
  noExact: number;
  finite: number;
  noClaim: number;
  cases: number;
  /** The static bound over the largest running bound of the points of the box, for each case. */
  worst: number[];
  /** The static bound over the running bound at each point. */
  each: number[];
  /** The width of the enclosure over the range of the float values at the points of the box, for each case. */
  widths: number[];
}

const tally = (): Tally => ({ points: 0, exact: 0, noExact: 0, finite: 0, noClaim: 0, cases: 0, worst: [], each: [], widths: [] });

/** This function examines one box of one case, and adds its counts to the tally. */
function examine(c: CorpusCase, box: Box, points: readonly (readonly number[])[], t: Tally): void {
  const s = made(compileStatic(c.document)).evaluate(box);
  const float = made(compileFloat(c.document));
  const exact = made(compileExact(c.document));
  const interval = made(compileInterval(c.document));
  const label = (point: readonly number[]): string => `${c.name} ${JSON.stringify({ box, point, s })}`;
  t.cases++;
  if (s.enclosure === NO_CLAIM) t.noClaim++;
  if (s.enclosure === NO_CLAIM) return;
  let largest = 0;
  let lowest = Infinity;
  let highest = -Infinity;
  for (const point of points) {
    t.points++;
    const got = float.evaluate(point);
    const want = exact.evaluate(point);
    if (s.enclosure === null) {
      expect(want === null || want === NO_CLAIM, label(point)).toBe(true);
      continue;
    }
    expect(want, label(point)).not.toBeNull();
    if (s.error < Infinity) {
      expect(Number.isFinite(got.value), label(point)).toBe(true);
      largest = Math.max(largest, got.error);
      lowest = Math.min(lowest, got.value);
      highest = Math.max(highest, got.value);
      if (got.error > 0 && got.error < Infinity) t.each.push(s.error / got.error);
    }
    if (want === null) continue;
    if (want === NO_CLAIM) {
      // No rational exists at this point, so the interval of one point stands for the exact value.
      t.noExact++;
      const near = interval.evaluate(point);
      if (near === null || near === NO_CLAIM) continue;
      expect(near[1] >= s.enclosure[0] && near[0] <= s.enclosure[1], label(point)).toBe(true);
      if (s.error < Infinity) expect(Math.max(near[0] - got.value, got.value - near[1], 0) <= s.error, label(point)).toBe(true);
      continue;
    }
    t.exact++;
    const low = s.enclosure[0] === -Infinity || Q.compare(Q.fromFloat(s.enclosure[0]), want) <= 0;
    const high = s.enclosure[1] === Infinity || Q.compare(want, Q.fromFloat(s.enclosure[1])) <= 0;
    expect(low && high, label(point)).toBe(true);
    if (!(s.error < Infinity)) continue;
    t.finite++;
    expect(Q.compare(Q.abs(Q.sub(Q.fromFloat(got.value), want)), Q.fromFloat(s.error)) <= 0, label(point)).toBe(true);
  }
  if (s.error < Infinity && largest > 0 && largest < Infinity) t.worst.push(s.error / largest);
  if (s.error < Infinity && s.enclosure !== null && highest > lowest) t.widths.push((s.enclosure[1] - s.enclosure[0]) / (highest - lowest));
}

const round = (x: number | undefined): string => (x === undefined || Number.isNaN(x) ? "-" : x.toPrecision(3));
const middle = (xs: readonly number[]): number | undefined => (xs.length === 0 ? undefined : median(xs));
const row = (f: Family, t: Tally): string =>
  `| ${f} | ${t.cases} | ${t.noClaim} | ${t.worst.length} | ${round(middle(t.worst))} | ${round(middle(t.each))} | ${round(middle(t.widths))} | ${t.exact} | ${t.finite} |`;

describe("the static bound on the corpus", () => {
  it("contains the exact value and bounds the real error at each point of the boxes, and prints the width", () => {
    const wide = new Map(FAMILIES.map((f) => [f, tally()]));
    const tight = new Map(FAMILIES.map((f) => [f, tally()]));
    for (const c of all) {
      examine(c, hull(c), [...c.points, ...pointsOf(hull(c), deriveSeed(c.seed, `${c.name}/hull`))], wide.get(c.family) as Tally);
      const box = narrow(c);
      examine(c, box, pointsOf(box, deriveSeed(c.seed, `${c.name}/narrow`)), tight.get(c.family) as Tally);
    }
    const head = "| Family | Cases | No claim | Finite | Median over the worst point | Median over each point | Enclosure over the range | Exact points | Bounded points |";
    console.log(["The box of the points", head, ...FAMILIES.map((f) => row(f, wide.get(f) as Tally))].join("\n"));
    console.log(["The narrow box", head, ...FAMILIES.map((f) => row(f, tight.get(f) as Tally))].join("\n"));
    const tallies = [...wide.values(), ...tight.values()];
    expect(tallies.reduce((n, t) => n + t.exact, 0)).toBeGreaterThan(10_000);
    expect(tallies.reduce((n, t) => n + t.finite, 0)).toBeGreaterThan(5_000);
    for (const f of ["well", "orient-random", "incircle-random"] as const) {
      const ratios = (wide.get(f) as Tally).worst;
      expect(ratios.length, f).toBeGreaterThan(0);
      expect(median(ratios), f).toBeLessThanOrEqual(100);
    }
  }, 300_000);
});
