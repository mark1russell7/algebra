/**
 * An exact oracle for the tests: the value of a root-free expression as a rational over `bigint`. It is slow, but
 * each step is easy to examine. The exact rationals of A2 replace it.
 */
import type { Document, Expression } from "./schema.ts";

/** A rational `n / d` with `d > 0`, in lowest terms. */
export interface Rat {
  readonly n: bigint;
  readonly d: bigint;
}

const abs = (x: bigint): bigint => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function rat(n: bigint, d = 1n): Rat {
  if (d === 0n) throw new RangeError("zero denominator");
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return g > 1n ? { n: n / g, d: d / g } : { n, d };
}

const view = new DataView(new ArrayBuffer(8));

/** The exact rational value of a finite float. */
export function fromFloat(x: number): Rat {
  if (!Number.isFinite(x)) throw new RangeError(`not finite: ${x}`);
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const e = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const mant = e === 0 ? frac : frac | (1n << 52n);
  const exp = (e === 0 ? 1 : e) - 1075;
  return exp >= 0 ? rat(sign * mant * (1n << BigInt(exp))) : rat(sign * mant, 1n << BigInt(-exp));
}

export const addR = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const negR = (a: Rat): Rat => ({ n: -a.n, d: a.d });
export const mulR = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
export const cmpR = (a: Rat, b: Rat): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};

/** The sign of `x - r` for a float bound `x`, which can be infinite. */
export function cmpBound(x: number, r: Rat): number {
  if (x === Infinity) return 1;
  if (x === -Infinity) return -1;
  return cmpR(fromFloat(x), r);
}

/** The exact value: a rational, `undefined` when it has no real value, or `"root"` when it has a root. */
export type Exact = Rat | undefined | "root";

function powR(a: Rat, n: number): Rat | undefined {
  if (n < 0) return a.n === 0n ? undefined : powR(rat(a.d, a.n), -n);
  return rat(a.n ** BigInt(n), a.d ** BigInt(n));
}

/**
 * This function gives the exact value of a document at a point.
 *
 * @param doc - The document.
 * @param point - The value of each variable.
 * @returns The exact value. A comparison gives `1` or `0`.
 */
export function exact(doc: Document, point: Readonly<Record<string, number>>): Exact {
  const all = (xs: readonly Expression[]): Rat[] | undefined | "root" => {
    const out: Rat[] = [];
    let missing = false;
    for (const x of xs) {
      const v = exact(x, point);
      if (v === "root") return "root";
      if (v === undefined) missing = true;
      else out.push(v);
    }
    return missing ? undefined : out;
  };
  switch (doc.type) {
    case "num":
      return fromFloat(doc.value);
    case "var": {
      const v = point[doc.value];
      if (v === undefined) throw new RangeError(`no value for ${doc.value}`);
      return fromFloat(v);
    }
    case "neg": {
      const v = exact(doc.value, point);
      return v === undefined || v === "root" ? v : negR(v);
    }
    case "pow": {
      const v = exact(doc.value.base, point);
      return v === undefined || v === "root" ? v : powR(v, doc.value.exp);
    }
    case "root":
      return "root";
    default: {
      const vs = all(doc.value);
      if (vs === undefined || vs === "root") return vs;
      const [a, b] = vs as [Rat, Rat];
      switch (doc.type) {
        case "add":
          return vs.reduce(addR);
        case "mul":
          return vs.reduce(mulR);
        case "min":
          return vs.reduce((x, y) => (cmpR(x, y) <= 0 ? x : y));
        case "max":
          return vs.reduce((x, y) => (cmpR(x, y) >= 0 ? x : y));
        case "sub":
          return addR(a, negR(b));
        case "div":
          return b.n === 0n ? undefined : mulR(a, rat(b.d, b.n));
        case "lt":
          return rat(cmpR(a, b) < 0 ? 1n : 0n);
        case "le":
          return rat(cmpR(a, b) <= 0 ? 1n : 0n);
        case "eq":
          return rat(cmpR(a, b) === 0 ? 1n : 0n);
      }
    }
  }
}
