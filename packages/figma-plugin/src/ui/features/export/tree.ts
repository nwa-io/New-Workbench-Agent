import type { SelectionTreeNode } from "../../../shared/types";
import { el } from "../../dom/el";
import { eyeIconSvg, starIconSvg } from "../../dom/icons";
import { send } from "../../postbox";
import { openTreeContextMenu } from "../icon-modal/contextMenu";
import { findMappingForTreeNode } from "../mappings/active";
import { selectionTreeEl, treeCountEl } from "./elements";
import { renderTreeNodePanel } from "./nodePanel";
import { findTreeNodeById, treeState } from "./treeState";

export function renderSelectionTree(tree: SelectionTreeNode | null): void {
  selectionTreeEl.innerHTML = "";
  treeState.lastSelectionTree = tree;
  if (!tree) {
    selectionTreeEl.append(
      el("div", { class: "empty" }, "Nothing scanned yet.")
    );
    treeCountEl.textContent = "0";
    treeState.activeTreeNode = null;
    renderTreeNodePanel(null);
    return;
  }
  if (treeState.activeTreeNode) {
    treeState.activeTreeNode = findTreeNodeById(
      tree,
      treeState.activeTreeNode.id
    );
  }
  let count = 0;
  const render = (
    node: SelectionTreeNode,
    depth: number
  ): HTMLElement => {
    count++;
    const hasKids = !!node.children && node.children.length > 0;

    const mapping = findMappingForTreeNode(node);
    const isMapped = node.matched || !!mapping;
    const mappedComponent = node.codeComponent ?? mapping?.codeComponent;

    const dotClass =
      node.type === "TEXT"
        ? "tree-dot text"
        : node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION"
        ? "tree-dot vector"
        : node.isInstance
        ? `tree-dot instance${isMapped ? " matched" : ""}`
        : "tree-dot";

    const caret = el(
      "span",
      {
        class: `tree-caret${hasKids ? "" : " leaf"}`,
      },
      hasKids ? "▾" : ""
    );

    // Eye icon: zoom into the Figma node and flash its purple selection
    // border, then restore the user's previous selection so they keep
    // their working context. `highlight: true` triggers the snap-select-
    // and-restore dance in the main runtime.
    const eyeBtn = el("button", {
      class: "tree-action tree-eye",
      title:
        "Focus on this node in Figma (selection restores after a moment)",
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        send({
          type: "ZOOM_TO_NODE",
          nodeId: node.id,
          preserveSelection: true,
          highlight: true,
        });
      },
    });
    eyeBtn.appendChild(eyeIconSvg());

    // Green star: visible only when this node is already mapped to a code
    // component. Pure indicator — no click handler.
    const starEl = isMapped
      ? el("span", {
          class: "tree-star",
          title: mappedComponent ? `Mapped to ${mappedComponent}` : "Mapped",
        })
      : null;
    if (starEl) {
      starEl.appendChild(starIconSvg());
    }

    const row = el(
      "div",
      {
        class: `tree-row${treeState.activeTreeNode?.id === node.id ? " active" : ""}`,
        style: `padding-left:${depth * 12}px`,
        onclick: () => selectTreeNode(node),
        // Right-click opens the asset-mark context menu (icon / image / …).
        oncontextmenu: (e: MouseEvent) => {
          e.preventDefault();
          openTreeContextMenu(e.clientX, e.clientY, node);
        },
        "data-node-id": node.id,
        title: `${node.name} — click to locate, right-click for mark options`,
      },
      caret,
      el("span", { class: dotClass }),
      el("span", { class: "tree-name" }, node.name),
      el("span", { class: "tree-type" }, node.type),
      ...(starEl ? [starEl] : []),
      eyeBtn
    );

    const kidsWrap = el("div", { class: "tree-children" });
    if (hasKids) {
      for (const c of node.children!) kidsWrap.append(render(c, depth + 1));
      caret.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = kidsWrap.classList.toggle("collapsed");
        caret.classList.toggle("collapsed", collapsed);
      });
    }
    return el("div", {}, row, kidsWrap);
  };

  selectionTreeEl.append(render(tree, 0));
  treeCountEl.textContent = String(count);
  renderTreeNodePanel(treeState.activeTreeNode);
}

export function selectTreeNode(node: SelectionTreeNode): void {
  treeState.activeTreeNode = node;
  selectionTreeEl
    .querySelectorAll<HTMLDivElement>(".tree-row")
    .forEach((row) => {
      row.classList.toggle("active", row.dataset.nodeId === node.id);
    });
  renderTreeNodePanel(node);
  send({ type: "ZOOM_TO_NODE", nodeId: node.id, preserveSelection: true });
}
