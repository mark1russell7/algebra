# Instructions for Claude

## Writing style

Write all prose of this repository in the style of ASD-STE100 Simplified Technical English (STE). This prose is the README files, this file, the TSDoc comments and the text that the site shows. The linter [`ste-lint`](https://github.com/mark1russell7/ste-lint) examines it.

- After a change to prose, start `pnpm lint:ste` and correct each finding. CI fails when there is an error.
- Keep each instruction to 20 words or fewer, and each description to 25 words or fewer.
- Do not use the modal verbs (`should`, `may`, `might`, `would`), semicolons or Latin abbreviations (`e.g.`, `i.e.`, `etc.`).
- Use the active voice. Start each sentence of a doc comment with its subject: "This function returns the value", not "Returns the value".
- Put code, file names and commands in code font. The linter counts each code span as one word.
- Add a word to the glossary in `ste.config.json` only if it is a real technical term of the project.

## Packages

- Make a new package with `pnpm package add <name> --preset=<preset>`. Do not write `package.json` or `tsconfig.json` by hand.
- Make a server package with `--preset=service`. Only its entry `src/main.ts` uses `run()` of `@mark1russell7/service`.
- A package is a source package. Its `main` is `src/index.ts`, so other packages import its source.
- Each package has a `tsconfig.test.json`. `pnpm typecheck` checks the source and the tests.
- Each public package has a report of its API in `test/api/public-api.txt`. CI fails when the report is not current.
- After a change of a public API, build, start `pnpm exec api-report update`, and commit the report with the change.
- `pnpm check:conventions` examines the rules of this file that a script can examine. CI fails on a break. `pnpm exec conventions --list` shows the rules.
- To keep an exception to a rule, write it with its reason in the field `conventions` of the root `package.json`.

## CI

- The workflows use the shared workflows and actions of the template. `CI.md` tells their inputs.
- Change a shared workflow only in `~/git/template`. A repository changes only the inputs of its callers.

## npm releases

- Do not publish to npm, and do not change npm settings. The owner and one named Claude session do all npm work.
- Do not edit `.github/workflows/release.yml` or `scripts/release/`.
- Is a package that is not on npm a block? Use `workspace:*`, or a `github:` specifier pinned to a commit.
- `RELEASING.md` tells how a release and a new package work.

## The project

- `docs/ROADMAP.md` is the plan. Write the prediction of an item before its code: the claims, the measure, the base and the noise.
- The npm name `@mark1russell7/algebra` is the timer algebra of systems. Name each package here by its contents, for example `@mark1russell7/rational`.
- An expression is a coeval document. Add an evaluator as a new answer of a kind. Do not change the documents.
- Each evaluator states its error. A result without an error bound is not a result.
- `packages/polynomial/src/evaluator-error.test.ts` has a law for each verb. Add a law with each new verb.
- Keep each measured result, the losers too, with its raw records.
- Benches and long property runs operate in CI, not on the local machine.

## The monthly study

- The workflow `study-monthly.yml` measures the data of the site again on day 4 of each month. It starts `census.yml` and `bench-select.yml` at one commit.
- The data has an age limit of 33 days. After the limit, the freshness gate stops the deploys of the site.
- The run pushes the branch `study/<YYYY-MM>`. It opens or updates one issue with the label `study-refresh` and the compare link.
- Open the pull request from that branch with your own token, so CI starts on it. Read the change, wait for the checks, and merge it by hand.
- The workflow opens no pull request. A pull request of the Actions token starts no workflow, so its necessary checks do not start.
- `packages/site/src/study.ts` writes the data files and the kept folders. `data/kept-runs.json` names the run of each kept folder.
- Each run replaces the kept folders of the last run. Git history keeps each earlier run, and `data/kept-runs.json` names its run.
- The explorer keeps one float-wrong record for each set and source line of the call. It keeps the record with the most tests, and the lowest line on a tie.
- A failing cell of the census is a finding. Write it in `docs/ROADMAP.md`. Do not make the band wider because of it.
- When a run fails, the job `report` opens an issue. Correct the cause, then start the run again with `workflow_dispatch`.
- `scripts/rules.test.ts` checks the rules of this file about the npm name, the pull requests and the job `report`.
