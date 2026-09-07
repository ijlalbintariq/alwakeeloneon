const fs = require('fs');
const path = 'client/src/experimental/components/PreviewSidebar.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `<span className="text-[10px] text-[#64748B] truncate">
                  {typeof window !== "undefined" ? (window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional") : "Legal Professional"}
                </span>`;

// Find where to insert useEffect
if (!content.includes('const [designation, setDesignation]')) {
  content = content.replace(
    'export const PreviewSidebar: React.FC<PreviewSidebarProps> = ({ collapsed, toggleCollapse }) => {',
    'export const PreviewSidebar: React.FC<PreviewSidebarProps> = ({ collapsed, toggleCollapse }) => {\n  const [designation, setDesignation] = useState(() => typeof window !== "undefined" ? (window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional") : "Legal Professional");\n  useEffect(() => {\n    const onStorage = () => setDesignation(window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional");\n    window.addEventListener("storage", onStorage);\n    return () => window.removeEventListener("storage", onStorage);\n  }, []);'
  );
  
  content = content.replace(oldCode, `<span className="text-[10px] text-[#64748B] truncate">
                  {designation}
                </span>`);
                
  fs.writeFileSync(path, content, 'utf8');
  console.log("Patched PreviewSidebar.tsx for dynamic updates");
}
