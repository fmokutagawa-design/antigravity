import re
import os

path = '/Volumes/Black6T/antigravity/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace alert(...) with showToast(...)
# Simple replacement
content = content.replace('alert(', 'showToast(')

# 2. Replace confirm(...) with await requestConfirm(...)
# This is trickier because we need to make sure the containing function is async.
# Heuristic: Find 'if (confirm(' or 'const confirmed = confirm('
# and replace with 'if (await requestConfirm(' or 'const confirmed = await requestConfirm('

# Pattern: confirm(MESSAGE) -> await requestConfirm("Confirmation", MESSAGE)
# We use a placeholder for title for now.
content = re.sub(r'confirm\((.*?)\)', r'await requestConfirm("確認", \1)', content)
# Special case for window.confirm
content = content.replace('window.await requestConfirm', 'await requestConfirm')

# 3. Ensure functions using await are async
# Find 'const NAME = (args) => {' where body contains 'await requestConfirm'
# This is hard with regex. Let's try to find patterns like:
# 'const handleX = (args) => {' -> 'const handleX = async (args) => {'
# if the body contains requestConfirm.

lines = content.split('\n')
new_lines = []
in_function = False
current_function_start = -1

for i, line in enumerate(lines):
    # If a line contains 'await requestConfirm' but is not async
    if 'await requestConfirm' in line:
        # Look back for function start
        found = False
        for j in range(i, max(-1, i-50), -1):
            if '=> {' in lines[j] and 'async' not in lines[j]:
                lines[j] = lines[j].replace('=> {', 'async => {')
                found = True
                break
            if 'function' in lines[j] and 'async' not in lines[j]:
                lines[j] = lines[j].replace('function', 'async function')
                found = True
                break
            if found: break

# Save back
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("Replacement complete.")
