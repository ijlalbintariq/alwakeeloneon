import sys
with open('client/src/experimental/components/PreviewSidebar.tsx', 'r') as f:
    content = f.read()

import_block = 'import React, { useState, useEffect } from "react";'
content = content.replace('import React from "react";', import_block)

sig = 'export const PreviewSidebar: React.FC<PreviewSidebarProps> = ({\n  collapsed,\n  onToggleCollapse,\n  onOpenReference,\n  className,\n}) => {'

hook_code = """
  const [designation, setDesignation] = useState(() => typeof window !== "undefined" ? (window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional") : "Legal Professional");
  useEffect(() => {
    const onStorage = () => setDesignation(window.localStorage.getItem("alwakeelo_user_designation") || "Legal Professional");
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
"""

content = content.replace(sig, sig + hook_code)

with open('client/src/experimental/components/PreviewSidebar.tsx', 'w') as f:
    f.write(content)
print("Fixed PreviewSidebar.tsx")
