import type { DesignTokenRef } from "../../../shared/types";
import { $ } from "../../dom/$";
import { el } from "../../dom/el";
import { badge } from "../../helpers/badge";

const tokenList = $<HTMLDivElement>("token-list");
const tokenCountEl = $<HTMLSpanElement>("token-count");

export function renderTokens(tokens: DesignTokenRef[]): void {
  tokenList.innerHTML = "";
  tokenCountEl.textContent = String(tokens.length);
  if (!tokens.length) {
    tokenList.append(
      el(
        "div",
        { class: "empty" },
        "No tokens found. Select a frame — tokens are extracted on scan."
      )
    );
    return;
  }
  // Mapped tokens first, then by usage count.
  const sorted = tokens.slice().sort((a, b) => {
    if (!!a.codeTokenName !== !!b.codeTokenName)
      return a.codeTokenName ? -1 : 1;
    return b.usageCount - a.usageCount;
  });
  for (const t of sorted.slice(0, 200)) {
    const b = t.codeTokenName
      ? badge(`→ ${t.codeTokenName}`, "ok")
      : badge("no code mapping", "warn");
    tokenList.append(
      el(
        "div",
        { class: "card" },
        el("div", { class: "card-title" }, t.figmaTokenName, " ", b),
        el(
          "div",
          { class: "card-sub" },
          `type: ${t.type} · usage: ${t.usageCount}` +
            (t.codeTokenPath ? ` · file: ${t.codeTokenPath}` : "")
        )
      )
    );
  }
  if (sorted.length > 200) {
    tokenList.append(
      el("div", { class: "card-sub" }, `… and ${sorted.length - 200} more`)
    );
  }
}
