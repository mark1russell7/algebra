import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inlineHtml, parseRoadmap, statusKind } from "./index.ts";

const table = [
  "# Roadmap",
  "",
  "| ID | Item | Status | Summary |",
  "| --- | --- | --- | --- |",
  "| A1 | One | done 2026-11-02 (#8) | The `x` kind. |",
  "| A2 | Two | in progress | A \\| B. |",
  "| A7 | Seven | later | Later. |",
  "",
  "Text after the table.",
].join("\n");

describe("parseRoadmap", () => {
  it("reads each row of the table", () => {
    const items = parseRoadmap(table);
    expect(items.map((item) => [item.id, item.kind])).toEqual([
      ["A1", "done"],
      ["A2", "progress"],
      ["A7", "later"],
    ]);
    expect(items[1]?.summary).toBe("A | B.");
  });

  it("throws on a row with the wrong count of cells", () => {
    expect(() => parseRoadmap(table.replace("| A7 | Seven | later | Later. |", "| A7 | Seven |"))).toThrow(/2 cells/);
  });

  it("throws when the file has no table", () => {
    expect(() => parseRoadmap("# Roadmap\n\nNo table.")).toThrow(/no table/);
  });

  it("reads the roadmap of the repository", () => {
    const items = parseRoadmap(readFileSync(new URL("../../../docs/ROADMAP.md", import.meta.url), "utf8"));
    expect(items.length).toBeGreaterThan(10);
    expect(items.map((item) => item.id)).toContain("A13");
  });
});

describe("statusKind", () => {
  it("gives planned to an unknown status", () => {
    expect(statusKind("not started")).toBe("planned");
  });
});

describe("inlineHtml", () => {
  it("escapes the text and makes the code spans", () => {
    expect(inlineHtml("a < b and `c`")).toBe("a &lt; b and <code>c</code>");
  });
});
