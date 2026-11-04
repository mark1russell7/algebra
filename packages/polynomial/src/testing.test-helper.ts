/**
 * The helpers of the tests of this package: the builders of documents, the seeded random polynomials and the two exact
 * oracles.
 *
 * @packageDocumentation
 */
import { compileExact } from "@mark1russell7/expression";
import type { Document, ExactResult, Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import type { Random } from "@mark1russell7/rigor-generators";
import { normalForm, ONE, sum, ZERO } from "./index.ts";
import type { Polynomial, Term } from "./index.ts";

/** The count of random cases of each property. The variable `PROPERTY_RUNS` sets it. */
export const RUNS: number = Number(process.env["PROPERTY_RUNS"] ?? 1000);
/** The time limit of a property test. */
export const LONG: number = 30_000 + RUNS * 40;

export const n = (value: number): Expression => ({ type: "num", value });
export const v = (value: string): Expression => ({ type: "var", value });
export const x: Expression = v("x");
export const y: Expression = v("y");
export const z: Expression = v("z");
type Parts = [Expression, Expression, ...Expression[]];
export const add = (...parts: Expression[]): Expression => ({ type: "add", value: parts as Parts });
export const mul = (...parts: Expression[]): Expression => ({ type: "mul", value: parts as Parts });
export const min = (...parts: Expression[]): Expression => ({ type: "min", value: parts as Parts });
export const max = (...parts: Expression[]): Expression => ({ type: "max", value: parts as Parts });
export const sub = (a: Expression, b: Expression): Expression => ({ type: "sub", value: [a, b] });
export const div = (a: Expression, b: Expression): Expression => ({ type: "div", value: [a, b] });
export const neg = (a: Expression): Expression => ({ type: "neg", value: a });
export const pow = (base: Expression, exp: number): Expression => ({ type: "pow", value: { base, exp } });
export const root = (radicand: Expression, index: number): Expression => ({ type: "root", value: { radicand, index } });
export const lt = (a: Expression, b: Expression): Document => ({ type: "lt", value: [a, b] });
export const le = (a: Expression, b: Expression): Document => ({ type: "le", value: [a, b] });
export const eq = (a: Expression, b: Expression): Document => ({ type: "eq", value: [a, b] });

/** This function gives a document of a rational whose numerator and denominator are exact floats. */
export const q = (value: Rational): Expression => div(n(Number(value.n)), n(Number(value.d)));

export function made<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; reason: string } }): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.reason}`);
  return r.value;
}

/** This function gives the polynomial of a document that has one. */
export function polynomialOf(doc: Document): Polynomial {
  const f = made(normalForm(doc));
  if (f.kind !== "polynomial") throw new Error(`no polynomial: ${f.kind}`);
  return f.polynomial;
}

/** This function gives a seeded polynomial with small integer coefficients. It is not zero. */
export function randomPolynomial(rnd: Random, names: readonly string[], degree: number, count: number): Polynomial {
  const terms: Polynomial[] = [];
  for (let i = 0; i < count; i++) {
    const exponents = names.map(() => 0);
    for (let left = rnd.below(degree + 1); left > 0; left--) {
      const at = rnd.below(names.length);
      exponents[at] = (exponents[at] as number) + 1;
    }
    const powers = names.flatMap((variable, at) => ((exponents[at] as number) === 0 ? [] : [{ variable, exponent: exponents[at] as number }]));
    const term: Term = { coefficient: Q.rational(BigInt(rnd.int(1, 9) * (rnd.chance(0.5) ? -1 : 1))), powers };
    terms.push({ terms: [term] });
  }
  const out = sum(terms);
  return out === ZERO || out.terms.length === 0 ? ONE : out;
}

/** This function gives a document of a polynomial with exact float coefficients. */
export function documentOf(p: Polynomial): Expression {
  const parts = p.terms.map((t) => mul(q(t.coefficient), ...t.powers.map((power) => pow(v(power.variable), power.exponent)), n(1)));
  const [first, second, ...rest] = parts;
  if (first === undefined) return n(0);
  return second === undefined ? first : add(first, second, ...rest);
}

/** This function replaces each named variable of a document. */
export function substitute(doc: Expression, at: Readonly<Record<string, Expression>>): Expression {
  const go = (e: Expression): Expression => substitute(e, at);
  switch (doc.type) {
    case "num":
      return doc;
    case "var":
      return at[doc.value] ?? doc;
    case "neg":
      return neg(go(doc.value));
    case "pow":
      return pow(go(doc.value.base), doc.value.exp);
    case "root":
      return root(go(doc.value.radicand), doc.value.index);
    default:
      return { type: doc.type, value: doc.value.map(go) } as unknown as Expression;
  }
}

/** This function gives the verb `exact` of a document at a point, by a closed document. */
export function exactAt(doc: Expression, at: Readonly<Record<string, Rational>>): ExactResult {
  const closed = substitute(doc, Object.fromEntries(Object.entries(at).map(([name, value]) => [name, q(value)])));
  return made(compileExact(closed)).evaluate([]);
}

/** The dense form of the oracle of Euclid: coefficients from the power 0, with a last coefficient that is not zero. */
type Dense = Rational[];

const trim = (p: Dense): Dense => {
  const out = [...p];
  while (out.length > 0 && Q.sign(out[out.length - 1] as Rational) === 0) out.pop();
  return out;
};

/** This function gives the remainder of Euclid over the rationals. It uses no pseudo-division and no subresultant. */
function euclidRemainder(a: Dense, b: Dense): Dense {
  let rest = [...a];
  const lead = b[b.length - 1] as Rational;
  while (rest.length >= b.length) {
    const factor = Q.div(rest[rest.length - 1] as Rational, lead);
    const shift = rest.length - b.length;
    b.forEach((c, i) => (rest[i + shift] = Q.sub(rest[i + shift] as Rational, Q.mul(factor, c))));
    rest = trim(rest);
  }
  return rest;
}

/** This function gives the monic gcd of the algorithm of Euclid: an oracle with no code in common with `gcd`. */
export function euclid(first: Dense, second: Dense): Dense {
  let [a, b] = [trim(first), trim(second)];
  while (b.length > 0) [a, b] = [b, euclidRemainder(a, b)];
  const lead = a[a.length - 1];
  return lead === undefined ? [] : a.map((c) => Q.div(c, lead));
}

/** This function gives the dense form of a polynomial in one variable at fixed values of the other variables. */
export function denseAt(p: Polynomial, name: string, at: Readonly<Record<string, Rational>>): Dense {
  const out: Dense = [];
  for (const t of p.terms) {
    let value = t.coefficient;
    let exponent = 0;
    for (const power of t.powers) {
      if (power.variable === name) exponent = power.exponent;
      else value = Q.mul(value, Q.pow(at[power.variable] as Rational, power.exponent));
    }
    while (out.length <= exponent) out.push(Q.ZERO);
    out[exponent] = Q.add(out[exponent] as Rational, value);
  }
  return trim(out);
}
