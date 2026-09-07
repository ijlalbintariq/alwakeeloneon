import os
import re

directories = ["client/src/pages", "client/src/components"]

replacements = {
    # Off-white / Pure White hexes used in chat
    r"bg-\[\#FFFFFF\](?! dark:)": "bg-[#FFFFFF] dark:bg-[#131E2E]",
    r"border-\[\#E5E4E2\](?! dark:)": "border-[#E5E4E2] dark:border-[#1E2D44]",
    
    # Text colors
    r"text-\[\#1A1A1A\](?! dark:)": "text-[#1A1A1A] dark:text-[#F8FAFC]",
    r"text-\[\#2D2D2D\](?! dark:)": "text-[#2D2D2D] dark:text-[#CBD5E1]",
    r"text-\[\#666666\](?! dark:)": "text-[#666666] dark:text-[#94A3B8]",
    r"text-\[\#999999\](?! dark:)": "text-[#999999] dark:text-[#475569]",
    
    # Tool Latency Bar backgrounds (uses #1A1A1A opacity for light mode)
    r"bg-\[\#1A1A1A\]/5(?! dark:)": "bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50",
    r"border-\[\#1A1A1A\]/20(?! dark:)": "border-[#1A1A1A]/20 dark:border-[#1E2D44]",
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

print("Fixed #FFFFFF and #1A1A1A text blocks in dark mode")
