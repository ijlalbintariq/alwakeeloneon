import re

path = "client/src/components/onboarding-tour.tsx"
with open(path, "r") as f:
    content = f.read()

# Fix welcome screen wrapper
content = content.replace(
    'className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"',
    'className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center justify-center pointer-events-none" style={{ pointerEvents: "none" }}'
)

# And make the inner container clickable
content = content.replace(
    'className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-background shadow-2xl overflow-hidden"',
    'className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-background shadow-2xl overflow-hidden pointer-events-auto"'
)

with open(path, "w") as f:
    f.write(content)

print("Fixed main onboarding tour blur")
