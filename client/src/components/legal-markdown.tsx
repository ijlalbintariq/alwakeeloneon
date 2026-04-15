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
      className="text-[#B45309] hover:text-[#92400E] font-semibold underline underline-offset-2 decoration-[#B45309]/40 hover:decoration-[#B45309] transition-colors cursor-pointer"
    >
      {children}
    </a>
  );
}

function LegalMarkdownComponent({ content, className }: { content: string; className?: string }) {
  const citationPattern = /\b(\d{4}\s+(?:P\.?\s*L\.?\s*D|S\.?\s*C\.?\s*M\.?\s*R|Y\.?\s*L\.?\s*R|M\.?\s*L\.?\s*D|C\.?\s*L\.?\s*C|P\.?\s*C\.?\s*R\.?\s*L\.?\s*J|P\.?\s*L\.?\s*J|N\.?\s*L\.?\s*R|C\.?\s*L\.?\s*D|P\.?\s*T\.?\s*D|P\.?\s*L\.?\s*C)\s+\d+)\b/gi;
  const statutePattern = /\b(?:(Section\s+\d+(?:\s*[A-Za-z]*)?(?:\s+(?:PPC|CPC|IPC|PCA|PMLA|BNPL|SECP))?)|(?:(?:PPC|CPC|IPC|PCA|PMLA|BNPL|SECP|Constitution|Qanun-e-Shahadat)\s+(?:Order|Act|Code|Rule|Ordinance|1997|1998|1999|2000|2001|2002|2003|2004|2005|2006|2007|2008|2009|2010|2011|2012|2013|2014|2015|2016|2017|2018|2019|2020|2021|2022|2023|2024)))\b/gi;

  const processTextForCitations = (text: string) => {
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    const allMatches: Array<{ start: number; end: number; text: string; type: 'citation' | 'statute' }> = [];

    let match;
    while ((match = citationPattern.exec(text)) !== null) {
      allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'citation' });
    }

    while ((match = statutePattern.exec(text)) !== null) {
      allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'statute' });
    }

    allMatches.sort((a, b) => a.start - b.start);

    allMatches.forEach((m) => {
      if (m.start > lastIndex) {
        parts.push(text.slice(lastIndex, m.start));
      }
      const searchQuery = encodeURIComponent(m.text);
      const href = m.type === 'statute' ? `/statute-search?q=${searchQuery}` : `/judgments?q=${searchQuery}`;
      parts.push(
        <LegalLink key={`${m.type}-${m.start}`} href={href}>
          {m.text}
        </LegalLink>
      );
      lastIndex = m.end;
    });

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`legal-markdown ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-[#1E3A8A] mt-5 mb-3 pb-2 border-b-2 border-[#B45309]" data-testid="text-heading-h1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-[#1E3A8A] mt-4 mb-2.5 pb-1.5 border-b border-[#B45309]/30" data-testid="text-heading-h2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold text-[#B45309] mt-4 mb-2 uppercase tracking-wide" data-testid="text-heading-h3">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-[#1E3A8A] mt-3 mb-1.5" data-testid="text-heading-h4">
              {children}
            </h4>
          ),
          p: ({ children }) => {
            const text = extractText(children);
            const processed = processTextForCitations(text);
            return (
              <p className="text-sm leading-relaxed mb-3 text-[#0F172A]">
                {processed === text ? children : processed}
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
            if (citationPattern.test(text)) {
              const searchQuery = encodeURIComponent(text);
              return (
                <LegalLink href={`/judgments?q=${searchQuery}`}>
                  <strong>{text}</strong>
                </LegalLink>
              );
            }
            return <strong className="text-[#1E3A8A] font-semibold">{children}</strong>;
          },
          ul: ({ children }) => (
            <ul className="list-disc list-outside space-y-1.5 mb-4 ml-5 text-sm text-[#0F172A]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-1.5 mb-4 ml-5 text-sm text-[#0F172A]">{children}</ol>
          ),
          li: ({ children }) => {
            const text = extractText(children);
            const processed = processTextForCitations(text);
            return (
              <li className="leading-relaxed pl-1">
                {processed === text ? children : processed}
              </li>
            );
          },
          a: ({ href, children }) => {
            if (href && (href.startsWith("/statute") || href.startsWith("/judgment"))) {
              return <LegalLink href={href}>{children}</LegalLink>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#B45309] hover:text-[#92400E] font-semibold underline underline-offset-2 transition-colors"
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#B45309] bg-[#F8FAFC] pl-4 pr-3 py-2 my-3 text-[#475569] italic rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="bg-[#F1F5F9] text-[#B45309] px-1.5 py-0.5 rounded text-xs font-mono border border-[#E2E8F0]">
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-3 my-2 overflow-x-auto">
                <code className="text-xs font-mono text-[#0F172A]">{children}</code>
              </pre>
            );
          },
          hr: () => <hr className="border-[#CBD5E1] my-4" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-sm border border-[#CBD5E1] rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-[#1E3A8A] px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider border-b border-[#CBD5E1]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[#0F172A] border-b border-[#E2E8F0]">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const LegalMarkdown = memo(LegalMarkdownComponent);
LegalMarkdown.displayName = "LegalMarkdown";
