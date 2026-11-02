/**
 * The report of a census over files. It reads `.jsonl` files and folders. It adds the commit of algebra and the hash
 * of each input file.
 *
 * @packageDocumentation
 */
import { execFileSync } from "node:child_process";
import { createHash, type Hash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { Tally } from "./census.ts";
import type { Census, SharedEndCounts, TallyOptions } from "./census.ts";

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
  /** The touch inputs of packing. They are in `decided`. */
  touch: number;
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
  "CALL_SITE_RULES gives the rule of a call site with its own rule: mesh.crossing counts a touch, and physics.outOf gives -1 for a zero sign.",
  "A packing line has the weight times. A packing case line gives far = total - near - touch for each function.",
  "A packing touch input has only values of exactly 0 near. It has no line. The census counts it as decided and not float-wrong.",
  "The census counts the far inputs of packing as decided and not float-wrong. The near rule of packing is 1e-9 times the scale of the inputs.",
  "A packing box pair follows overlap of packing: the float margin min(right) - max(left) of each axis must be larger than tolerance.",
  "The exact answer of a packing box pair compares the exact margin with the float tolerance. The float answer is the answer of packing.",
  "The box a of a packing pair with gap already has the gap on each side. The census reads the boxes as packing gives them.",
  "A packing container test follows checkHard: only a fixed side counts, against x + inset - tolerance or x + w - inset + tolerance.",
  "The exact answer of a container test compares the edge with the exact side. The census float answer has the float sums of packing.",
  "A fixed side of the container with an infinite size gives an unknown line, because JSON gives that size as null.",
  "A packing strip test is the test of edgeRange that the segment has a part in the open strip. The census does not examine the range of xAt.",
  "The packing functions xAt and samePlacements have no exact rule. Their near lines are unknown, with the reason of PACKING_UNMODELED.",
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

/** The size of each read of an input file. Thus a dump of several GB does not become one string. */
const CHUNK = 1 << 24;

/**
 * This function gives each line of a file, in order, from 1. It reads the file in chunks and adds each chunk to the
 * hash. A line can end with `\n` or `\r\n`. The last line has no end.
 */
function forEachLine(file: string, hash: Hash, each: (text: string, lineNo: number) => void): void {
  const fd = fs.openSync(file, "r");
  const decoder = new StringDecoder("utf8");
  const buffer = Buffer.alloc(CHUNK);
  let rest = "";
  let lineNo = 0;
  const emit = (text: string): void => each(text.endsWith("\r") ? text.slice(0, -1) : text, ++lineNo);
  try {
    for (;;) {
      const read = fs.readSync(fd, buffer, 0, CHUNK, null);
      if (read === 0) break;
      const bytes = buffer.subarray(0, read);
      hash.update(bytes);
      const text = rest + decoder.write(bytes);
      let start = 0;
      for (let end = text.indexOf("\n"); end !== -1; end = text.indexOf("\n", start)) {
        emit(text.slice(start, end));
        start = end + 1;
      }
      rest = text.slice(start);
    }
    emit(rest + decoder.end());
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * This function makes the report of a census over files and folders.
 *
 * @param paths - The `.jsonl` files and the folders.
 * @param repo - A folder in the work tree of algebra, for the commit.
 * @param options - The sinks of the records. With a sink, the report has no records in memory.
 * @returns The report.
 */
export function censusOfFiles(paths: readonly string[], repo: string, options: TallyOptions = {}): Report {
  const tally = new Tally(options);
  const files: InputFile[] = [];
  for (const file of findFiles(paths)) {
    const name = path.relative(process.cwd(), file).split(path.sep).join("/");
    const hash = createHash("sha256");
    let count = 0;
    forEachLine(file, hash, (text, lineNo) => {
      if (text.trim() !== "") count++;
      tally.addText(name, lineNo, text);
    });
    files.push({ path: name, sha256: hash.digest("hex"), lines: count });
  }
  const census = tally.result();
  const totals: Totals = {
    total: 0,
    decided: 0,
    undecided: 0,
    undecidedFiltered: 0,
    unseen: 0,
    touch: 0,
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
    totals.touch += c.touch;
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
