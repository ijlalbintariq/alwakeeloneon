import os
import re

directories = ["client/src/pages", "client/src/components", "client/src/experimental/pages", "client/src/experimental/components"]

replacements = {
    r"bg-white(?! dark:)": "bg-white dark:bg-[#131E2E]",
    r"bg-\[\#F8FAFC\](?! dark:)": "bg-[#F8FAFC] dark:bg-[#0B131E]",
    r"bg-\[\#F1F5F9\](?! dark:)": "bg-[#F1F5F9] dark:bg-[#1E2D44]",
    r"text-\[\#0F172A\](?! dark:)": "text-[#0F172A] dark:text-[#F8FAFC]",
    r"text-\[\#64748B\](?! dark:)": "text-[#64748B] dark:text-[#94A3B8]",
    r"text-\[\#334155\](?! dark:)": "text-[#334155] dark:text-[#CBD5E1]",
    r"text-\[\#94A3B8\](?! dark:)": "text-[#94A3B8] dark:text-[#475569]",
    r"border-\[\#E2E8F0\](?! dark:)": "border-[#E2E8F0] dark:border-[#1E2D44]",
    r"hover:bg-\[\#F8FAFC\](?! dark:)": "hover:bg-[#F8FAFC] dark:hover:bg-[#1E2D44]",
    r"hover:bg-white(?! dark:)": "hover:bg-white dark:hover:bg-[#131E2E]",
    r"hover:bg-\[\#F1F5F9\](?! dark:)": "hover:bg-[#F1F5F9] dark:hover:bg-[#1E2D44]",
    r"hover:border-\[\#E2E8F0\](?! dark:)": "hover:border-[#E2E8F0] dark:hover:border-[#1E2D44]",
    r"border-\[\#105B38\]\/20(?! dark:)": "border-[#105B38]/20 dark:border-[#105B38]/40",
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
