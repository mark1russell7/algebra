/**
 * The law of the rule "each evaluator states its error" (roadmap item A14). Each verb of `rationalMachine`, except
 * `summary`, has a law in `LAWS`. A new verb with no law fails the first test. Each law compares the result of its verb
 * with the exact value at seeded points: the result makes no claim, or it holds the exact value within its stated bound.
 *
 * @packageDocumentation
 */
import {
  compileBall,
  compileBigfloat,
  compileClosures,
  compileExact,
  compileFloat,
  compileInterval,
  compileStatic,
  compileTape,
  NO_CLAIM,
  randomComparison,
  randomExpression,
  SUMMARY,
} from "@mark1russell7/expression";
import type { BigInterval, Document, Enclosure, ExactResult, Expression } from "@mark1russell7/expression";
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { random } from "@mark1russell7/rigor-generators";
import { describe, expect, it } from "vitest";
import { evaluate as evaluatePolynomial, functions, normalForm, POLYNOMIAL, RATIONAL, rationalForm, rationalMachine } from "./index.ts";
import { made } from "./testing.test-helper.ts";

/** The count of seeded documents. Each document has `POINTS` points. */
const DOCUMENTS = 240;
const POINTS = 4;
/** The precision of the verb `bigfloat` in the law, in bits. */
const PRECISION = 80;

type Point = Readonly<Record<string, number>>;
/** A law of one verb: a function of a point that gives a failure, or `undefined`, and the count of its claims. */
interface Check {
  at(point: Point, exact: ExactResult): string | undefined;
  claims: number;
}

const valuesOf = (variables: readonly string[], point: Point): number[] => variables.map((name) => point[name] ?? 0);
const exactPoint = (point: Point): Record<string, Rational> => Object.fromEntries(Object.entries(point).map(([k, v]) => [k, Q.fromFloat(v)]));

/** This function tells if a double holds the exact value within a bound. A bound of `Infinity` makes no claim. */
function withinBound(value: number, error: number, exact: Rational): boolean {
  if (!(Number.isFinite(value) && error >= 0)) return false;
  return Q.compare(Q.abs(Q.sub(Q.fromFloat(value), exact)), Q.fromFloat(error)) <= 0;
}

/** This function tells if an interval of doubles holds the exact value. An infinite end holds each value on its side. */
function holds(low: number, high: number, exact: Rational): boolean {
  if (Number.isNaN(low) || Number.isNaN(high)) return false;
  const above = low === -Infinity || Q.compare(Q.fromFloat(low), exact) <= 0;
  const below = high === Infinity || Q.compare(exact, Q.fromFloat(high)) <= 0;
  return above && below;
}

/** This function gives the exact value of a `BigFloat`, or `undefined` when its exponent is out of a small range. */
function rationalOf(x: BigInterval["low"]): Rational | undefined {
  if (Math.abs(x.exponent) > 4096) return undefined;
  const size = BigInt(x.sign) * x.mantissa;
  return x.exponent >= 0 ? Q.rational(size << BigInt(x.exponent)) : Q.rational(size, 1n << BigInt(-x.exponent));
}

const show = (r: Rational): string => Q.toString(r);

/** This function gives the law of a float engine: `|value - exact| <= error`. */
function floatLaw(compile: typeof compileFloat) {
  return (doc: Document): Check => {
    const f = made(compile(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || exact === null) return undefined;
        const { value, error } = f.evaluate(valuesOf(f.variables, point));
        if (error === Infinity) return undefined;
        check.claims++;
        return withinBound(value, error, exact) ? undefined : `value ${value}, error ${error}, exact ${show(exact)}`;
      },
    };
    return check;
  };
}

/** This function tells if an enclosure of doubles holds the exact value. */
function enclosureFails(e: Exclude<Enclosure, typeof NO_CLAIM>, exact: Rational): string | undefined {
  if (e === null) return `no value, exact ${show(exact)}`;
  return holds(e[0], e[1], exact) ? undefined : `[${e[0]}, ${e[1]}], exact ${show(exact)}`;
}

/**
 * The law of each verb. The verbs `float` and `tape` give a double and a bound of its error. The verbs `interval`,
 * `static`, `ball` and `bigfloat` give an enclosure. The verbs `exact`, `polynomial` and `rational` give exact values,
 * with an error of zero.
 */
const LAWS: Readonly<Record<string, (doc: Document) => Check>> = {
  float(doc) {
    const engines = [compileFloat, compileClosures].map((c) => floatLaw(c)(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        const failures = engines.map((e) => e.at(point, exact)).filter((s) => s !== undefined);
        check.claims = engines.reduce((n, e) => n + e.claims, 0);
        return failures[0];
      },
    };
    return check;
  },
  tape: floatLaw(compileTape),
  interval(doc) {
    const f = made(compileInterval(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || exact === null) return undefined;
        const e = f.evaluate(valuesOf(f.variables, point));
        if (e === NO_CLAIM) return undefined;
        check.claims++;
        return enclosureFails(e, exact);
      },
    };
    return check;
  },
  static(doc) {
    const s = made(compileStatic(doc));
    const float = made(compileFloat(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || exact === null) return undefined;
        const bound = s.evaluate(valuesOf(s.variables, point));
        const failures: string[] = [];
        if (bound.enclosure !== NO_CLAIM) {
          check.claims++;
          const fail = enclosureFails(bound.enclosure, exact);
          if (fail !== undefined) failures.push(`enclosure ${fail}`);
        }
        if (bound.error !== Infinity) {
          check.claims++;
          const { value } = float.evaluate(valuesOf(float.variables, point));
          if (!withinBound(value, bound.error, exact)) failures.push(`float ${value}, static error ${bound.error}, exact ${show(exact)}`);
        }
        return failures[0];
      },
    };
    return check;
  },
  ball(doc) {
    const f = made(compileBall(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || exact === null) return undefined;
        const { mid, rad } = f.evaluate(valuesOf(f.variables, point));
        if (rad === Infinity) return undefined;
        check.claims++;
        return withinBound(mid, rad, exact) ? undefined : `mid ${mid}, rad ${rad}, exact ${show(exact)}`;
      },
    };
    return check;
  },
  bigfloat(doc) {
    const f = made(compileBigfloat(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || exact === null) return undefined;
        const r = f.evaluate(valuesOf(f.variables, point), PRECISION);
        if (r === NO_CLAIM) return undefined;
        if (r === null) return `no value, exact ${show(exact)}`;
        const [low, high, error] = [rationalOf(r.low), rationalOf(r.high), rationalOf(r.error)];
        if (low === undefined || high === undefined || error === undefined) return undefined;
        check.claims++;
        if (Q.compare(low, exact) > 0 || Q.compare(exact, high) > 0) return `[${show(low)}, ${show(high)}], exact ${show(exact)}`;
        return Q.compare(Q.sub(high, low), error) <= 0 ? undefined : `width ${show(Q.sub(high, low))} over error ${show(error)}`;
      },
    };
    return check;
  },
  exact(doc) {
    // The verb `exact` is the reference of each other law. Its law: at a point of doubles, it gives the same value as
    // the document with the point put in as literals, where the variables are gone.
    const f = made(compileExact(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM) return undefined;
        check.claims++;
        const again = f.evaluate(valuesOf(f.variables, point));
        const same = exact === null ? again === null : again !== null && again !== NO_CLAIM && Q.equals(again, exact);
        return same ? undefined : "two calls give different values";
      },
    };
    return check;
  },
  [POLYNOMIAL](doc) {
    const form = made(normalForm(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || form.kind === NO_CLAIM) return undefined;
        check.claims++;
        if (form.kind === "no value") return exact === null ? undefined : `no value, exact ${show(exact)}`;
        if (exact === null) return "a polynomial has a value at each point";
        const got = evaluatePolynomial(form.polynomial, exactPoint(point));
        return Q.equals(got, exact) ? undefined : `polynomial ${show(got)}, exact ${show(exact)}`;
      },
    };
    return check;
  },
  [RATIONAL](doc) {
    const form = made(rationalForm(doc));
    const check: Check = {
      claims: 0,
      at(point, exact) {
        if (exact === NO_CLAIM || form.kind === NO_CLAIM) return undefined;
        check.claims++;
        if (form.kind === "no value") return exact === null ? undefined : `no value, exact ${show(exact)}`;
        const got = functions.evaluate(form.value, exactPoint(point));
        if (exact === null) return got === null ? undefined : `rational ${show(got)}, no exact value`;
        return got !== null && Q.equals(got, exact) ? undefined : `rational ${got === null ? "no value" : show(got)}, exact ${show(exact)}`;
      },
    };
    return check;
  },
};

/** The doubles of the points: small whole numbers, fractions of a power of two, and values that a double rounds. */
const VALUES = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 0.5, -2.5, 3.75, 0.1, -0.3, 1 / 3, 1e-3, 1e5 + 0.1];

describe("each evaluator states its error", () => {
  it("has a law for each verb of the machine, except summary", () => {
    const kinds = rationalMachine().world.kinds as Record<string, { verbs: Record<string, string> }>;
    for (const [name, kind] of Object.entries(kinds)) {
      const verbs = Object.keys(kind.verbs).filter((v) => v !== SUMMARY).sort();
      expect(verbs, `the verbs of the kind ${name}`).toEqual(Object.keys(LAWS).sort());
    }
  });

  it("gives no claim, or the exact value within its bound, at seeded documents and points", () => {
    const rnd = random(14);
    const source = (): number => rnd.next();
    const docs: Document[] = Array.from({ length: DOCUMENTS }, (_, i): Document => {
      const options = { variables: ["x", "y"], maxDepth: 4 };
      return i % 4 === 3 ? randomComparison(source, options) : (randomExpression(source, options) as Expression);
    });
    const failures: string[] = [];
    const claims: Record<string, number> = Object.fromEntries(Object.keys(LAWS).map((v) => [v, 0]));
    for (const doc of docs) {
      const reference = made(compileExact(doc));
      const checks = Object.entries(LAWS).map(([verb, law]) => [verb, law(doc)] as const);
      for (let p = 0; p < POINTS; p++) {
        const point: Point = { x: rnd.pick(VALUES), y: rnd.pick(VALUES) };
        const exact = reference.evaluate(valuesOf(reference.variables, point));
        for (const [verb, check] of checks) {
          const fail = check.at(point, exact);
          if (fail !== undefined) failures.push(`${verb} at ${JSON.stringify(point)}: ${fail} in ${JSON.stringify(doc)}`);
        }
      }
      for (const [verb, check] of checks) claims[verb] = (claims[verb] ?? 0) + check.claims;
    }
    expect(failures.slice(0, 5)).toEqual([]);
    for (const [verb, count] of Object.entries(claims)) expect(count, `the claims of the verb ${verb}`).toBeGreaterThan(DOCUMENTS / 4);
  });
});
