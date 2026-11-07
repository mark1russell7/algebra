/**
 * The checks of three rules of `CLAUDE.md` that the conventions tool does not examine (roadmap item A14). Each check
 * takes the text of a file and gives its findings. An empty list tells that the file obeys the rule.
 *
 * @packageDocumentation
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The npm name of the timer algebra of systems. No package of this repository takes it. */
export const RESERVED_NAME = "@mark1russell7/algebra";

/** This function gives the lines of a workflow without the comments, with the number of each line. */
function codeLines(text: string): { line: number; code: string }[] {
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ line: i + 1, code: raw.replace(/(^|\s)#.*$/, "").trimEnd() }))
    .filter((l) => l.code.trim() !== "");
}

/** This function gives the name and the lines of each job of a workflow. */
export function jobsOf(text: string): Map<string, string[]> {
  const jobs = new Map<string, string[]>();
  let inJobs = false;
  let current: string[] | undefined;
  for (const { code } of codeLines(text)) {
    if (/^\S/.test(code)) {
      inJobs = code === "jobs:";
      current = undefined;
      continue;
    }
    if (!inJobs) continue;
    const name = /^ {2}([A-Za-z_][\w-]*):$/.exec(code);
    if (name?.[1] !== undefined) jobs.set(name[1], (current = []));
    else current?.push(code);
  }
  return jobs;
}

/**
 * This function checks the rule "the monthly study opens no pull request". The workflow does not run `gh pr create`,
 * and no job gets the permission `pull-requests: write`.
 *
 * @param text - The text of `study-monthly.yml`.
 * @returns The findings.
 */
export function studyOpensNoPullRequest(text: string): string[] {
  const findings: string[] = [];
  for (const { line, code } of codeLines(text)) {
    if (/\bgh\s+pr\s+create\b/.test(code)) findings.push(`line ${line}: the workflow opens a pull request`);
    if (/pull-requests:\s*write\b/.test(code)) findings.push(`line ${line}: a job can write pull requests`);
  }
  return findings;
}

/**
 * This function checks the rule "the job report of the monthly study opens an issue on a failure". The job `report`
 * has `if: failure()`, it needs each other job, and it runs `gh issue create`.
 *
 * @param text - The text of `study-monthly.yml`.
 * @returns The findings.
 */
export function studyReportsFailure(text: string): string[] {
  const jobs = jobsOf(text);
  const report = jobs.get("report");
  if (report === undefined) return ["the workflow has no job report"];
  const findings: string[] = [];
  if (!report.some((l) => /^ {4}if:\s*failure\(\)$/.test(l))) findings.push("the job report does not have if: failure()");
  if (!report.some((l) => /\bgh\s+issue\s+create\b/.test(l))) findings.push("the job report does not run gh issue create");
  const needs = report.find((l) => /^ {4}needs:/.test(l));
  const listed = new Set((/\[(.*)\]/.exec(needs ?? "")?.[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""));
  for (const name of jobs.keys()) if (name !== "report" && !listed.has(name)) findings.push(`the job report does not need the job ${name}`);
  return findings;
}

/**
 * This function checks the rule "name each package by its contents". No `package.json` takes `RESERVED_NAME`.
 *
 * @param files - The path and the text of each `package.json`.
 * @returns The findings.
 */
export function noReservedName(files: readonly { path: string; text: string }[]): string[] {
  return files.filter((f) => (JSON.parse(f.text) as { name?: unknown }).name === RESERVED_NAME).map((f) => `${f.path}: the package takes the name ${RESERVED_NAME}`);
}

/**
 * This function gives the path and the text of the root `package.json` and of each package in `packages`.
 *
 * @param root - The root of the repository.
 */
export function packageFiles(root: string): { path: string; text: string }[] {
  const paths = ["package.json", ...readdirSync(join(root, "packages"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `packages/${d.name}/package.json`)];
  return paths.flatMap((path) => {
    try {
      return [{ path, text: readFileSync(join(root, path), "utf8") }];
    } catch {
      return [];
    }
  });
}
