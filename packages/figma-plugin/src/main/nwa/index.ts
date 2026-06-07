import type { ComponentMapping } from "../../shared/types";
import { uint8ToBase64 } from "../../shared/util/base64";
import { decodeUtf8 } from "../../shared/util/base64";
import { slugify } from "../../shared/util/slugify";
import type { NwaBundle, NwaFile } from "./ctx";
import { createCtx, NWA_VERSION } from "./ctx";
import { buildNwaNode } from "./node";
import { buildReadme } from "./readme";
import { binaryFile, dumpYaml, textFile } from "./yaml";

export { slugify } from "../../shared/util/slugify";
export type { NwaBundle, NwaFile } from "./ctx";

export async function buildNwaBundle(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>
): Promise<NwaBundle> {
  const ctx = createCtx(mappings);

  const frameNode = await buildNwaNode(
    root,
    ctx,
    /*inComponentDef*/ false,
    /*isRoot*/ true
  );

  const files: Record<string, NwaFile> = {};
  const fileList: string[] = [];

  // ---- frame.yaml ---------------------------------------------------------
  files["frame.yaml"] = textFile(dumpYaml([frameNode]));
  fileList.push("frame.yaml");

  // ---- components/*.yaml --------------------------------------------------
  const componentEntries = Array.from(ctx.components.entries()).sort((a, b) =>
    a[1].slug.localeCompare(b[1].slug)
  );
  for (const [, comp] of componentEntries) {
    const path = `components/${comp.slug}.yaml`;
    files[path] = textFile(dumpYaml([comp.payload]));
    fileList.push(path);
  }

  // ---- styles/*.yaml ------------------------------------------------------
  files["styles/fills.yaml"] = textFile(
    dumpYaml(Array.from(ctx.fills.values()).map((v) => v.entry))
  );
  files["styles/strokes.yaml"] = textFile(
    dumpYaml(Array.from(ctx.strokes.values()).map((v) => v.entry))
  );
  files["styles/effects.yaml"] = textFile(
    dumpYaml(Array.from(ctx.effects.values()).map((v) => v.entry))
  );
  files["styles/typography.yaml"] = textFile(
    dumpYaml(Array.from(ctx.typography.values()).map((v) => v.entry))
  );
  fileList.push(
    "styles/fills.yaml",
    "styles/strokes.yaml",
    "styles/effects.yaml",
    "styles/typography.yaml"
  );

  // ---- icons/*.svg --------------------------------------------------------
  const iconPaths = Array.from(ctx.icons.keys()).sort();
  for (const filename of iconPaths) {
    const path = `icons/${filename}`;
    const bytes = ctx.icons.get(filename)!;
    files[path] = textFile(decodeUtf8(bytes));
    fileList.push(path);
  }

  // ---- images/ ------------------------------------------------------------
  files["images/.placeholder"] = textFile("");
  fileList.push("images/.placeholder");

  // ---- previews/section.png -----------------------------------------------
  try {
    const preview = await (root as unknown as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    files["previews/section.png"] = binaryFile(uint8ToBase64(preview));
    fileList.push("previews/section.png");
  } catch {
    /* ignore */
  }

  // ---- manifest.yaml + README.md ------------------------------------------
  const exportDate = new Date().toISOString();
  const manifest = {
    version: NWA_VERSION,
    exportDate,
    files: ["frame.yaml", ...fileList.filter((f) => f !== "frame.yaml")],
  };
  files["manifest.yaml"] = textFile(dumpYaml(manifest));
  files["README.md"] = textFile(buildReadme(manifest, ctx));

  const rootSlug = slugify(root.name) || "design";

  return {
    rootSlug,
    manifest,
    files,
    stats: {
      nodes: ctx.nodeCount,
      uniqueComponents: ctx.components.size,
      fills: ctx.fills.size,
      strokes: ctx.strokes.size,
      effects: ctx.effects.size,
      typography: ctx.typography.size,
      icons: ctx.icons.size,
      matchedComponents: ctx.matchedCount,
    },
  };
}
