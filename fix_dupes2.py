import os
import re

directories = ["client/src/pages", "client/src/components"]

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(".tsx"):
                path = os.path.join(root, f)
                with open(path, "r") as file:
                    content = file.read()
                
                # Deduplicate identical dark: classes
                # like `dark:text-emerald-400 dark:text-emerald-400`
                pattern = r"(dark:\S+)(?:\s+\1)+"
                new_content = re.sub(pattern, r"\1", content)
                
                if new_content != content:
                    with open(path, "w") as file:
                        file.write(new_content)

print("Deduplicated identical dark classes")
