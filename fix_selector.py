import re

file_path = "client/src/components/chat/ChatModelSelector.tsx"
with open(file_path, "r") as f:
    content = f.read()

replacements = {
    r"bg-\[\#F5F4F2\](?! dark:)": "bg-[#F5F4F2] dark:bg-[#0B131E]",
    r"border-\[\#E5E4E2\](?! dark:)": "border-[#E5E4E2] dark:border-[#1E2D44]",
    r"text-\[\#1A1A1A\](?! dark:)": "text-[#1A1A1A] dark:text-[#F8FAFC]",
    r"text-\[\#2D2D2D\](?! dark:)": "text-[#2D2D2D] dark:text-[#CBD5E1]",
    r"text-\[\#666666\](?! dark:)": "text-[#666666] dark:text-[#94A3B8]",
    r"text-\[\#999999\](?! dark:)": "text-[#999999] dark:text-[#475569]",
    r"hover:text-\[\#1A1A1A\](?! dark:)": "hover:text-[#1A1A1A] dark:hover:text-[#F8FAFC]",
    r"hover:bg-\[\#F5F4F2\](?! dark:)": "hover:bg-[#F5F4F2] dark:hover:bg-[#1E2D44]",
    r"hover:border-\[\#E5E4E2\](?! dark:)": "hover:border-[#E5E4E2] dark:hover:border-[#1E2D44]",
}

for pattern, repl in replacements.items():
    content = re.sub(pattern, repl, content)

with open(file_path, "w") as f:
    f.write(content)
