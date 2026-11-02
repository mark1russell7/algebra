# @mark1russell7/rational

This package holds the exact rationals of algebra (roadmap item A2). A rational is `{ n, d }` over `bigint`, always in lowest terms. The start of this package is the rationals of `@mark1russell7/quantity` in systems. Later, quantity imports them from here.

## The value

- The denominator `d` is more than 0, and `gcd(n, d)` is 1. Zero is `0 / 1`.
- Two equal rationals have equal fields, so `equals` compares the fields.
- The functions make only values of this form. Do not make a `Rational` from a literal.

## The functions

| Function | Result | Error |
| --- | --- | --- |
| `rational(n, d = 1n)` | The value `n / d` in lowest terms | Exact |
| `fromDecimal(text)` | The value of a decimal text, for example `"0.0254"` or `"1e-9"` | Exact |
| `fromNumber(x)` | The value of the shortest decimal that JavaScript prints for `x` | Exact for that decimal |
| `fromFloat(x)` | The exact binary value of the double `x`. The value `-0` gives 0 | Exact |
| `add`, `sub`, `mul`, `div`, `neg`, `abs`, `inverse` | The field operations | Exact |
| `pow(a, e)` | The power of `a` to an integer `e` | Exact |
| `compare`, `cmp`, `equals`, `sign`, `isInteger` | The order and the tests | Exact |
| `floor`, `ceil` | The nearest integer below or above | Exact |
| `toString(a)` | The text `"n/d"`, or `"n"` for an integer | Exact |
| `toNumber(a)` | The nearest double, with ties to even | Half a unit in the last place |

The functions `div` and `inverse` refuse a zero divisor with a `RangeError`. The function `pow` refuses 0 to a negative power.

```ts
import { add, fromDecimal, fromNumber, toNumber } from "@mark1russell7/rational";

const sum = add(fromNumber(0.1), fromNumber(0.2));
// toNumber(sum) is 0.3, because 1/10 + 2/10 is exactly 3/10.
const inch = fromDecimal("0.0254");
// inch is { n: 127n, d: 5000n }.
```

## The two readers of a number

- `fromNumber(0.1)` gives 1/10. It reads the decimal that JavaScript prints. Quantity uses it, so a decimal input of a person stays exact.
- `fromFloat(0.1)` gives 3602879701896397/2^55. It reads the bits of the double. The exact evaluators use it.

## The changes from quantity

- The names of quantity stay. `cmp` is the same function as the new `compare`.
- `toNumber` of quantity cuts the value to 20 digits, and then rounds it. This `toNumber` rounds the exact value one time, to the nearest double.
- The new functions are `fromFloat`, `abs`, `inverse`, `compare`, `equals`, `sign` and `toString`.

## The tests

The property tests examine the field laws on random rationals from a seed. The variable `PROPERTY_RUNS` sets the count of cases. The default is 1000. Other tests port the tests of quantity that use its rationals.
