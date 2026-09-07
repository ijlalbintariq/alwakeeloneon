import os
import re

directories = ["client/src/experimental/pages", "client/src/experimental/components"]

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(".tsx"):
                path = os.path.join(root, f)
                with open(path, "r") as file:
                    content = file.read()
                
                new_content = content.replace("dark:text-[#94A3B8] dark:text-[#475569]", "dark:text-[#94A3B8]")
                
                if new_content != content:
                    with open(path, "w") as file:
                        file.write(new_content)
