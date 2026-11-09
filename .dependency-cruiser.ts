// The import boundaries of the workspace (@mark1russell7/boundaries): another package is imported only
// through an entry of its package.json. The rules of the layers (docs/LAYERS.md) come from scripts/layers.ts.
// Start the check with `pnpm check:boundaries`.
import { boundaries, type Config } from "@mark1russell7/boundaries";
import { layerRules, workspaceManifests } from "./scripts/layers.ts";

const config: Config = boundaries(import.meta.dirname, { forbidden: layerRules(workspaceManifests(import.meta.dirname)) });
export default config;
