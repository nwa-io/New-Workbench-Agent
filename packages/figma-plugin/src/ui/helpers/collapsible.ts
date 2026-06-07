// Shared collapsed-section behaviour. Counts stay visible in the header so
// users can see whether there is anything in the list before opening it.
export function setCollapsibleSectionOpen(
  toggleEl: HTMLButtonElement,
  contentEl: HTMLElement,
  open: boolean
): void {
  if (open) {
    toggleEl.classList.remove("collapsed");
    toggleEl.setAttribute("aria-expanded", "true");
    contentEl.classList.remove("collapsed");
    contentEl.hidden = false;
  } else {
    toggleEl.classList.add("collapsed");
    toggleEl.setAttribute("aria-expanded", "false");
    contentEl.classList.add("collapsed");
    contentEl.hidden = true;
  }
}

export function wireCollapsibleToggle(
  toggleEl: HTMLButtonElement,
  contentEl: HTMLElement
): void {
  toggleEl.addEventListener("click", () => {
    const isOpen = !toggleEl.classList.contains("collapsed");
    setCollapsibleSectionOpen(toggleEl, contentEl, !isOpen);
  });
}
