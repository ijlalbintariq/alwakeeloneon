import sanitizeHtml from "sanitize-html";

const SAFE_COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const SAFE_LENGTH = /^-?\d+(?:\.\d+)?(?:px|pt|em|rem|%|in|cm|mm)?$/i;
const SAFE_BORDER = /^[\d\s.#a-z(),%-]+$/i;

export function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeLegalDraftHtml(value: string): string {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "hr",
      "i",
      "li",
      "ol",
      "p",
      "s",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    allowedAttributes: {
      "*": ["class", "style"],
      a: ["href", "target", "rel"],
      h1: ["data-page-break"],
      h2: ["data-page-break"],
      h3: ["data-page-break"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        "background-color": [SAFE_COLOR],
        "border": [SAFE_BORDER],
        "border-bottom": [SAFE_BORDER],
        "border-collapse": [/^collapse$/i],
        "border-left": [SAFE_BORDER],
        "border-right": [SAFE_BORDER],
        "border-top": [SAFE_BORDER],
        "color": [SAFE_COLOR],
        "font-size": [SAFE_LENGTH],
        "font-style": [/^(?:normal|italic)$/i],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/i],
        "letter-spacing": [SAFE_LENGTH],
        "line-height": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/i],
        "margin": [SAFE_BORDER],
        "margin-bottom": [SAFE_LENGTH],
        "margin-left": [SAFE_LENGTH],
        "margin-right": [SAFE_LENGTH],
        "margin-top": [SAFE_LENGTH],
        "padding": [SAFE_BORDER],
        "padding-bottom": [SAFE_LENGTH],
        "padding-left": [SAFE_LENGTH],
        "padding-right": [SAFE_LENGTH],
        "padding-top": [SAFE_LENGTH],
        "page-break-before": [/^always$/i],
        "text-align": [/^(?:left|right|center|justify)$/i],
        "text-decoration": [/^(?:none|underline|line-through)$/i],
        "text-indent": [SAFE_LENGTH],
        "text-transform": [/^(?:none|uppercase|lowercase|capitalize)$/i],
        "vertical-align": [/^(?:top|middle|bottom|baseline|sub|super)$/i],
        "width": [SAFE_LENGTH],
      },
    },
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          target: attribs.target === "_blank" ? "_blank" : "_self",
        },
      }),
    },
  });
}

export const LEGAL_DRAFT_PREVIEW_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src https://fonts.gstatic.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'none'",
].join("; ");
