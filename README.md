# algebra

One expression, many evaluators: exact, fast and with a known error.

The goal is to represent mathematics correctly. An expression is a document, and the same document has many meanings. It can be a fast float function or an exact rational value. It can also be an interval that contains the true value, or a symbolic result. A measured model of cost and error selects the evaluator for each question and stitches the evaluators together.

## The idea

An expression is a [coeval](https://github.com/mark1russell7/coeval) document: `{ "type": "add", "value": [x, y] }`. Its kind names the evaluator, so a new evaluator is a new answer to the same question. No document changes.

- **Each node keeps a summary.** The summary is a monoid: the free variables, the degree, the bounds and the cost of the subtree. An edit updates only the path from the changed node to the root.
- **Each evaluator states its error.** The float evaluator gives a value and a bound of its error. The exact evaluator gives the error 0. The interval evaluator gives an interval that contains the true value.
- **A filter goes fast first.** A predicate starts with floats. When the bound of the error is smaller than the distance to the answer, the float answer is correct. Only the other inputs go to the exact evaluator.
- **Structures are data.** A monoid, a group, a ring, a field, an order and a lattice are instances. A product, a quotient, a polynomial ring and a field extension make new instances from old instances.

## First users

- **Exact geometric predicates** for the packing and edge-routing engines: orientation, in-circle and segment intersection, with a float filter and an exact fallback.
- **The compiler of vex**: its domains are algebras of this repository, and its compiler is the float evaluator.
- **The timer algebra of systems**: its exact rationals move into this repository.

## Status

Not started. Refer to [docs/ROADMAP.md](docs/ROADMAP.md).

## Writing style

The prose of this repository follows ASD-STE100 Simplified Technical English (STE). STE is a style target. ASD does not certify this repository.

## Disclosure

An AI model (Claude, from Anthropic) writes most of the text and the code of this repository, under the direction of the author.

## License

MIT
