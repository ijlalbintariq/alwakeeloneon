import re

file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts'
with open(file, 'r') as f:
    content = f.read()

# 1. Remove the headers and sendStatus from wherever they are currently
content = re.sub(
    r'res\.setHeader\("Content-Type", "text/event-stream"\);\n\s*res\.setHeader\("Cache-Control", "no-cache"\);\n\s*res\.setHeader\("Connection", "keep-alive"\);\n\s*// Helper to send status updates\n\s*const sendStatus = \(statusMsg: string\) => \{\n\s*res\.write\(`data: \$\{JSON\.stringify\(\{ status: statusMsg \}\)\}\\n\\n`\);\n\s*\};\n',
    '',
    content
)

# 2. Inject them at the very top of the try block
replacement = """try {
    const { sessionId, userMessage, config } = req.body;
    const userId = req.user.id;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const sendStatus = (statusMsg: string) => {
      res.write(`data: ${JSON.stringify({ status: statusMsg })}\\n\\n`);
    };"""

content = re.sub(
    r'try \{\n\s*const \{ sessionId, userMessage, config \} = req\.body;\n\s*const userId = req\.user\.id;',
    replacement,
    content
)

# 3. Fix c.headnotes to c.summary
content = content.replace('c.headnotes?', 'c.summary?')

with open(file, 'w') as f:
    f.write(content)

print("Headers moved to top and headnotes fixed.")
