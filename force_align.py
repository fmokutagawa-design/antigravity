
import os

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace overflowWrap with wordBreak for strict CJK breaking
# Target: overflowWrap: 'break-word'
# Replacement: wordBreak: 'break-all'

new_content = content.replace("overflowWrap: 'break-word'", "wordBreak: 'break-all'")

if new_content != content:
    print("Replaced overflowWrap with wordBreak: break-all")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print("Target not found (already replaced?)")

