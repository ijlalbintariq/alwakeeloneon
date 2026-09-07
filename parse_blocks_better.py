import re

def check_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove all string literals and comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'`[^`]*`', '', content, flags=re.DOTALL)
    content = re.sub(r"'[^']*'", '', content)
    content = re.sub(r'"[^"]*"', '', content)
    
    lines = content.split('\n')
    
    stack = []
    
    for i, line in enumerate(lines):
        for char in line:
            if char == '{':
                stack.append(i + 1)
            elif char == '}':
                if stack:
                    stack.pop()
    
    print(f"Unclosed brackets opened at lines: {stack}")

check_file('server/routes.ts')
