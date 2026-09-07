import re

path = "client/src/pages/admin-panel.tsx"
with open(path, "r") as file:
    content = file.read()

new_content = re.sub(r"text-gray-900(?! dark:)", r"text-gray-900 dark:text-gray-100", content)

if new_content != content:
    with open(path, "w") as file:
        file.write(new_content)
    print("Fixed text-gray-900 in PreviewAdminPanel.tsx")
