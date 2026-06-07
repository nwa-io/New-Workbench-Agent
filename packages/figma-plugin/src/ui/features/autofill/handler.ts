import type {
  AutofillSuggestion,
  ComponentMapping,
} from "../../../shared/types";
import { send } from "../../postbox";
import { state } from "../../state";
import { isSocketOpen, wsSend } from "../connection/socket";
import { setExportStatus } from "../export/status";
import { findInProjectMappings } from "../mappings/projectMappings";

export function handleAutofill(suggestions: AutofillSuggestion[]): void {
  if (!suggestions.length) {
    setExportStatus("Auto-Fill found no INSTANCE nodes in selection.", "warn");
    return;
  }

  // P0 — Restore confirmed project mappings (no confidence threshold; the
  // user already vouched for them in a previous session).
  // P-auto — Apply fresh catalog suggestions ≥85% confidence.
  // Skip — Anything already mapped in local clientStorage.
  let restored = 0;
  let applied = 0;
  let skipped = 0;

  for (const s of suggestions) {
    const alreadyLocal = state.mappings.some(
      (m) =>
        m.figmaName === s.figmaName ||
        (m.figmaComponentKey && m.figmaComponentKey === s.figmaComponentKey)
    );
    if (alreadyLocal) {
      skipped++;
      continue;
    }

    const projectConfirmed = findInProjectMappings(s);
    if (projectConfirmed && projectConfirmed.source === "confirmed") {
      const stamped: ComponentMapping = {
        ...projectConfirmed,
        figmaNodeId: s.figmaNodeId,
        confidence: 1,
        source: "confirmed",
        updatedAt: new Date().toISOString(),
      };
      send({ type: "SAVE_MAPPING", mapping: stamped });
      // Forward to VS Code so the .project mapping picks up the new
      // figmaNodeId of this layout's instance.
      if (isSocketOpen()) {
        wsSend({ type: "SAVE_MAPPING", mapping: stamped });
      }
      restored++;
      continue;
    }

    const top = s.candidates[0];
    if (!top || top.confidence < 0.85) continue;

    const next: ComponentMapping = {
      id: `auto_${Date.now()}_${applied}`,
      figmaName: s.figmaName,
      figmaComponentKey: s.figmaComponentKey,
      figmaNodeId: s.figmaNodeId,
      codeComponent: top.codeComponent,
      codeFilePath: top.codeFilePath,
      importType: "named",
      importName: top.codeComponent,
      confidence: top.confidence,
      source: "auto-suggested",
      updatedAt: new Date().toISOString(),
    };
    send({ type: "SAVE_MAPPING", mapping: next });
    if (isSocketOpen()) {
      wsSend({ type: "SAVE_MAPPING", mapping: next });
    }
    applied++;
  }

  const unmatched = suggestions.length - restored - applied - skipped;
  const lines: string[] = [
    `Auto-Fill scanned ${suggestions.length} unique instance${suggestions.length === 1 ? "" : "s"}.`,
  ];
  if (restored) {
    lines.push(
      `✓ Restored ${restored} confirmed mapping${restored === 1 ? "" : "s"} from project.`
    );
  }
  if (applied) {
    lines.push(
      `✓ Auto-applied ${applied} new high-confidence suggestion${applied === 1 ? "" : "s"} (≥85%).`
    );
  }
  if (skipped) {
    lines.push(`  ${skipped} already mapped locally (skipped).`);
  }
  if (unmatched) {
    lines.push(
      `  ${unmatched} unmatched — open the unmatched list and map manually.`
    );
  }
  for (const s of suggestions.slice(0, 10)) {
    const top = s.candidates[0];
    const projectHit = findInProjectMappings(s);
    if (projectHit) {
      lines.push(
        `  • ${s.figmaName} → ${projectHit.codeComponent} (project · sticky)`
      );
    } else if (!top) {
      lines.push(`  • ${s.figmaName} → (no candidate)`);
    } else {
      lines.push(
        `  • ${s.figmaName} → ${top.codeComponent} (${Math.round(top.confidence * 100)}% · ${top.reason})`
      );
    }
  }
  if (suggestions.length > 10) {
    lines.push(`  … and ${suggestions.length - 10} more`);
  }
  setExportStatus(
    lines.join("\n"),
    restored + applied > 0 ? "ok" : "warn"
  );
}
