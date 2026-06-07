import type {
  FEComponentCatalogItem,
  FETokenCatalogItem,
} from "../../shared/types";
import { diceCoefficient } from "../../shared/util/dice";
import { normaliseName } from "../../shared/util/normaliseName";

export interface CatalogMatch {
  item: FEComponentCatalogItem;
  score: number;
  reason: string;
}

export function bestCatalogMatch(
  figmaName: string,
  components: ReadonlyArray<FEComponentCatalogItem>
): CatalogMatch | null {
  if (!components.length) return null;
  const target = normaliseName(figmaName);
  let best: CatalogMatch | null = null;
  for (const c of components) {
    const candidates = [c.componentName, ...(c.aliases ?? [])];
    for (const cand of candidates) {
      const cn = normaliseName(cand);
      if (!cn) continue;
      let score = 0;
      let reason = "";
      if (cn === target) {
        score = 0.9;
        reason = "catalog-exact";
      } else if (target.includes(cn) || cn.includes(target)) {
        score = 0.7;
        reason = "catalog-substring";
      } else {
        const sim = diceCoefficient(cn, target);
        if (sim >= 0.6) {
          score = 0.4 + sim * 0.4;
          reason = `catalog-fuzzy(${sim.toFixed(2)})`;
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { item: c, score, reason };
      }
    }
  }
  return best;
}

export function matchTokenName(
  figmaName: string,
  catalog: ReadonlyArray<FETokenCatalogItem>
): { name: string; filePath?: string; score: number } | null {
  if (!catalog.length) return null;
  const target = normaliseName(figmaName);
  let best: { name: string; filePath?: string; score: number } | null = null;
  for (const t of catalog) {
    const sim = diceCoefficient(normaliseName(t.name), target);
    if (sim < 0.55) continue;
    if (!best || sim > best.score) {
      best = { name: t.name, filePath: t.filePath, score: sim };
    }
  }
  return best;
}
