# @algebra/bigfloat

This private package is the number type of A7 in `docs/ROADMAP.md`. A value is a binary float with a precision that the caller selects. The verb `bigfloat` of `@mark1russell7/expression` uses this package.

## The value

A `BigFloat` is `sign × mantissa × 2^exponent`, with a `bigint` mantissa and an exponent of at most `MAX_EXPONENT`, which is `2^52`. The field `precision` is the precision of the operation that made the value.

- Each value has one form. The mantissa of a value that is not zero is odd, so two equal values have equal fields.
- A value is finite. This type has no infinity, no not-a-number and no negative zero.
- A case without a real result is a `RangeError`: a quotient by zero, or an even root of a negative value. An exponent past `MAX_EXPONENT` is a `RangeError` too.

## The operations

`add`, `sub`, `mul`, `div`, `sqrt`, `root`, `round`, `fromRational` and `fromBigInt` round correctly. Each result is the exact real result, rounded one time.

```ts
import { div, fromNumber, sqrt, toRational } from "@algebra/bigfloat";

const low = div(fromNumber(1), fromNumber(3), { precision: 200, rounding: "down" });
const high = div(fromNumber(1), fromNumber(3), { precision: 200, rounding: "up" });
const two = sqrt(fromNumber(2), { precision: 1000 });
toRational(low); // the exact value of the result
```

The last argument is a context with two optional fields:

- `precision`: the count of bits of the result, 1 or more. The default is the largest precision of the operands.
- `rounding`: `nearest` with ties to even (the default), `down`, `up` or `zero`.

`neg`, `abs`, `compare`, `equals` and `toRational` are exact. `toNumber` gives the nearest double. A value past the range of the doubles gives an infinity.

The error of each operation is stated by its mode. The mode `nearest` is at most half a unit in the last place from the exact result. Each directed mode is less than one unit from it.

An operand far below the other adds only a sticky flag. Thus the cost of `add` and `compare` does not depend on the distance between the exponents.

## The tests

- The oracle finds the correctly rounded value of each exact rational with a bisection on exact comparisons. It shares no code with the rounding of the package.
- The hard cases are exact ties, operands that cancel, squares, and an operand near the limit of the sticky flag. A power of two minus a tiny value is one more.
- At 53 bits in the mode `nearest`, each operation equals the IEEE double result. The test skips a result that overflows, and a product or a quotient in the subnormal range. It counts each skip.

The variable `PROPERTY_RUNS` sets the count of cases. The default is 2000 pairs of operands and 10000 pairs of doubles.
