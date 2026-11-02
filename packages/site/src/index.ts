/** The status of a roadmap item, as the page shows it. */
export type StatusKind = "done" | "progress" | "planned" | "later";

/** One row of the table of `docs/ROADMAP.md`. */
export interface RoadmapItem {
  readonly id: string;
  readonly title: string;
  /** The text of the status cell, for example `done 2026-11-02 (#8)`. */
  readonly status: string;
  readonly kind: StatusKind;
  readonly summary: string;
}

/** One package of the repository, as the page shows it. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** This value is true when the package is not on npm. */
  readonly private: boolean;
}

/** This function gives the kind of a status cell. An unknown text gives `planned`. */
export function statusKind(status: string): StatusKind {
  const text = status.trim().toLowerCase();
  if (text.startsWith("done")) return "done";
  if (text.startsWith("in progress")) return "progress";
  if (text.startsWith("later")) return "later";
  return "planned";
}

/** This function splits a Markdown table row into its cells. An escaped pipe stays in its cell. */
function cells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/**
 * This function reads the items of the first table of a roadmap that has the columns ID, Item and Status.
 * A row with the wrong count of cells throws, so a bad roadmap stops the build.
 */
export function parseRoadmap(markdown: string): RoadmapItem[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    if (!line.trim().startsWith("|")) return false;
    const head = cells(line).map((cell) => cell.toLowerCase());
    return head.includes("id") && head.includes("status");
  });
  if (start < 0) throw new Error("The roadmap has no table with the columns ID and Status.");
  const head = cells(lines[start] ?? "").map((cell) => cell.toLowerCase());
  const column = (name: string): number => head.indexOf(name);
  const items: RoadmapItem[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;
    const row = cells(line);
    if (row.length !== head.length) throw new Error(`The roadmap row "${line}" has ${row.length} cells, not ${head.length}.`);
    const status = row[column("status")] ?? "";
    items.push({
      id: row[column("id")] ?? "",
      title: row[column("item")] ?? "",
      status,
      kind: statusKind(status),
      summary: row[column("summary")] ?? "",
    });
  }
  if (items.length === 0) throw new Error("The roadmap table has no rows.");
  return items;
}

/** This function escapes the text for HTML, and makes each Markdown code span a `code` element. */
export function inlineHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
}
