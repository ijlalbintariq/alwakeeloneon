import re

path = "client/src/components/onboarding-tour.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace stepIndex initialization
content = re.sub(
    r"const \[stepIndex, setStepIndex\] = useState\(-1\);",
    r"""const [stepIndex, setStepIndex] = useState(() => {
    const saved = sessionStorage.getItem('aw_tour_step');
    return saved !== null ? parseInt(saved, 10) : -1;
  });""",
    content
)

# Replace setStepIndex calls to also save to sessionStorage
# We'll just add a useEffect to sync it instead, much safer
sync_effect = """
  // Sync stepIndex to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('aw_tour_step', stepIndex.toString());
  }, [stepIndex]);
"""

if "aw_tour_step" not in content:
    content = content.replace(
        "const [dismissed, setDismissed] = useState(false);",
        "const [dismissed, setDismissed] = useState(false);\n" + sync_effect
    )

with open(path, "w") as f:
    f.write(content)

print("Fixed main onboarding tour state persistence")
