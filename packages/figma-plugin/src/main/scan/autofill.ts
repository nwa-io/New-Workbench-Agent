import type {
  AutofillSuggestion,
  ComponentMapping,
  FEComponentCatalogItem,
} from "../../shared/types";
import { diceCoefficient } from "../../shared/util/dice";
import { normaliseName } from "../../shared/util/normaliseName";
import { matchMapping } from "../matcher";
import { readStickyMappingId } from "../storage/nodeData";
import { tryGetMain, walkAsync } from "./walk";

export async function autofillSuggestions(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>
): Promise<AutofillSuggestion[]> {
  const seen = new Map<string, AutofillSuggestion>();
  await walkAsync(root, async (n) => {
    if (n.type !== "INSTANCE") return;
    const mc = await tryGetMain(n as InstanceNode);
    const figmaName = mc?.name ?? n.name;
    const key = mc?.key ?? figmaName;
    if (seen.has(key)) return;

    const sticky = readStickyMappingId(n);
    const exact = matchMapping(
      {
        figmaName,
        figmaComponentKey: mc?.key,
        figmaNodeId: n.id,
        stickyMappingId: sticky,
      },
      mappings,
      components
    );

    const ranked: AutofillSuggestion["candidates"] = [];
    if (exact) {
      ranked.push({
        codeComponent: exact.mapping.codeComponent,
        codeFilePath: exact.mapping.codeFilePath,
        confidence: exact.confidence,
        reason: exact.reason,
      });
    }
    for (const c of components) {
      const cn = normaliseName(c.componentName);
      const target = normaliseName(figmaName);
      const sim = diceCoefficient(cn, target);
      if (sim < 0.4) continue;
      if (ranked.some((r) => r.codeComponent === c.componentName)) continue;
      ranked.push({
        codeComponent: c.componentName,
        codeFilePath: c.filePath,
        confidence: 0.3 + sim * 0.5,
        reason: `catalog-fuzzy(${sim.toFixed(2)})`,
      });
    }
    ranked.sort((a, b) => b.confidence - a.confidence);

    seen.set(key, {
      figmaName,
      figmaNodeId: n.id,
      figmaComponentKey: mc?.key,
      candidates: ranked.slice(0, 3),
    });
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.figmaName.localeCompare(b.figmaName)
  );
}
