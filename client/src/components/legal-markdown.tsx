import { Children, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "wouter";

function extractText(children: React.ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === "string") return child;
    if (typeof child === "number") return String(child);
    if (child && typeof child === "object" && "props" in child) {
      return extractText(child.props.children);
    }
    return "";
  }).join("");
}

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(href);
  };
  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-500/40 hover:decoration-amber-400 transition-colors cursor-pointer"
    >
      {children}
    </a>
  );
}

function renderTextWithCitationLinks(text: string): React.ReactNode {
  const citationRegex = /\b(\d{4})\s+(P\.?L\.?D|S\.?C\.?M\.?R|Y\.?L\.?R|M\.?L\.?D|C\.?L\.?C|P\.?C\.?R\.?L\.?J|P\.?L\.?J|N\.?L\.?R|C\.?L\.?D|P\.?T\.?D|P\.?L\.?C|PLD|SCMR|YLR|MLD|CLC|PCRLJ|PLJ|NLR|CLD|PTD|PLC)\s+(\d+)\b/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const citation = match[0];
    const searchQuery = encodeURIComponent(citation);
    parts.push(
      <LegalLink key={`citation-${match.index}`} href={`/judgments?q=${searchQuery}`}>
        <span className="text-amber-400 underline">{citation}</span>
      </LegalLink>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 1 ? parts : text;
}

function cleanExcessWhitespace(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/([a-z])\s+([a-z])/gi, "$1$2")
    .trim();
}

function LegalMarkdownComponent({ content, className }: { content: string; className?: string }) {
  const cleanedContent = cleanExcessWhitespace(content);
  const citationPattern = /^\d{4}\s+(?:P\.?\s*L\.?\s*D|S\.?\s*C\.?\s*M\.?\s*R|Y\.?\s*L\.?\s*R|M\.?\s*L\.?\s*D|C\.?\s*L\.?\s*C|P\.?\s*C\.?\s*R\.?\s*L\.?\s*J|P\.?\s*L\.?\s*J|N\.?\s*L\.?\s*R|C\.?\s*L\.?\s*D|P\.?\s*T\.?\s*D|P\.?\s*L\.?\s*C)\s+\d+/i;
  return (
    <div className={`legal-markdown ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          tr: ({ children }) => {
            const cellText = extractText(children);
            return (
              <tr className="border-b border-slate-800 hover:bg-slate-900/50">
                {children}
              </tr>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-white mt-4 mb-2 border-b border-slate-700 pb-2" data-testid="text-heading-h1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-white mt-4 mb-2 border-b border-slate-700/50 pb-1.5" data-testid="text-heading-h2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-amber-400 mt-4 mb-2 uppercase tracking-wide" data-testid="text-heading-h3">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-slate-200 mt-3 mb-1" data-testid="text-heading-h4">
              {children}
            </h4>
          ),
          p: ({ children }) => {
            const textContent = extractText(children);
            return (
              <p className="text-sm leading-relaxed mb-2 text-slate-200">
                {renderTextWithCitationLinks(textContent)}
              </p>
            );
          },
          strong: ({ children }) => {
            const text = extractText(children);

            const statuteMatch = text.match(/^\[(.+?)\]$/);
            if (statuteMatch) {
              const statuteName = statuteMatch[1];
              const searchQuery = encodeURIComponent(statuteName);
              return (
                <LegalLink href={`/statute-search?q=${searchQuery}`}>
                  <strong>{statuteName}</strong>
                </LegalLink>
              );
            }

            const statuePatterns = [
              /(?:Code of Criminal Procedure|Cr\.?P\.?C\.?)\s*,?\s*18\d{2}/i,
              /(?:Pakistan Penal Code|PPC)\s*,?\s*18\d{2}/i,
              /(?:Constitution of the Islamic Republic of Pakistan)\s*,?\s*19\d{2}/i,
              /(?:Qanun-e-Shahadat Order|QSO)\s*,?\s*19\d{2}/i,
            ];

            for (const pattern of statuePatterns) {
              if (pattern.test(text)) {
                const searchQuery = encodeURIComponent(text);
                return (
                  <LegalLink href={`/statute-search?q=${searchQuery}`}>
                    <strong>{text}</strong>
                  </LegalLink>
                );
              }
            }

            if (citationPattern.test(text)) {
              const searchQuery = encodeURIComponent(text);
              return (
                <LegalLink href={`/judgments?q=${searchQuery}`}>
                  <strong>{text}</strong>
                </LegalLink>
              );
            }
            return <strong className="text-white font-semibold">{children}</strong>;
          },
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 ml-2 text-sm text-slate-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 ml-2 text-sm text-slate-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          a: ({ href, children }) => {
            if (href && (href.startsWith("/statute") || href.startsWith("/judgment"))) {
              return <LegalLink href={href}>{children}</LegalLink>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-amber-500/50 pl-4 my-3 text-slate-300 italic">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 my-2 overflow-x-auto">
                <code className="text-xs font-mono text-slate-200">{children}</code>
              </pre>
            );
          },
          hr: () => <hr className="border-slate-700 my-4" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-700">
              <table className="min-w-full text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800/80">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-800">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-slate-700">
              {renderTextWithCitationLinks(extractText(children))}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-slate-200 border-slate-800">
              {renderTextWithCitationLinks(extractText(children))}
            </td>
          ),
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
}

export const LegalMarkdown = memo(LegalMarkdownComponent);
LegalMarkdown.displayName = "LegalMarkdown";
