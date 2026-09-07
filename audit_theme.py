import os
import re

directories = ["client/src/experimental/pages", "client/src/experimental/components"]
patterns = {
    "bg-white": r"bg-white(?! dark:)",
    "bg-[#F8FAFC]": r"bg-\[\#F8FAFC\](?! dark:)",
    "text-[#0F172A]": r"text-\[\#0F172A\](?! dark:)",
    "border-[#E2E8F0]": r"border-\[\#E2E8F0\](?! dark:)",
}

found_issues = []

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(".tsx"):
                path = os.path.join(root, f)
                with open(path, "r") as file:
                    lines = file.readlines()
                    for i, line in enumerate(lines):
                        for label, pattern in patterns.items():
                            if re.search(pattern, line):
                                found_issues.append(f"{path}:{i+1} -> missing dark mode for {label}")

for issue in found_issues:
    print(issue)
