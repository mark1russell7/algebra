/**
 * The report of a census over files. It reads `.jsonl` files and folders. It adds the commit of algebra and the hash
 * of each input file.
 *
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Tally } from "./census.ts";
import type { Census, SharedEndCounts } from "./census.ts";

/** An input file of a report. */
export interface InputFile {
  readonly path: string;
  readonly sha256: string;
  readonly lines: number;
}

/** The report of a census. */
export interface Report extends Census {
  readonly tool: "@mark1russell7/predicate-census";
  /** The commit of algebra that made the report, or `unknown`. */
  readonly commit: string;
  /** The value is `true` when the work tree of algebra had changes. */
  readonly dirty: boolean | null;
  readonly createdAt: string;
  readonly files: readonly InputFile[];
  readonly totals: Totals;
  readonly assumptions: readonly string[];
  /** The check of the far assumption for each case with far inputs. */
  readonly farCheck: readonly FarCheck[];
}

/** The totals of a report over all cases. */
export interface Totals {
  total: number;
  decided: number;
  undecided: number;
  /** The undecided inputs with the structural filter. */
  undecidedFiltered: number;
  unseen: number;
  unknown: number;
  floatWrong: number;
  /** The float-wrong segment pairs with an end point near the line of the other segment. */
  floatWrongNearCollinear: number;
  readonly sharedEnd: SharedEndCounts;
}

/** The filter of the senders: an input whose value is larger than this filter has no line. */
export const FAR_FILTER = 1e-9;

/**
 * The check of the far assumption of one case. The far inputs have no line, so the census uses the largest bound
 * width of the seen inputs of the case. The check holds when that width is smaller than `FAR_FILTER`.
 */
export interface FarCheck {
  readonly case: string;
  readonly far: number;
  readonly maxWidth: number;
  readonly maxScale: number;
  readonly filter: number;
  readonly holds: boolean;
}

function farChecks(census: Census): FarCheck[] {
  const out: FarCheck[] = [];
  for (const c of census.cases) {
    const groups = census.groups.filter((g) => g.case === c.case);
    const far = groups.filter((g) => g.source === "far").reduce((k, g) => k + g.total, 0);
    if (far === 0) continue;
    const seen = groups.filter((g) => g.source === "lines");
    const maxWidth = Math.max(0, ...seen.map((g) => g.maxWidth));
    const maxScale = Math.max(0, ...seen.map((g) => g.maxScale));
    out.push({ case: c.case, far, maxWidth, maxScale, filter: FAR_FILTER, holds: maxWidth < FAR_FILTER });
  }
  return out;
}

/** The assumptions of each report. */
export const ASSUMPTIONS: readonly string[] = [
  "A total of a count line counts each test of its kind, the near tests too. The far tests are total - near.",
  "The sender writes a line for each near test. Without a near field, near is the weight of the lines.",
  "The census counts the far tests as decided and not float-wrong, without a check. farCheck examines this assumption.",
  "A truncated case has near - seen unseen tests. They are in total and in unseen, not in decided and not in undecided.",
  "nearCheck compares each near field with the weight of the lines. A case that is not truncated needs equal values.",
  "A segment-box test follows geom.segmentHitsRect of highways: the clipped part must be longer than eps. Without eps, eps is zero.",
  "The corners x + w and y + h of a box are exact sums, not float sums.",
  "A box pair overlaps when the margin minus eps is larger than zero on each axis. Without eps, eps is zero.",
  "The structural filter gives the sign 0 to an orientation with two equal points. undecidedFiltered uses it.",
  "A line without floatAnswer gets the float answer of the census: the same sign rule with plain float values.",
  "A point-side test with a truth value as its float answer is not compared with the exact sign.",
];

/**
 * This function finds the `.jsonl` files of a list of paths. A folder gives each `.jsonl` file under it.
 *
 * @param paths - The files and the folders.
 * @returns The files, sorted, each one time.
 */
export function findFiles(paths: readonly string[]): string[] {
  const out = new Set<string>();
  const walk = (p: string): void => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    } else if (p.endsWith(".jsonl")) {
      out.add(p);
    }
  };
  for (const p of paths) walk(p);
  return [...out].sort();
}

function git(args: readonly string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/**
 * This function makes the report of a census over files and folders.
 *
 * @param paths - The `.jsonl` files and the folders.
 * @param repo - A folder in the work tree of algebra, for the commit.
 * @returns The report.
 */
export function censusOfFiles(paths: readonly string[], repo: string): Report {
  const tally = new Tally();
  const files: InputFile[] = [];
  for (const file of findFiles(paths)) {
    const bytes = fs.readFileSync(file);
    const name = path.relative(process.cwd(), file).split(path.sep).join("/");
    const lines = bytes.toString("utf8").split(/\r?\n/);
    lines.forEach((text, i) => tally.addText(name, i + 1, text));
    files.push({ path: name, sha256: createHash("sha256").update(bytes).digest("hex"), lines: lines.filter((l) => l.trim() !== "").length });
  }
  const census = tally.result();
  const totals: Totals = {
    total: 0,
    decided: 0,
    undecided: 0,
    undecidedFiltered: 0,
    unseen: 0,
    unknown: 0,
    floatWrong: 0,
    floatWrongNearCollinear: 0,
    sharedEnd: { total: 0, undecided: 0, undecidedFiltered: 0 },
  };
  for (const c of census.cases) {
    totals.total += c.total;
    totals.decided += c.decided;
    totals.undecided += c.undecided;
    totals.undecidedFiltered += c.undecidedFiltered;
    totals.unseen += c.unseen;
    totals.unknown += c.unknown;
    totals.floatWrong += c.floatWrong;
    totals.floatWrongNearCollinear += c.floatWrongNearCollinear;
    totals.sharedEnd.total += c.sharedEnd.total;
    totals.sharedEnd.undecided += c.sharedEnd.undecided;
    totals.sharedEnd.undecidedFiltered += c.sharedEnd.undecidedFiltered;
  }
  const status = git(["status", "--porcelain"], repo);
  return {
    tool: "@mark1russell7/predicate-census",
    commit: git(["rev-parse", "HEAD"], repo) ?? "unknown",
    dirty: status === null ? null : status !== "",
    createdAt: new Date().toISOString(),
    files,
    totals,
    assumptions: ASSUMPTIONS,
    farCheck: farChecks(census),
    ...census,
  };
}
