import re

with open('server/routes.ts', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if re.search(r'\btry\s*\{', line):
        # find matching bracket
        stack = 1
        j = i + 1
        while j < len(lines):
            # very naive
            for char in lines[j]:
                if char == '{': stack += 1
                elif char == '}': stack -= 1
            if stack == 0:
                # check next tokens
                rest = "".join(lines[j:]).strip()
                if not rest.startswith('catch') and not rest.startswith('finally'):
                    print(f"Try at line {i+1} has no catch! Closes at {j+1}")
                break
            j += 1
