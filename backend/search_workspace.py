import os

workspace = "C:\\lumiere"
target = "twelve"

print(f"Searching for '{target}' in {workspace}...")
found = []
for root, dirs, files in os.walk(workspace):
    if ".git" in root or ".venv" in root or "node_modules" in root or ".vinxi" in root:
        continue
    for f in files:
        path = os.path.join(root, f)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                content = file.read()
                if target in content.lower():
                    found.append(path)
                    print(f"Found in: {path}")
        except Exception as e:
            pass
print("Done. Total files found:", len(found))
