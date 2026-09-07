import os
import re

directories = ["client/src/pages", "client/src/components"]

replacements = {
    # Light backgrounds
    r"bg-\[\#F5F4F2\](?! dark:)": "bg-[#F5F4F2] dark:bg-[#0B131E]",
    r"bg-\[\#EBEBEB\](?! dark:)": "bg-[#EBEBEB] dark:bg-[#1E2D44]",
    
    # Hover light backgrounds
    r"hover:bg-\[\#F5F4F2\](?! dark:)": "hover:bg-[#F5F4F2] dark:hover:bg-[#1E2D44]",
    r"hover:bg-\[\#EBEBEB\](?! dark:)": "hover:bg-[#EBEBEB] dark:hover:bg-[#2A3B54]",
    
    # Text colors
    r"text-\[\#4A4A4A\](?! dark:)": "text-[#4A4A4A] dark:text-[#94A3B8]",
    r"hover:text-\[\#4A4A4A\](?! dark:)": "hover:text-[#4A4A4A] dark:hover:text-[#F8FAFC]",
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

print("Fixed remaining custom hexes in dark mode")
