/**
 * The width gate of the package. A fixed family of inputs from `@mark1russell7/rigor-generators` goes through each
 * operation chain. The width of each result is in float steps of its midpoint. The median and the largest width of
 * each chain are kept in `test/width-record.json`. A change that makes a width larger fails the gate.
 *
 * @packageDocumentation
 */
import { random, type Random } from "@mark1russell7/rigor-generators";
import { median } from "@mark1russell7/rigor-statistics";
import type { Ball } from "./ball.ts";
import * as B from "./ball.ts";
import * as I from "./interval.ts";
import type { Interval } from "./interval.ts";
import type { BallOps, IntervalOps } from "./laws.test-helper.ts";

/** The seed of the family. A new seed is a new family, and it needs a new record. */
export const SEED = "interval-width/1";

/** The cases of each chain. */
export const CASES = 256;

/** The radius of the input of the chains with wide inputs. */
const WIDE = 2 ** -20;

/** The median and the largest width of one chain, in float steps. */
export interface WidthRow {
  readonly median: number;
  readonly max: number;
}

/** The kept record: the seed, the cases and one row for each chain. */
export interface WidthRecord {
  readonly seed: string;
  readonly cases: number;
  readonly rows: Readonly<Record<string, WidthRow>>;
}

/** One float step at `v`. */
function ulp(v: number): number {
  const a = Math.abs(v);
  return I.nextUp(a) - a;
}

/** The width of an interval in float steps of its larger end. A result with no bound has the width `Infinity`. */
export function intervalWidth(x: Interval): number {
  if (x === null || !(x[0] > -Infinity && x[1] < Infinity)) return Infinity;
  return (x[1] - x[0]) / ulp(Math.max(Math.abs(x[0]), Math.abs(x[1])));
}

/** The width `2 rad` of a ball in float steps of its midpoint. */
export function ballWidth(x: Ball): number {
  return x.rad < Infinity ? (2 * x.rad) / ulp(x.mid) : Infinity;
}

/** A chain: one draw of inputs, then the same steps in interval arithmetic and in ball arithmetic. */
interface Chain {
  readonly name: string;
  readonly interval: (r: Random, ops: IntervalOps) => Interval;
  readonly ball: (r: Random, ops: BallOps) => Ball;
}

const point = (v: number): Interval => [v, v];
const wide = (v: number): Interval => I.add([v, v], [-WIDE, WIDE]);

/** The steps of a chain, written one time for both kinds of arithmetic. */
interface Arithmetic<T> {
  readonly of: (v: number) => T;
  readonly wide: (v: number) => T;
  readonly add: (x: T, y: T) => T;
  readonly mul: (x: T, y: T) => T;
  readonly div: (x: T, y: T) => T;
  readonly sqrt: (x: T) => T;
}

const intervalArithmetic = (ops: IntervalOps): Arithmetic<Interval> => ({
  of: point,
  wide,
  add: ops.add,
  mul: ops.mul,
  div: ops.div,
  sqrt: (x) => ops.root(x, 2),
});

const ballArithmetic = (ops: BallOps): Arithmetic<Ball> => ({
  of: (v) => B.ball(v),
  wide: (v) => B.ball(v, WIDE),
  add: ops.add,
  mul: ops.mul,
  div: ops.div,
  sqrt: (x) => ops.root(x, 2),
});

/**
 * This function draws a float from `lo` to `hi` with all 53 bits. One draw of `r` has only 32 bits, and a sum of such
 * floats is often exact.
 */
const draw = (r: Random, lo: number, hi: number): number => lo + (hi - lo) * (r.next() + r.next() * 2 ** -32);

/** The steps of each chain. Each step draws its inputs from `r`, so the two kinds of arithmetic get the same inputs. */
const STEPS: Readonly<Record<string, <T>(r: Random, a: Arithmetic<T>) => T>> = {
  sum32: (r, a) => {
    let acc = a.of(draw(r, -1, 1));
    for (let i = 1; i < 32; i++) acc = a.add(acc, a.of(draw(r, -1, 1)));
    return acc;
  },
  horner8: (r, a) => {
    const x = a.of(draw(r, -1, 1));
    let acc = a.of(draw(r, -1, 1));
    for (let i = 0; i < 8; i++) acc = a.add(a.mul(acc, x), a.of(draw(r, -1, 1)));
    return acc;
  },
  product16: (r, a) => {
    let acc = a.of(draw(r, 0.5, 2));
    for (let i = 1; i < 16; i++) acc = a.mul(acc, a.of(draw(r, 0.5, 2)));
    return acc;
  },
  quotient8: (r, a) => {
    let acc = a.of(draw(r, 0.5, 2));
    for (let i = 0; i < 8; i++) acc = i % 2 === 0 ? a.div(acc, a.of(draw(r, 0.5, 2))) : a.mul(acc, a.of(draw(r, 0.5, 2)));
    return acc;
  },
  sqrt4: (r, a) => {
    let acc = a.of(draw(r, 0, 2));
    for (let i = 0; i < 4; i++) acc = a.sqrt(a.add(acc, a.of(draw(r, 0, 2))));
    return acc;
  },
  wideHorner8: (r, a) => {
    const x = a.wide(draw(r, -1, 1));
    let acc = a.of(draw(r, -1, 1));
    for (let i = 0; i < 8; i++) acc = a.add(a.mul(acc, x), a.of(draw(r, -1, 1)));
    return acc;
  },
};

const CHAINS: readonly Chain[] = Object.entries(STEPS).map(([name, steps]) => ({
  name,
  interval: (r, ops) => steps(r, intervalArithmetic(ops)),
  ball: (r, ops) => steps(r, ballArithmetic(ops)),
}));

/** This function gives the median and the largest of the widths. */
const rowOf = (widths: readonly number[]): WidthRow => ({ median: median(widths), max: Math.max(...widths) });

/**
 * This function measures the widths of each chain with the operations that you give.
 *
 * @param intervalOps - The operations of intervals.
 * @param ballOps - The operations of balls.
 * @returns The record of the measure.
 */
export function measureWidths(intervalOps: IntervalOps, ballOps: BallOps): WidthRecord {
  const rows: Record<string, WidthRow> = {};
  for (const chain of CHAINS) {
    const iw: number[] = [];
    const bw: number[] = [];
    for (let c = 0; c < CASES; c++) {
      iw.push(intervalWidth(chain.interval(random(`${SEED}/${chain.name}/${c}`), intervalOps)));
      bw.push(ballWidth(chain.ball(random(`${SEED}/${chain.name}/${c}`), ballOps)));
    }
    rows[`interval.${chain.name}`] = rowOf(iw);
    rows[`ball.${chain.name}`] = rowOf(bw);
  }
  return { seed: SEED, cases: CASES, rows };
}

/**
 * This function compares a measure with the kept record. A larger width loosens a bound. A smaller width is a gain,
 * and the record must change with it, so that the gate holds the gain.
 *
 * @param measured - The new measure.
 * @param kept - The kept record.
 * @returns One finding for each row that is not equal to the record. An empty list passes the gate.
 */
export function widthFindings(measured: WidthRecord, kept: WidthRecord): string[] {
  if (measured.seed !== kept.seed || measured.cases !== kept.cases) return [`The record is for ${kept.seed} with ${kept.cases} cases. Make a new record.`];
  const findings: string[] = [];
  const names = new Set([...Object.keys(measured.rows), ...Object.keys(kept.rows)]);
  for (const name of [...names].sort()) {
    const m = measured.rows[name];
    const k = kept.rows[name];
    if (m === undefined || k === undefined) {
      findings.push(`${name} is in only one of the measure and the record.`);
      continue;
    }
    for (const field of ["median", "max"] as const) {
      if (m[field] > k[field]) findings.push(`${name} ${field} loosens: ${m[field]} steps, the record is ${k[field]}.`);
      else if (m[field] < k[field]) findings.push(`${name} ${field} is tighter: ${m[field]} steps, the record is ${k[field]}. Update the record.`);
    }
  }
  return findings;
}
