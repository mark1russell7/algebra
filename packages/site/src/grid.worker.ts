/**
 * The Web Worker of the explorer. It fills the grid in bands of rows and sends each band to the page. A new job stops
 * the old job at the end of its current band.
 *
 * @packageDocumentation
 */
import { buildForm, fillRows } from "./grid.ts";
import type { GridJob } from "./grid.ts";

/** A message from the page: a job and its number. */
export interface JobMessage {
  readonly id: number;
  readonly job: GridJob;
}

/** A message to the page: one band of rows of a job, or the fault of the job. */
export type BandMessage =
  | { readonly id: number; readonly j0: number; readonly j1: number; readonly codes: Uint8Array; readonly ms: number }
  | { readonly id: number; readonly error: string };

/** The count of rows in one band. */
const BAND = 8;

let current = 0;
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<JobMessage>) => void) | null;
  postMessage(message: BandMessage, transfer?: Transferable[]): void;
};

/** This function gives control back to the event loop, so that a new job can arrive. */
const pause = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function run({ id, job }: JobMessage): Promise<void> {
  current = id;
  try {
    const form = buildForm(job.form);
    const n = job.view.n;
    const start = performance.now();
    for (let j0 = 0; j0 < n; j0 += BAND) {
      if (current !== id) return;
      const j1 = Math.min(n, j0 + BAND);
      const codes = new Uint8Array(n * (j1 - j0));
      fillRows(job, form, j0, j1, codes);
      scope.postMessage({ id, j0, j1, codes, ms: performance.now() - start }, [codes.buffer]);
      await pause();
    }
  } catch (e) {
    scope.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
}

scope.onmessage = (event) => {
  void run(event.data);
};
