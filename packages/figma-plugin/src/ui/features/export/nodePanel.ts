import type { SelectionTreeNode } from "../../../shared/types";
import { el } from "../../dom/el";
import { iconSvg } from "../../dom/icons";
import { findMappingForTreeNode } from "../mappings/active";
import {
  codeOptionsForNode,
  customPropertySummary,
  optionFromMapping,
  type CodeComponentOption,
} from "../mappings/options";
import { exportWorkspaceEl, treeNodePanelEl } from "./elements";
import { openTreeNodeRecordModal, saveTreeNodeMapping } from "./saveTreeMapping";

export function renderTreeNodePanel(node: SelectionTreeNode | null): void {
  treeNodePanelEl.innerHTML = "";
  exportWorkspaceEl.classList.toggle("with-node", !!node);
  treeNodePanelEl.hidden = !node;
  if (!node) {
    treeNodePanelEl.append(
      el(
        "div",
        { class: "node-panel-empty" },
        "Select a node from the tree to map it to a code component."
      )
    );
    return;
  }

  const mapping = findMappingForTreeNode(node);
  const options = codeOptionsForNode(node);
  const mappedOption = mapping ? optionFromMapping(mapping) : null;
  const optionMap = new Map<string, CodeComponentOption>();
  for (const option of options) {
    optionMap.set(option.key, option);
  }
  if (mappedOption && !optionMap.has(mappedOption.key)) {
    optionMap.set(mappedOption.key, mappedOption);
  }

  // Searchable combobox over the same option set as the old <select> — wraps
  // an input + a filtered dropdown that matches the Figma Name autocomplete
  // pattern used in the record modal.
  let selectedKey: string = mappedOption?.key ?? "";
  const combo = el("div", { class: "combo" }) as HTMLDivElement;
  const search = el("input", {
    type: "text",
    placeholder:
      optionMap.size > 0
        ? `Search ${optionMap.size} component${optionMap.size === 1 ? "" : "s"} by name or path…`
        : "No code components available yet",
    autocomplete: "off",
    spellcheck: "false",
  }) as HTMLInputElement;
  if (optionMap.size === 0) {
    search.disabled = true;
  }
  if (mappedOption) {
    search.value = mappedOption.componentName;
  }
  const dropdown = el("div", {
    class: "combo-dropdown",
    hidden: true,
  }) as HTMLDivElement;
  combo.append(search, dropdown);

  const codeComponentValue = el(
    "div",
    {
      class: `node-panel-value${mapping?.codeComponent ? "" : " missing"}`,
    },
    mapping?.codeComponent ?? "Not specified"
  );
  const codePathValue = el(
    "div",
    {
      class: `node-panel-value${mapping?.codeFilePath ? "" : " missing"}`,
    },
    mapping?.codeFilePath ?? "Not specified"
  );
  const customValue = el(
    "div",
    {
      class: `node-panel-value${mapping ? "" : " missing"}`,
    },
    customPropertySummary(mapping)
  );

  const saveBtn = el(
    "button",
    {
      class: "btn btn-gradient full",
      disabled: !selectedKey,
      onclick: () => {
        const option = optionMap.get(selectedKey);
        if (option) saveTreeNodeMapping(node, option);
      },
    },
    mapping ? "Update Mapping" : "Create Mapping"
  );

  const allOptions = Array.from(optionMap.values());
  let activeIdx = -1;

  const applyOption = (option: CodeComponentOption | undefined): void => {
    selectedKey = option?.key ?? "";
    saveBtn.disabled = !option;
    codeComponentValue.textContent = option?.componentName ?? "Not specified";
    codeComponentValue.classList.toggle("missing", !option);
    codePathValue.textContent = option?.filePath || "Not specified";
    codePathValue.classList.toggle("missing", !option?.filePath);
  };

  const filterOptions = (query: string): CodeComponentOption[] => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions.slice(0, 200);
    return allOptions
      .filter(
        (o) =>
          o.componentName.toLowerCase().includes(q) ||
          (o.filePath || "").toLowerCase().includes(q)
      )
      .slice(0, 200);
  };

  const renderDropdown = (): void => {
    dropdown.innerHTML = "";
    activeIdx = -1;
    if (allOptions.length === 0) {
      dropdown.append(
        el(
          "div",
          { class: "combo-empty" },
          "No code components yet. Run a catalog scan from VS Code, or add records manually."
        )
      );
      dropdown.hidden = false;
      return;
    }
    const matches = filterOptions(search.value);
    if (matches.length === 0) {
      dropdown.append(
        el(
          "div",
          { class: "combo-empty" },
          `No component matches "${search.value.trim()}".`
        )
      );
      dropdown.hidden = false;
      return;
    }
    for (const option of matches) {
      const label = option.filePath
        ? `${option.componentName} — ${option.filePath}`
        : option.componentName;
      const opt = el(
        "div",
        {
          class: `combo-option${option.key === selectedKey ? " active" : ""}`,
          title: label,
          "data-key": option.key,
        },
        label
      );
      // mousedown (not click) keeps the input from blurring before the
      // assignment lands.
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applyOption(option);
        search.value = option.componentName;
        hideDropdown();
      });
      dropdown.append(opt);
    }
    dropdown.hidden = false;
  };

  const hideDropdown = (): void => {
    dropdown.hidden = true;
    activeIdx = -1;
  };

  const moveActive = (delta: number): void => {
    const opts = Array.from(
      dropdown.querySelectorAll<HTMLDivElement>(".combo-option")
    );
    if (!opts.length) return;
    opts.forEach((o) => o.classList.remove("active"));
    activeIdx = (activeIdx + delta + opts.length) % opts.length;
    const active = opts[activeIdx];
    active.classList.add("active");
    active.scrollIntoView({ block: "nearest" });
  };

  search.addEventListener("focus", renderDropdown);
  search.addEventListener("input", renderDropdown);
  search.addEventListener("blur", () => {
    window.setTimeout(hideDropdown, 120);
  });
  search.addEventListener("keydown", (e) => {
    if (dropdown.hidden) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        renderDropdown();
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      const opts =
        dropdown.querySelectorAll<HTMLDivElement>(".combo-option");
      if (activeIdx >= 0 && opts[activeIdx]) {
        e.preventDefault();
        const key = opts[activeIdx].dataset.key ?? "";
        const option = optionMap.get(key);
        if (option) {
          applyOption(option);
          search.value = option.componentName;
        }
        hideDropdown();
      }
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  });

  const recordBtn = el(
    "button",
    {
      class: "btn btn-secondary",
      onclick: () => openTreeNodeRecordModal(node, optionMap.get(selectedKey)),
    },
    mapping ? "Edit Record" : "New Record"
  );

  treeNodePanelEl.append(
    el(
      "div",
      { class: "node-summary" },
      el(
        "div",
        { class: "node-summary-icon" },
        iconSvg("M3 3.5h10v9H3z", 15)
      ),
      el(
        "div",
        { class: "node-summary-main" },
        el(
          "div",
          { class: "node-summary-name", title: node.name },
          node.name
        ),
        el("div", { class: "node-summary-type" }, node.type)
      )
    ),
    el(
      "div",
      { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Select Code Component"),
      combo
    ),
    el(
      "div",
      { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Code File Path"),
      codePathValue
    ),
    el(
      "div",
      { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Code Component"),
      codeComponentValue
    ),
    el(
      "div",
      { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Custom Properties"),
      customValue
    ),
    el("div", { class: "node-panel-actions" }, recordBtn, saveBtn)
  );
}
