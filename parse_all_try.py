import re

with open('server/routes.ts', 'r') as f:
    lines = f.readlines()

try_lines = []
catch_lines = []

for i, line in enumerate(lines):
    # Strip string literals for a naive check
    line = re.sub(r'".*?"', '', line)
    line = re.sub(r"'.*?'", '', line)
    line = re.sub(r"`.*?`", '', line)
    if 'try' in line and '{' in line:
        try_lines.append(i+1)
    if 'catch' in line:
        catch_lines.append(i+1)

print(f"Total trys: {len(try_lines)}")
print(f"Total catches: {len(catch_lines)}")
