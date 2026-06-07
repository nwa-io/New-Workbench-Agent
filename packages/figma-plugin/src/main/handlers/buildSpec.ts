import { buildNwaBundle } from "../nwa";
import { postToUi } from "../postbox";
import { requireSelectedNode } from "../selection/state";
import { buildCompressedSpec } from "../spec/compressed";
import { buildLeanSpec } from "../spec/lean";
import {
  loadComponentCatalog,
  loadTokenCatalog,
} from "../storage/catalogs";
import { loadMappings } from "../storage/mappings";

export async function handleBuildSpec(): Promise<void> {
  const node = requireSelectedNode();
  const [mappings, components, tokens] = await Promise.all([
    loadMappings(),
    loadComponentCatalog(),
    loadTokenCatalog(),
  ]);
  postToUi({ type: "PROGRESS", stage: "Building compressed spec…" });
  const spec = await buildCompressedSpec(node, mappings, components, tokens);
  const lean = buildLeanSpec(spec);
  postToUi({ type: "PROGRESS", stage: "Building nwa export bundle…" });
  const nwa = await buildNwaBundle(node, mappings);
  postToUi({ type: "SPEC_READY", spec, lean, nwa });
}
