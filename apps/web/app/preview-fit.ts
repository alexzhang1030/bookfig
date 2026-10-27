export type FitBox = { x: number; y: number; w: number; h: number };

const FIT_PAD = 36;

export function rememberSvgSize(svg: SVGSVGElement): void {
  if (svg.dataset.origViewBox !== undefined && svg.dataset.origViewBox !== "") return;
  svg.dataset.origViewBox = svg.getAttribute("viewBox") ?? "";
  svg.dataset.origWidth = svg.getAttribute("width") ?? "";
  svg.dataset.origHeight = svg.getAttribute("height") ?? "";
}

export function restoreSvgSize(svg: SVGSVGElement): void {
  if (svg.dataset.origViewBox) svg.setAttribute("viewBox", svg.dataset.origViewBox);
  if (svg.dataset.origWidth) svg.setAttribute("width", svg.dataset.origWidth);
  if (svg.dataset.origHeight) svg.setAttribute("height", svg.dataset.origHeight);
  svg.style.width = "";
  svg.style.height = "";
  svg.style.maxWidth = "";
  svg.style.maxHeight = "";
  delete svg.dataset.fitApplied;
}

function isChrome(el: Element, canvasW: number, canvasH: number): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "defs" || tag === "style") return true;
  if (tag === "rect") {
    const w = Number(el.getAttribute("width"));
    const h = Number(el.getAttribute("height"));
    return w > canvasW * 0.8 && h > canvasH * 0.8;
  }
  if (tag === "g") {
    if (el.getAttribute("transform")) return false;
    if (!el.getAttribute("stroke")) return false;
    const kids = [...el.children];
    return kids.length > 0 && kids.every((c) => c.tagName.toLowerCase() === "path");
  }
  return false;
}

export function contentViewBox(svg: SVGSVGElement, pad = FIT_PAD): FitBox {
  rememberSvgSize(svg);
  const canvasW = Number(svg.dataset.origWidth || 2000);
  const canvasH = Number(svg.dataset.origHeight || 1200);
  const hidden: HTMLElement[] = [];
  for (const child of svg.children) {
    if (!isChrome(child, canvasW, canvasH)) continue;
    const node = child as HTMLElement;
    node.dataset.fitHide = node.style.display;
    node.style.display = "none";
    hidden.push(node);
  }
  let box: DOMRect;
  try {
    box = svg.getBBox();
  } finally {
    for (const node of hidden) {
      node.style.display = node.dataset.fitHide ?? "";
      delete node.dataset.fitHide;
    }
  }
  const empty =
    !Number.isFinite(box.width) || box.width < 2 || !Number.isFinite(box.height) || box.height < 2;
  if (empty) return { x: 0, y: 0, w: canvasW, h: canvasH };
  return {
    x: box.x - pad,
    y: box.y - pad,
    w: Math.max(1, box.width + pad * 2),
    h: Math.max(1, box.height + pad * 2),
  };
}

export function applyFitViewBox(svg: SVGSVGElement, pad = FIT_PAD): FitBox {
  if (svg.dataset.fitApplied === "1") {
    const vb = svg.viewBox.baseVal;
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  }
  const box = contentViewBox(svg, pad);
  svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
  svg.setAttribute("width", String(Math.round(box.w)));
  svg.setAttribute("height", String(Math.round(box.h)));
  svg.style.width = "auto";
  svg.style.height = "auto";
  svg.style.maxWidth = "100%";
  svg.style.maxHeight = "100%";
  svg.dataset.fitApplied = "1";
  return box;
}
