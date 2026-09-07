const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/components/chat/ChatInspectorDrawer.tsx', 'utf-8');

// Add expandedBookmarks state
code = code.replace(
  'const [expandedSnippets, setExpandedSnippets] = useState<Record<number, boolean>>({});',
  'const [expandedSnippets, setExpandedSnippets] = useState<Record<number, boolean>>({});\n  const [expandedBookmarks, setExpandedBookmarks] = useState<Record<number, boolean>>({});'
);

// Replace bookmark rendering
const oldBookmarkStr = `                  filteredBookmarks.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] space-y-2 hover:border-[#105B38]/40 hover:shadow-xs transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs sm:text-sm text-[#0F172A] truncate">
                          {b.title || "Saved Response Turn"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(b.content, \`bm-\${b.id}\`)}
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
                          title="Copy Content"
                        >
                          {copiedKey === \`bm-\${b.id}\` ? (
                            <Check className="w-3.5 h-3.5 text-[#105B38]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-[#475569] line-clamp-3 leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] font-sans">
                        {b.content}
                      </p>
                    </div>
                  ))`;

const newBookmarkStr = `                  filteredBookmarks.map((b) => {
                    const isExpanded = !!expandedBookmarks[b.id];
                    return (
                      <div
                        key={b.id}
                        onClick={() => setExpandedBookmarks(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                        className="cursor-pointer p-3.5 rounded-2xl bg-white border border-[#E2E8F0] space-y-2 hover:border-[#105B38]/40 hover:shadow-xs transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs sm:text-sm text-[#0F172A] truncate">
                            {b.title || "Saved Response Turn"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleCopy(b.content, \`bm-\${b.id}\`); }}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
                            title="Copy Content"
                          >
                            {copiedKey === \`bm-\${b.id}\` ? (
                              <Check className="w-3.5 h-3.5 text-[#105B38]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className={cn("text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] font-sans whitespace-pre-wrap", isExpanded ? "" : "line-clamp-3")}>
                          {b.content}
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider group-hover:text-[#105B38] transition-colors">
                            {isExpanded ? "Show Less" : "Click to read full"}
                          </span>
                        </div>
                      </div>
                    );
                  })`;

if(code.includes('filteredBookmarks.map((b) => (')) {
  code = code.replace(oldBookmarkStr, newBookmarkStr);
  fs.writeFileSync('client/src/experimental/components/chat/ChatInspectorDrawer.tsx', code);
  console.log("Updated ChatInspectorDrawer to expand bookmarks");
} else {
  console.log("Could not find bookmark map string");
}

