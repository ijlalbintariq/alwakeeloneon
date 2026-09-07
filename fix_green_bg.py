import os
import re

directories = ["client/src/pages", "client/src/components"]
replacements = {
    r"bg-\[\#EBF5F0\](?! dark:)": "bg-[#EBF5F0] dark:bg-[#105B38]/20",
    r"border-\[\#A3D4BC\](?! dark:)": "border-[#A3D4BC] dark:border-[#10B981]/30",
    r"shadow-\[\#105B38\]/15(?! dark:)": "shadow-[#105B38]/15 dark:shadow-[#10B981]/10",
}

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(".tsx"):
                path = os.path.join(root, f)
                with open(path, "r") as file:
                    content = file.read()
                
                new_content = content
                for pattern, repl in replacements.items():
                    new_content = re.sub(pattern, repl, new_content)
                
                if new_content != content:
                    with open(path, "w") as file:
                        file.write(new_content)

print("Fixed pale green backgrounds in dark mode")
