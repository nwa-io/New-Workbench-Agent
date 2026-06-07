export function iconSvg(d: string, size = 13): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

// Eye icon for the "focus only" action in the selection tree — distinct from
// iconSvg() because it needs two paths (eyelid + pupil) and currentColor on
// both stroke + fill so it inherits the row's text color cleanly.
export function eyeIconSvg(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  const lid = document.createElementNS("http://www.w3.org/2000/svg", "path");
  lid.setAttribute(
    "d",
    "M1.5 8c1.6-3 4-4.5 6.5-4.5S13 5 14.5 8c-1.5 3-4 4.5-6.5 4.5S3 11 1.5 8z"
  );
  lid.setAttribute("stroke", "currentColor");
  lid.setAttribute("stroke-width", "1.4");
  lid.setAttribute("stroke-linecap", "round");
  lid.setAttribute("stroke-linejoin", "round");
  svg.appendChild(lid);
  const pupil = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  pupil.setAttribute("cx", "8");
  pupil.setAttribute("cy", "8");
  pupil.setAttribute("r", "1.7");
  pupil.setAttribute("fill", "currentColor");
  svg.appendChild(pupil);
  return svg;
}

// Filled star to flag a tree node as already mapped. Pure indicator — the
// color is bound to the .tree-star CSS class (green) rather than baked in,
// so it can inherit theme-aware variables.
export function starIconSvg(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M8 1.6l1.96 3.97 4.38.63-3.17 3.09.75 4.36L8 11.59l-3.92 2.06.75-4.36L1.66 6.2l4.38-.63z"
  );
  svg.appendChild(path);
  return svg;
}
