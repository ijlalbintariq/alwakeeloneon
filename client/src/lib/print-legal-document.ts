import { resolveLegalPageProfile, type LegalPageProfileId } from "./legal-page-layout";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export function buildLegalPrintDocument(html: string, title: string, profileId: LegalPageProfileId): string {
  const profile = resolveLegalPageProfile(profileId);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allowedTags = new Set(["P", "H1", "H2", "H3", "STRONG", "B", "EM", "I", "U", "S", "SUB", "SUP", "MARK", "SPAN", "BR", "HR", "OL", "UL", "LI", "BLOCKQUOTE", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "DIV"]);
  doc.querySelectorAll("script,style,link,iframe,object,embed,img,svg,math,form,input,button,textarea,select").forEach((node) => node.remove());
  for (const node of Array.from(doc.body.querySelectorAll("*"))) {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      if (!["style", "class", "colspan", "rowspan", "start", "data-type", "data-page-break"].includes(attr.name)) node.removeAttribute(attr.name);
    }
    const style = (node as HTMLElement).style;
    for (const property of Array.from(style)) {
      if (!/^(text-align|text-indent|font-size|font-weight|font-style|text-decoration|line-height|color|background-color|margin-left|break-before|page-break-before)$/.test(property)) style.removeProperty(property);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHtml(title)}</title><style>
    @page { size: ${profile.cssPageSize}; margin: ${profile.marginTopMm}mm ${profile.marginRightMm}mm ${profile.marginBottomMm}mm ${profile.marginLeftMm}mm; }
    body { margin: 0; color: black; background: white; font: 13pt/1.3 'Times New Roman', serif; }
    p { margin: 0 0 8pt; } h1,h2 { font-size: 14pt; } h3 { font-size: 13pt; }
    h1,h2,h3 { break-after: avoid; } table { width: 100%; border-collapse: collapse; }
    td,th { border: 1px solid black; padding: 4pt; } tr { break-inside: avoid; }
    [data-type="legal-page-break"], [data-page-break="true"] { break-before: page; }
    .legal-page-break-label { display: none; } .citation-chip { font-weight: bold; }
  </style></head><body>${doc.body.innerHTML}</body></html>`;
}

/** Print an isolated document so fixed workspace panels cannot clip the pleading. */
export function printLegalDocument(html: string, title: string, profileId: LegalPageProfileId): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Document print preview";
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:0;bottom:0;";
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    const cleanup = () => frame.remove();
    const cleanupTimer = window.setTimeout(cleanup, 60_000);
    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        cleanup();
        window.clearTimeout(cleanupTimer);
        reject(new Error("Could not open document print preview."));
        return;
      }
      printWindow.addEventListener("afterprint", () => { cleanup(); window.clearTimeout(cleanupTimer); }, { once: true });
      try {
        printWindow.focus();
        printWindow.print();
        resolve();
      } catch (error) {
        cleanup();
        window.clearTimeout(cleanupTimer);
        reject(error);
      }
    };
    frame.srcdoc = buildLegalPrintDocument(html, title, profileId);
    document.body.appendChild(frame);
  });
}
