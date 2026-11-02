# The corpus of packing

The session of packing sends these `.jsonl` files. They are the near-degenerate inputs of its box tests.

`smoke-v1-sample.jsonl` has five complete cases of `node packages/packing/bench/main.ts predicates --corpus smoke-v1 --strategies all` at the commit `d718b54` of packing. Its source and its bench are the same as at `94bcd79`. The tests of the census use it.
