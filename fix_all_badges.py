import os
import re

directories = ["client/src/pages", "client/src/components"]

replacements = [
    # Backgrounds
    (r"bg-([a-z]+)-50(?!0)(?!/)(?! dark:)", r"bg-\1-50 dark:bg-\1-500/10"),
    (r"bg-([a-z]+)-50/(\d+)(?! dark:)", r"bg-\1-50/\2 dark:bg-\1-500/10"),
    
    # Borders
    (r"border-([a-z]+)-100(?! dark:)", r"border-\1-100 dark:border-\1-500/20"),
    (r"border-([a-z]+)-200(?! dark:)", r"border-\1-200 dark:border-\1-500/20"),
    (r"border-([a-z]+)-300(?! dark:)", r"border-\1-300 dark:border-\1-500/30"),
    
    # Text colors
    (r"text-([a-z]+)-(600|700|800)(?! dark:)", r"text-\1-\2 dark:text-\1-400"),
]

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(".tsx"):
                path = os.path.join(root, f)
                with open(path, "r") as file:
                    content = file.read()
                
                new_content = content
                for pattern, repl in replacements:
                    # Skip common structural colors that shouldn't be overridden with -400 universally, 
                    # except maybe slate/gray, but we'll let it ride for badges. Wait, text-slate-700 -> dark:text-slate-400 is fine.
                    new_content = re.sub(pattern, repl, new_content)
                
                if new_content != content:
                    with open(path, "w") as file:
                        file.write(new_content)

print("Fixed all remaining colors")
