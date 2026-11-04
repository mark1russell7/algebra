/**
 * The probe of the home page. The site check of the Pages workflow starts it in a browser at each width, before the
 * deploy. A failed check stops the deploy.
 *
 * The probe drives the three instruments of the page. The explorer tests a grid in a worker, the evaluators compare a
 * typed expression, and the cost section changes its plan with the slider.
 *
 * The site check reads this TypeScript file directly. It removes the types and the `export` line, and it starts the
 * result as the body of an async function.
 */

// The site check gives these helpers to the probe.
declare const check: (name: string, ok: unknown, detail?: unknown) => boolean;
declare const until: <T>(fn: () => T | Promise<T>, ms?: number) => Promise<T>;
declare const $: (selector: string) => Element | null;
declare const $$: (selector: string) => Element[];
declare const type: (target: string | Element, text: string) => void;
declare const click: (target: string | Element) => void;

const text = (selector: string): string => $(selector)?.textContent ?? "";
const field = <T extends Element>(selector: string): T => {
  const el = $(selector);
  if (el === null) throw new Error(`The page has no ${selector}.`);
  return el as T;
};
/** This function gives the number of a tile, without the spaces that separate its thousands. */
const tile = (kind: string): number => Number(text(`#ex-tiles .tile.${kind} .num`).replace(/\s/g, ""));
const gridDone = (): boolean => text("#ex-tiles").includes("in a worker") && !text("#ex-tiles").includes("so far");

// The explorer: the worker finishes the grid of the first input, and the page counts the wrong float signs.
check("the explorer has the presets and the records of the census", (await until(() => $$("#ex-preset option").length >= 8)) === true, $$("#ex-preset option").length);
check("the worker finishes the grid of the first input", await until(gridDone, 30000), text("#ex-tiles").slice(0, 200));
check("the first input has float signs that are wrong", tile("bad") > 0, text("#ex-tiles").slice(0, 200));

click("#ex-zoom-out");
check("a larger step changes the step of the grid", await until(() => text("#ex-step") === "2^1 ulps"), text("#ex-step"));
check("the worker finishes the grid of the larger step", await until(gridDone, 30000), text("#ex-tiles").slice(0, 200));

const firstNote = text("#ex-note");
const preset = field<HTMLSelectElement>("#ex-preset");
preset.selectedIndex = preset.options.length - 1;
preset.dispatchEvent(new Event("change", { bubbles: true }));
check("another input gives another note", await until(() => text("#ex-note") !== firstNote && text("#ex-note") !== ""), text("#ex-note").slice(0, 200));
check("the worker finishes the grid of that input", await until(gridDone, 30000), text("#ex-tiles").slice(0, 200));

// The evaluators: the example (a + b) - a shows a float value of 0, and the exact value is not 0.
click("#pg-presets button");
const values = (): string[] => $$("#pg-results .ev-value code").map((value) => value.textContent ?? "");
check("the example gives a value from each of the five evaluators", await until(() => values().length >= 5), values());
check("the float value of the example is 0", values()[0] === "0", values());
check("the exact value of the example is not 0", values().length >= 5 && values()[4] !== "0", values());
check("the page says that the float sign is wrong", $("#pg-results .pg-verdict.bad") !== null, text("#pg-results").slice(0, 200));

type("#pg-text", "a * (");
check("a broken expression gives an error", await until(() => text("#pg-error") !== ""), text("#pg-error"));
type("#pg-text", "a + 2");
check("a correct expression clears the error", await until(() => text("#pg-error") === ""), text("#pg-error"));
check("the document holds the typed expression", await until(() => text("#pg-doc").includes('"a"')), text("#pg-doc").slice(0, 200));

// The cost section: a dearer exact stage gives a new expected cost.
const cost = field<HTMLInputElement>("#cost-factor");
const firstCost = text("#cost-summary");
check("the cost section starts with a plan", firstCost.includes("ns expected"), firstCost);
cost.value = "6";
cost.dispatchEvent(new Event("input", { bubbles: true }));
check("the slider shows its factor", await until(() => text("#cost-factor-out") === "× 64"), text("#cost-factor-out"));
check("the factor changes the cost of the plan", await until(() => text("#cost-summary") !== firstCost), text("#cost-summary"));
check("the stages of the plan have rows", $$("#cost-stages li").length > 0, $$("#cost-stages li").length);

export {};
