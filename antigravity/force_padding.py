
import os
import re

file_path = '/Volumes/Black6T/antigravity/src/components/Editor.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Function to replace padding lines with padding: '0px'
# We look for the pattern: padding[Top/Left/Bottom/Right]: 'var(--editor-line-height)'
# and replace with '0px'

# Create a regex to match the variable padding
# Match: padding(Left|Right|Top|Bottom): 'var\(--editor-line-height\)',
pattern = r"(padding(Left|Right|Top|Bottom)):\s*'var\(--editor-line-height\)',"
replacement = r"\1: '0px',"

new_content = re.sub(pattern, replacement, content)

# Also check for unitless padding if any (previous failures might have injected bad code?)
# Just forcing 0px on the verified matches is safer.

if new_content != content:
    print("Replaced padding variables with 0px")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print("No padding variables found to replace (already 0px?)")
    # Let's check if they are already 0px or something else
    if "paddingTop: '0px'," in content:
        print("Padding already appears to be 0px.")
    else:
        print("Couldn't identify padding pattern.")

# Also ensure letter-spacing is exactly '0px' on both
# pattern_ls = r"letterSpacing: '.*?',"
# replacement_ls = "letterSpacing: '0px',"
# new_content = re.sub(pattern_ls, replacement_ls, new_content)

