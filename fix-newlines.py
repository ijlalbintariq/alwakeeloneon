import re
file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts'
with open(file, 'r') as f:
    content = f.read()

content = re.sub(
    r'res\.write\(`data: \$\{JSON\.stringify\(\{ status: statusMsg \}\)\}\n\n`\);',
    r'res.write(`data: ${JSON.stringify({ status: statusMsg })}\\n\\n`);',
    content
)

with open(file, 'w') as f:
    f.write(content)
