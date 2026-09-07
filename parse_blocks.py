import sys

def check_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    stack = []
    
    for i, line in enumerate(lines):
        line = line.split('//')[0] # remove simple comments
        for char in line:
            if char == '{':
                stack.append(i + 1)
            elif char == '}':
                if stack:
                    stack.pop()
    
    if stack:
        print(f"Unclosed brackets opened at lines: {stack}")
    else:
        print("Brackets are balanced")

check_file('server/routes.ts')
