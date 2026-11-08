import { describe, expect, it } from "vitest";
import { random } from "./index.ts";

// These values come from the copy of mulberry32 that this package had before it used rigor-generators. Thus the
// corpus and each kept record keep the same documents after the move.
const GOLDEN: readonly (readonly [number, readonly number[]])[] = [
  [0, [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111]],
  [1, [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741]],
  [0xdeadbeef, [0.9413696140982211, 0.26719574979506433, 0.772033357527107, 0.35816076025366783]],
];

describe("random", () => {
  it("gives the values of the old copy of mulberry32 for each seed", () => {
    for (const [seed, values] of GOLDEN) {
      const next = random(seed);
      expect(values.map(() => next()), `seed ${seed}`).toEqual(values);
    }
  });
});
