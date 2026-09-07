const fs = require('fs');
const path = 'client/src/experimental/pages/PreviewSettings.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state variable
const stateBlock = `  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");`;
const newStateBlock = `  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [designation, setDesignation] = useState(() => typeof window !== "undefined" ? (window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional") : "Legal Professional");`;
content = content.replace(stateBlock, newStateBlock);

// 2. Add UI dropdown
const uiBlock = `            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A]">Registered Account Email</label>`;

const newUiBlock = `            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A]">Professional Designation (Sidebar Title)</label>
              <select
                value={designation}
                onChange={(e) => {
                  setDesignation(e.target.value);
                  localStorage.setItem("alwakeelo_user_designation", e.target.value);
                  window.dispatchEvent(new Event("storage")); // Trigger sidebar update if listening
                }}
                className="w-full rounded-xl border border-[#E2E8F0] focus:border-[#105B38] focus:outline-none focus:ring-1 focus:ring-[#105B38] text-xs h-10 px-3 bg-white text-[#0F172A]"
              >
                <option value="Legal Professional">Legal Professional (Default)</option>
                <option value="Advocate High Court">Advocate High Court</option>
                <option value="Advocate Supreme Court">Advocate Supreme Court</option>
                <option value="High Court Chambers">High Court Chambers</option>
                <option value="Law Student">Law Student</option>
                <option value="Legal Researcher">Legal Researcher</option>
                <option value="In-House Counsel">In-House Counsel</option>
                <option value="Paralegal">Paralegal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A]">Registered Account Email</label>`;

content = content.replace(uiBlock, newUiBlock);
fs.writeFileSync(path, content, 'utf8');
console.log("Patched PreviewSettings.tsx");
