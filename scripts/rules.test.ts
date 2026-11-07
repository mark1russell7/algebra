/**
 * The tests of the checks of `rules.ts`. Each check passes on the files of the repository and fails on a planted
 * mutant of them.
 *
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { jobsOf, noReservedName, packageFiles, RESERVED_NAME, studyOpensNoPullRequest, studyReportsFailure } from "./rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const study = readFileSync(new URL("../.github/workflows/study-monthly.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");

describe("the monthly study opens no pull request", () => {
  it("passes on study-monthly.yml", () => {
    assert.deepEqual(studyOpensNoPullRequest(study), []);
  });

  it("fails when a step opens a pull request, or a job can write pull requests", () => {
    const opens = study.replace("gh issue create -R \"$REPO\" --label", "gh pr create -R \"$REPO\" --label");
    assert.notEqual(opens, study);
    assert.equal(studyOpensNoPullRequest(opens).length, 1);
    const writes = study.replace("      contents: write\n", "      contents: write\n      pull-requests: write\n");
    assert.notEqual(writes, study);
    assert.equal(studyOpensNoPullRequest(writes).length, 1);
  });

  it("does not count a comment", () => {
    assert.deepEqual(studyOpensNoPullRequest("# gh pr create\njobs:\n  a:\n    # pull-requests: write\n"), []);
  });
});

describe("the job report of the monthly study opens an issue on a failure", () => {
  it("passes on study-monthly.yml, whose report needs each other job", () => {
    assert.deepEqual(studyReportsFailure(study), []);
    assert.ok(jobsOf(study).size >= 8);
  });

  it("fails when the report opens no issue, runs on each result, or misses a job", () => {
    const noIssue = study.replace(/gh issue create -R "\$REPO" --title "The monthly study failed"/, 'echo "The monthly study failed"');
    assert.notEqual(noIssue, study);
    assert.deepEqual(studyReportsFailure(noIssue), ["the job report does not run gh issue create"]);
    const always = study.replace("    if: failure()\n", "    if: always()\n");
    assert.notEqual(always, study);
    assert.deepEqual(studyReportsFailure(always), ["the job report does not have if: failure()"]);
    const missing = study.replace("needs: [plan, census-highways, census-packing, bench, refresh, branch, issue]", "needs: [plan, refresh, branch, issue]");
    assert.notEqual(missing, study);
    assert.equal(studyReportsFailure(missing).length, 3);
    assert.deepEqual(studyReportsFailure("jobs:\n  plan:\n    runs-on: ubuntu-latest\n"), ["the workflow has no job report"]);
  });
});

describe("no package takes the name of the timer algebra", () => {
  it("passes on each package.json of the repository", () => {
    const files = packageFiles(root);
    assert.ok(files.length > 10);
    assert.deepEqual(noReservedName(files), []);
  });

  it("fails on a planted package.json with the reserved name", () => {
    const planted = { path: "packages/planted/package.json", text: JSON.stringify({ name: RESERVED_NAME }) };
    assert.deepEqual(noReservedName([...packageFiles(root), planted]), [`packages/planted/package.json: the package takes the name ${RESERVED_NAME}`]);
  });
});
