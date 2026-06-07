import { el } from "../../dom/el";
import { figmaNameDropdown, recFigmaName, recFigmaNameHelp } from "./elements";

// Cache of component names in the Figma file (powers the Figma Name dropdown).
let figmaComponentNames: string[] = [];
// Index of the keyboard-highlighted option in the open dropdown (-1 = none).
let comboActiveIndex = -1;

export function setFigmaComponentNames(names: string[]): void {
  figmaComponentNames = names;
  renderFigmaNameOptions();
}

export function renderFigmaNameOptions(): void {
  recFigmaNameHelp.textContent = figmaComponentNames.length
    ? `Type to search ${figmaComponentNames.length} components in this Figma file.`
    : "The name of the component as it appears in Figma";
}

function filterFigmaNames(query: string): string[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? figmaComponentNames.filter((n) => n.toLowerCase().includes(q))
    : figmaComponentNames;
  return list.slice(0, 200);
}

export function showFigmaNameDropdown(): void {
  const matches = filterFigmaNames(recFigmaName.value);
  comboActiveIndex = -1;
  figmaNameDropdown.innerHTML = "";

  if (!figmaComponentNames.length) {
    figmaNameDropdown.append(
      el("div", { class: "combo-empty" }, "No components found in this file.")
    );
    figmaNameDropdown.hidden = false;
    return;
  }
  if (!matches.length) {
    figmaNameDropdown.append(
      el(
        "div",
        { class: "combo-empty" },
        `No component matches "${recFigmaName.value.trim()}".`
      )
    );
    figmaNameDropdown.hidden = false;
    return;
  }

  for (const name of matches) {
    const opt = el("div", { class: "combo-option", title: name }, name);
    // mousedown (not click) fires before the input's blur — preventDefault
    // keeps focus so the value assignment isn't lost.
    opt.addEventListener("mousedown", (e) => {
      e.preventDefault();
      recFigmaName.value = name;
      hideFigmaNameDropdown();
    });
    figmaNameDropdown.append(opt);
  }
  figmaNameDropdown.hidden = false;
}

export function hideFigmaNameDropdown(): void {
  figmaNameDropdown.hidden = true;
  comboActiveIndex = -1;
}

export function moveComboActive(delta: number): void {
  const opts = Array.from(
    figmaNameDropdown.querySelectorAll<HTMLDivElement>(".combo-option")
  );
  if (!opts.length) return;
  opts.forEach((o) => o.classList.remove("active"));
  comboActiveIndex = (comboActiveIndex + delta + opts.length) % opts.length;
  const active = opts[comboActiveIndex];
  active.classList.add("active");
  active.scrollIntoView({ block: "nearest" });
}

export function getComboActiveIndex(): number {
  return comboActiveIndex;
}
