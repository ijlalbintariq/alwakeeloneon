import os
import re

directories = ["client/src/experimental/pages", "client/src/experimental/components"]

replacements = {
    # Emerald
    r"bg-emerald-50(?!0)(?!/)(?! dark:)": "bg-emerald-50 dark:bg-emerald-500/10",
    r"bg-emerald-50/(\d+)(?! dark:)": r"bg-emerald-50/\1 dark:bg-emerald-500/10",
    r"border-emerald-200(?! dark:)": "border-emerald-200 dark:border-emerald-500/20",
    r"border-emerald-300(?! dark:)": "border-emerald-300 dark:border-emerald-500/30",
    r"text-emerald-700(?! dark:)": "text-emerald-700 dark:text-emerald-400",
    r"text-emerald-800(?! dark:)": "text-emerald-800 dark:text-emerald-400",
    r"text-emerald-900(?! dark:)": "text-emerald-900 dark:text-emerald-300",
    r"text-emerald-950(?! dark:)": "text-emerald-950 dark:text-emerald-300",
    
    # Amber
    r"bg-amber-50(?!0)(?!/)(?! dark:)": "bg-amber-50 dark:bg-amber-500/10",
    r"bg-amber-50/(\d+)(?! dark:)": r"bg-amber-50/\1 dark:bg-amber-500/10",
    r"border-amber-200(?! dark:)": "border-amber-200 dark:border-amber-500/20",
    r"border-amber-300(?! dark:)": "border-amber-300 dark:border-amber-500/30",
    r"text-amber-600(?! dark:)": "text-amber-600 dark:text-amber-400",
    r"text-amber-700(?! dark:)": "text-amber-700 dark:text-amber-400",
    r"text-amber-800(?! dark:)": "text-amber-800 dark:text-amber-400",
    r"text-amber-900(?! dark:)": "text-amber-900 dark:text-amber-300",
    r"text-amber-950(?! dark:)": "text-amber-950 dark:text-amber-300",

    # Rose
    r"bg-rose-50(?!0)(?!/)(?! dark:)": "bg-rose-50 dark:bg-rose-500/10",
    r"bg-rose-50/(\d+)(?! dark:)": r"bg-rose-50/\1 dark:bg-rose-500/10",
    r"border-rose-200(?! dark:)": "border-rose-200 dark:border-rose-500/20",
    r"text-rose-600(?! dark:)": "text-rose-600 dark:text-rose-400",
    r"text-rose-700(?! dark:)": "text-rose-700 dark:text-rose-400",
    r"text-rose-800(?! dark:)": "text-rose-800 dark:text-rose-400",

    # Blue
    r"bg-blue-50(?!0)(?!/)(?! dark:)": "bg-blue-50 dark:bg-blue-500/10",
    r"bg-blue-50/(\d+)(?! dark:)": r"bg-blue-50/\1 dark:bg-blue-500/10",
    r"border-blue-200(?! dark:)": "border-blue-200 dark:border-blue-500/20",
    r"text-blue-600(?! dark:)": "text-blue-600 dark:text-blue-400",
    r"text-blue-700(?! dark:)": "text-blue-700 dark:text-blue-400",
    r"text-blue-800(?! dark:)": "text-blue-800 dark:text-blue-400",
    r"text-blue-900(?! dark:)": "text-blue-900 dark:text-blue-300",

    # Purple
    r"bg-purple-50(?!0)(?!/)(?! dark:)": "bg-purple-50 dark:bg-purple-500/10",
    r"bg-purple-50/(\d+)(?! dark:)": r"bg-purple-50/\1 dark:bg-purple-500/10",
    r"border-purple-100(?! dark:)": "border-purple-100 dark:border-purple-500/20",
    r"border-purple-200(?! dark:)": "border-purple-200 dark:border-purple-500/20",
    r"text-purple-600(?! dark:)": "text-purple-600 dark:text-purple-400",
    r"text-purple-700(?! dark:)": "text-purple-700 dark:text-purple-400",
    
    # Gray / Slate 50s
    r"bg-slate-50(?!0)(?!/)(?! dark:)": "bg-slate-50 dark:bg-slate-800",
    r"bg-gray-50(?!0)(?!/)(?! dark:)": "bg-gray-50 dark:bg-gray-800",
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

print("Fixed colored badges in dark mode")
