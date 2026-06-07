import { UI_SIZE } from "../shared/constants";

// The plugin runs in two contexts:
//   - Figma Design (figma.mode === "default"): show the full iframe UI
//     immediately so the user gets all tabs + Component Records Manager.
//   - Dev Mode (figma.mode === "codegen"): Figma forbids calling
//     figma.showUI() on plugin load. Register a codegen handler that puts a
//     small "Open plugin window" hint + propertyMenu in the right inspect
//     panel. Clicking it fires "preferenceschanged" and only THEN can we
//     legally call figma.showUI() to open the full iframe.
export function showFullUi(): void {
  figma.showUI(__html__, { ...UI_SIZE, themeColors: true });
}

export function registerCodegenLauncher(): void {
  const codegen = (figma as unknown as {
    codegen?: {
      on: (
        event: "generate" | "preferenceschange",
        cb: (e: never) => unknown
      ) => void;
    };
  }).codegen;
  if (!codegen) return;

  codegen.on(
    "generate",
    (() => {
      return [
        {
          title: "Figma Clarity",
          code:
            "// Open the inspect panel's settings menu and pick\n" +
            "// 'Open plugin window' to launch the full UI:\n" +
            "//   - Connection / handshake with VS Code\n" +
            "//   - Export / Build nwa bundle / Send / Download\n" +
            "//   - Tokens, Assets, Report\n" +
            "//   - Settings -> Component Records Manager",
          language: "PLAINTEXT",
        },
      ];
    }) as never
  );

  codegen.on(
    "preferenceschange",
    ((event: { propertyName: string }) => {
      if (event.propertyName === "open-plugin") {
        try {
          showFullUi();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.notify(`Failed to open plugin window: ${message}`, {
            error: true,
          });
        }
      }
    }) as never
  );
}

export function bootstrap(): void {
  if (figma.mode === "codegen") {
    registerCodegenLauncher();
  } else {
    showFullUi();
  }
}
