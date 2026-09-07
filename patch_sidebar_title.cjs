const fs = require('fs');
const path = 'client/src/experimental/components/PreviewSidebar.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the hardcoded High Court Chambers
const oldCode = `<span className="text-[10px] text-[#64748B] truncate">
                  High Court Chambers
                </span>`;

const newCode = `<span className="text-[10px] text-[#64748B] truncate">
                  {typeof window !== "undefined" ? (window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional") : "Legal Professional"}
                </span>`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Patched PreviewSidebar.tsx");
} else {
  console.log("Could not find old code in PreviewSidebar");
}
