import re

with open('client/src/App.tsx', 'r') as f:
    content = f.read()

# Remove the entire GlobalErrorBoundary class
start_marker = 'class GlobalErrorBoundary'
end_marker_class = '\n}\n'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("No GlobalErrorBoundary found")
    exit(0)

# Find the closing brace of the class - it ends with "}\n}\n" (render closing + class closing)
# We need to find the class end properly
search_from = start_idx
depth = 0
class_end = -1
i = content.find('{', search_from)
depth = 1
i += 1
while i < len(content) and depth > 0:
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
    i += 1
class_end = i

# Remove the class definition
content = content[:start_idx] + content[class_end:]

# Remove the ErrorInfo import
content = content.replace('import React, { ErrorInfo } from "react";\n\n', '')

# Remove GlobalErrorBoundary wrapper from JSX
content = content.replace('<GlobalErrorBoundary>\n            <AppContent onReady={onReady} />\n          </GlobalErrorBoundary>', '<AppContent onReady={onReady} />')

with open('client/src/App.tsx', 'w') as f:
    f.write(content)

print("Removed GlobalErrorBoundary completely")
