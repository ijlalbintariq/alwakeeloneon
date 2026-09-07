with open('client/src/experimental/pages/PreviewCheckout.tsx', 'r') as f:
    content = f.read()

# Fix the shell-corrupted lines
# 1. line 138: (location.includes("?") ?  : "")
content = content.replace('(location.includes("?") ?  : "")', '(location.includes("?") ? `?${location.split("?")[1]}` : "")')

# 2. check other places with missing template literals
import re
# Look for empty template strings or missing expressions
print("Checking for broken template literals...")
